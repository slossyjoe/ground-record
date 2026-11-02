import fs from "node:fs";
import path from "node:path";

const UA = "GroundRecord/0.1 (educational local app; links original posts, does not download media)";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function mediaType(origin, name) {
  const token = `${origin || ""} ${name || ""}`.toUpperCase();
  if (/\bVID|\bVIDEO/.test(token)) return "video";
  if (/\bPIC|\bPHOTO/.test(token)) return "photo";
  return "other";
}

function urlsFrom(value) {
  if (!value) return [];
  return String(value)
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.startsWith("http"));
}

function titleFrom(detail) {
  const name = String(detail.name || "").replace(/\s+/g, " ").trim();
  const description = String(detail.description || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const datedOnly = /^\d{1,2}\s+[A-Z]{3}\s+\d{4}$/.test(name);
  const body = description.split("http")[0].trim();
  if (datedOnly && body.length > 12) return body.slice(0, 220);
  return name || body.slice(0, 220) || "Verified media";
}

function placeFrom(detail) {
  const plus = detail.plusCode || "";
  const named = plus.split(",")[0]?.replace(/\+.*/, "").trim();
  if (named && named.length > 2) return named;
  const title = detail.name || "";
  const bits = title.split(" - ").slice(1).join(" - ").split(",")[0];
  return bits?.trim() || "Place named on the GeoConfirmed card";
}

export async function refreshUkraineMedia(root) {
  const out = path.join(root, "data", "media", "ukraine.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (fs.existsSync(out) && process.env.FORCE_MEDIA !== "1") {
    const age = Date.now() - fs.statSync(out).mtimeMs;
    const saved = JSON.parse(fs.readFileSync(out, "utf8"));
    if (age < 12 * 60 * 60 * 1000 && Array.isArray(saved.items) && saved.items.length) {
      console.log(`GeoConfirmed cache is fresh (${saved.items.length} items).`);
      return saved;
    }
  }
  console.log("Downloading GeoConfirmed public GeoJSON…");
  const payload = await getJson("https://geoconfirmed.org/api/placemark/geojson");
  const ukraineIds = new Set(
    (payload.factionMeta || []).filter((item) => item.conflictUrl === "ukraine").map((item) => item.id),
  );
  const names = Object.fromEntries((payload.factionMeta || []).map((item) => [item.id, item.name]));
  const today = new Date().toISOString().slice(0, 10);
  const candidates = (payload.geojson?.features || [])
    .filter((feature) => ukraineIds.has(feature.properties?.factionId))
    .map((feature) => ({
      id: feature.properties.id,
      date: feature.properties.date || "",
      faction: names[feature.properties.factionId] || "Ukraine record",
      lng: feature.geometry?.coordinates?.[0],
      lat: feature.geometry?.coordinates?.[1],
    }))
    .filter((item) => item.date.slice(0, 10) <= today && item.lat != null && item.lng != null)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 40);

  const items = [];
  for (const candidate of candidates) {
    await sleep(250);
    try {
      const detail = await getJson(`https://geoconfirmed.org/api/placemark/detail/${candidate.id}`);
      const originalUrls = urlsFrom(detail.originalSource);
      const geolocationUrl = urlsFrom(detail.geolocation)[0] || null;
      if (!originalUrls.length || !geolocationUrl) continue;
      const day = String(detail.date || candidate.date || "").slice(0, 10);
      const clock = String(detail.date || "");
      const hasClock = /T(?!00:00:00)/.test(clock);
      items.push({
        id: detail.id,
        lat: detail.latitude,
        lng: detail.longitude,
        title: titleFrom(detail),
        place: placeFrom(detail),
        mediaType: mediaType(detail.origin, detail.name),
        eventDate: /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
        recordedTimeKnown: false,
        postedAt: null,
        geolocatedAt: null,
        timeNote: hasClock
          ? `GeoConfirmed’s card includes a clock time (${clock.slice(11, 16)}). This app does not treat that as the filming time or as the posting time.`
          : "GeoConfirmed gives a calendar date only. No filming clock time is in the record. The posting time is on the original post, not copied here.",
        originalUrls,
        geolocationUrl,
        verifiedBy: "GeoConfirmed",
        confidence: "geolocated",
        filedUnder: detail.faction || candidate.faction,
      });
    } catch (error) {
      console.log("  skip", candidate.id, error.message);
    }
  }
  const record = {
    source: "GeoConfirmed public API",
    sourceUrl: "https://geoconfirmed.org/map/ukraine",
    fetchedAt: new Date().toISOString(),
    note: "Recent verified Ukraine events with both an original post and a GeoConfirmed geolocation post. Older events stay on GeoConfirmed’s own map. Media files are not downloaded.",
    items,
  };
  fs.writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
  console.log(`Saved ${items.length} GeoConfirmed media pins.`);
  return record;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshUkraineMedia(process.cwd()).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
