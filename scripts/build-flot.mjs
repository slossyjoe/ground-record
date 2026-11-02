/**
 * Builds an estimated forward line from settlement-control markers.
 * Geometry is calculated here. It is not an ISW or DeepStateMap line.
 *
 * Inputs we are allowed to reuse:
 * - Wikipedia Module:Russo-Ukrainian war overview map and detailed map (CC BY-SA).
 *   Those modules mark settlements Ukrainian-held, Russian-held, or contested.
 * - OpenStreetMap river centerlines via Wikimedia geoline (ODbL), used only to
 *   pull a midpoint onto a river when the two settlements sit on opposite banks.
 * - Optional corroboration text from this app's headlines and GeoConfirmed pins.
 *   Text does not move the line. It is attached as evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UA = "GroundRecord/0.1 (local conflict tracker; educational; contact: local-owner)";
const MODULES = [
  {
    title: "Module:Russo-Ukrainian war overview map",
    url: "https://en.wikipedia.org/w/index.php?title=Module:Russo-Ukrainian_war_overview_map&action=raw",
  },
  {
    title: "Module:Russo-Ukrainian war detailed map",
    url: "https://en.wikipedia.org/w/index.php?title=Module:Russo-Ukrainian_war_detailed_map&action=raw",
  },
];
const RIVERS = [
  { id: "Q40848", name: "Dnieper" },
  { id: "Q199882", name: "Siverskyi Donets" },
  { id: "Q1412074", name: "Inhulets" },
];

const CROSS_TOWN_KM = 2.8;

export async function buildFlot(root) {
  const outPath = path.join(root, "data", "flot", "ukraine.json");
  const cacheDir = path.join(root, "data", "cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const lua = [];
  for (const mod of MODULES) {
    const text = await loadModule(cacheDir, mod);
    lua.push({ ...mod, text });
  }
  const points = parseModules(lua);
  const rivers = await loadRivers(cacheDir);
  const headlines = loadHeadlines(root);
  const media = loadMedia(root);
  const flot = estimate(points, rivers, headlines, media, lua.map((item) => item.title));
  fs.writeFileSync(outPath, JSON.stringify(flot, null, 2));
  console.log(
    `Front estimate: ${flot.counts.settlements} settlements, ${flot.counts.anchors} anchors, ${flot.counts.segments} segments (${flot.counts.evidenced} solid / ${flot.counts.interpolated} dashed), ${flot.areas.length} shaded areas. Rivers used: ${flot.riversUsed.join(", ") || "none"}.`,
  );
  return flot;
}

async function loadModule(cacheDir, mod) {
  const file = path.join(cacheDir, `${mod.title.replace(/\W+/g, "_")}.lua`);
  try {
    const text = await fetchText(mod.url);
    if (!text.includes("mk.ukr") && !text.includes("mk =")) {
      throw new Error("Wikipedia module did not look like the map module");
    }
    fs.writeFileSync(file, text);
    return text;
  } catch (error) {
    if (fs.existsSync(file)) {
      console.log(`Wikipedia module cache used for ${mod.title}: ${error.message}`);
      return fs.readFileSync(file, "utf8");
    }
    const tmp = mod.title.includes("detailed") ? "/tmp/wiki-map.lua" : "/tmp/wiki-overview.lua";
    if (fs.existsSync(tmp)) {
      console.log(`Wikipedia module temp copy used for ${mod.title}: ${error.message}`);
      return fs.readFileSync(tmp, "utf8");
    }
    throw error;
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/plain,application/json" },
    signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function parseModules(modules) {
  const byKey = new Map();
  for (const mod of modules) {
    let section = "";
    for (const rawLine of mod.text.split("\n")) {
      const line = rawLine.trim();
      if (line.startsWith("--")) {
        const comment = line.replace(/^--+\s*/, "").trim();
        if (/oblast|crimea|^russia|kursk|belgorod|voronezh|rostov|krasnodar/i.test(comment)) {
          section = comment.replace(/\s+is at the bottom\.?/i, "").trim();
        }
        continue;
      }
      const point = parseMark(line, section, mod.title);
      if (!point) continue;
      const key = `${point.name.toLowerCase()}|${point.lat.toFixed(2)}|${point.lng.toFixed(2)}`;
      const prev = byKey.get(key);
      if (!prev || rank(point) >= rank(prev)) byKey.set(key, point);
    }
  }
  return [...byKey.values()];
}

function rank(point) {
  return point.side === "con" ? 3 : point.side === "rus" ? 2 : 1;
}

function parseMark(line, section, moduleTitle) {
  if (line.startsWith("--")) return null;
  const lat = line.match(/\blat\s*=\s*"(-?\d+(?:\.\d+)?)"/);
  const lng = line.match(/\blong\s*=\s*"(-?\d+(?:\.\d+)?)"/);
  const mark = line.match(/\bmark\s*=\s*mk\.(ukr|rus|con|shr|grz)/);
  if (!lat || !lng || !mark) return null;
  const side = mark[1] === "shr" ? "con" : mark[1] === "grz" ? "unknown" : mark[1];
  if (side === "unknown") return null;
  const labelMatch = line.match(/\blabel\s*=\s*"((?:\\.|[^"\\])*)"/);
  const linkMatch = line.match(/\blink\s*=\s*"([^"]+)"/);
  const name = cleanLabel(labelMatch?.[1] || "");
  if (!name) return null;
  const inRussia = /russia|kursk|belgorod|voronezh|rostov|krasnodar|bryansk|adygea/i.test(section) && !/ukrain/i.test(section);
  return {
    name,
    lat: Number(lat[1]),
    lng: Number(lng[1]),
    side,
    section: section || "unsectioned",
    inTheater: !inRussia,
    url: wikiUrl(linkMatch?.[1] || name),
    moduleTitle,
  };
}

function cleanLabel(raw) {
  let text = raw.replace(/&shy;|&#173;/g, "").replace(/\\"/g, '"');
  text = text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/<[^>]+>/g, "");
  return text.replace(/\s+/g, " ").trim();
}

function wikiUrl(link) {
  if (!link) return "https://en.wikipedia.org/wiki/Module:Russo-Ukrainian_war_detailed_map";
  if (/^https?:/i.test(link)) return link;
  const [page, hash] = link.split("#");
  const slug = encodeURIComponent(page.trim().replace(/ /g, "_")).replace(/%2F/g, "/");
  const frag = hash ? `#${encodeURIComponent(hash.trim().replace(/ /g, "_"))}` : "";
  return `https://en.wikipedia.org/wiki/${slug}${frag}`;
}

async function loadRivers(cacheDir) {
  const saved = path.join(cacheDir, "..", "flot", "rivers.json");
  const query = `[out:json][timeout:50];(
way["waterway"="river"]["name:en"="Dnieper River"](46.3,32.2,48.05,35.55);
way["waterway"="river"]["name:en"~"Donets"](48.4,36.9,49.95,38.9);
way["waterway"="river"]["name:en"~"Oskil"](49.15,37.15,50.45,38.05);
);out geom;`;
  let payload = null;
  try {
    const response = await fetch("https://overpass.openstreetmap.fr/api/interpreter", {
      method: "POST",
      headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(55000),
    });
    if (!response.ok) throw new Error(`${response.status}`);
    payload = await response.json();
    console.log(`OSM rivers: ${payload.elements?.length || 0} ways`);
  } catch (error) {
    console.log(`OSM river fetch skipped: ${error.message}`);
    if (fs.existsSync(saved)) payload = { saved: JSON.parse(fs.readFileSync(saved, "utf8")) };
  }
  if (payload?.saved) return payload.saved;
  if (!payload?.elements) return [];
  const grouped = new Map();
  for (const element of payload.elements) {
    const name = element.tags?.["name:en"] || element.tags?.name;
    if (!name || !element.geometry || element.geometry.length < 2) continue;
    const line = simplify(
      element.geometry.map((node) => [node.lon, node.lat]),
      0.012,
    );
    if (line.length < 2) continue;
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push(line);
  }
  const rivers = [...grouped.entries()].map(([name, lines]) => ({
    name,
    lines,
    sourceUrl: "https://www.openstreetmap.org/copyright",
  }));
  fs.mkdirSync(path.dirname(saved), { recursive: true });
  fs.writeFileSync(saved, JSON.stringify(rivers));
  for (const river of rivers) {
    console.log(`River ${river.name}: ${river.lines.reduce((sum, line) => sum + line.length, 0)} points`);
  }
  return rivers;
}

function collectLines(node, into) {
  if (!node || typeof node !== "object") return;
  if (node.type === "LineString" && Array.isArray(node.coordinates)) into.push(node.coordinates);
  if (node.type === "MultiLineString" && Array.isArray(node.coordinates)) {
    for (const line of node.coordinates) into.push(line);
  }
  if (Array.isArray(node)) {
    for (const item of node) collectLines(item, into);
    return;
  }
  if (node.features) collectLines(node.features, into);
  if (node.geometry) collectLines(node.geometry, into);
}

function simplify(points, epsilon) {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let max = 0;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const dist = perpendicular(points[i], points[start], points[end]);
      if (dist > max) {
        max = dist;
        index = i;
      }
    }
    if (index !== -1 && max > epsilon) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

function perpendicular(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / len;
}

function loadHeadlines(root) {
  const file = path.join(root, "data", "reports", "latest", "russia-ukraine.json");
  if (!fs.existsSync(file)) return [];
  const report = JSON.parse(fs.readFileSync(file, "utf8"));
  return (report.headlines || []).map((item) => ({
    title: item.title || "",
    url: item.url || "",
    outlet: item.outlet || "",
    publishedAt: item.publishedAt || null,
  }));
}

function loadMedia(root) {
  const file = path.join(root, "data", "media", "ukraine.json");
  if (!fs.existsSync(file)) return [];
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  return saved.items || [];
}

function estimate(points, rivers, headlines, media, moduleTitles) {
  const theater = points.filter((point) => point.inTheater);
  const ukr = theater.filter((point) => point.side === "ukr");
  const rus = theater.filter((point) => point.side === "rus");
  const con = theater.filter((point) => point.side === "con");
  const index = buildIndex(theater, 0.28);
  const pairs = gabrielPairs(rus, index);
  console.log(`Contact pairs with an empty gap: ${pairs.length}`);
  const anchors = [];

  for (const pair of pairs) {
    const mid = midpoint(pair.ukr, pair.rus);
    const town = con.find((item) => km(item, mid) < 7 && closestOnSegment(item, pair.ukr, pair.rus).km < 6);
    anchors.push({
      lat: town ? town.lat : mid.lat,
      lng: town ? town.lng : mid.lng,
      kind: town ? "contested" : "midpoint",
      contactKm: pair.km,
      ukr: pair.ukr,
      rus: pair.rus,
      con: town || null,
      river: null,
    });
  }
  for (const town of con) {
    if (anchors.some((anchor) => anchor.con === town || km(anchor, town) < 6)) continue;
    const nearUkr = nearest(town, ukr);
    const nearRus = nearest(town, rus);
    anchors.push({
      lat: town.lat,
      lng: town.lng,
      kind: "contested",
      contactKm: Math.min(nearUkr?.km ?? 40, nearRus?.km ?? 40),
      ukr: nearUkr?.point || null,
      rus: nearRus?.point || null,
      con: town,
      river: null,
    });
  }

  const deduped = dedupeAnchors(anchors, 4.5);
  const grid = classifyGrid(ukr, rus);
  const areas = controlFromGrid(grid);
  const traced = contactLines(grid, rivers, ukr, rus);
  const lines = traced.lines;
  const segments = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const a = line[i - 1];
      const b = line[i];
      const length = km({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] });
      if (length < 0.4) continue;
      const mid = { lng: (a[0] + b[0]) / 2, lat: (a[1] + b[1]) / 2 };
      const nearPair = deduped.find((anchor) => km(anchor, mid) < 9);
      const evidenced = Boolean(nearPair && (nearPair.kind === "contested" || nearPair.contactKm <= 14));
      const nearUkr = nearest(mid, ukr);
      const nearRus = nearest(mid, rus);
      const nearCon = nearest(mid, con);
      segments.push({
        id: `flot-${segments.length + 1}`,
        confidence: evidenced ? "evidenced" : "interpolated",
        coordinates: [a, b],
        lengthKm: Math.round(length * 10) / 10,
        anchors: [
          {
            kind: nearCon && nearCon.km < 10 ? "contested" : "midpoint",
            contactKm: nearPair?.contactKm ?? nearUkr?.km ?? 20,
            ukr: nearUkr?.point || null,
            rus: nearRus?.point || null,
            con: nearCon && nearCon.km < 12 ? nearCon.point : null,
            river: nearPair?.river || null,
          },
        ],
      });
    }
  }
  attachCorroboration(segments, headlines, media, theater);
  const contested = con.map((town, index) => ({
    id: `con-${index + 1}`,
    name: town.name,
    lat: round(town.lat),
    lng: round(town.lng),
    section: town.section,
    url: town.url,
  }));

  const fetchedAt = new Date().toISOString();
  const asOf = fetchedAt.slice(0, 10);
  const riversUsed = traced.riversUsed;
  const wikiSource = {
    name: "Wikipedia settlement-control markers",
    url: "https://en.wikipedia.org/wiki/Module:Russo-Ukrainian_war_detailed_map",
    note: `CC BY-SA. Modules: ${moduleTitles.join("; ")}. Markers fetched ${asOf}. Blue dots are treated as Ukrainian-held, red as Russian-held, and the contested mark as contested. Settlements filed under Russia in the module (Kursk, Belgorod, and other Russian cities) are excluded so the international border is not drawn as a front.`,
  };
  const sources = [wikiSource];
  if (riversUsed.length) {
    sources.push({
      name: "OpenStreetMap river centerlines",
      url: "https://www.openstreetmap.org/copyright",
      note: `ODbL. Used only where a Ukrainian-held marker and a Russian-held marker sit on opposite banks: ${riversUsed.join(", ")}.`,
    });
  }

  return {
    id: "russia-ukraine",
    asOf,
    fetchedAt,
    history: null,
    timelineNote:
      "This file is one snapshot of the Wikipedia settlement markers. The map slider filters verified media. It does not move the line, because an older copy of these markers is not stored here.",
    summary:
      "Estimated contact line. The map is divided into cells of about 10 km. A cell is counted Russian-held when the nearest Wikipedia settlement marker is Russian-held, and Ukrainian-held when the nearest marker is Ukrainian-held. The line is the boundary between those two kinds of cells. It is drawn solid where that boundary passes within 9 km of a contested marker, or of a close pair of opposing markers with an empty gap between them. Elsewhere it is dashed, because the markers do not pin the boundary down. Where the two markers sit on opposite banks of the Dnipro, the Donets, or the Oskil, the vertex is moved onto that OpenStreetMap river. The tint is the Russian-held cells. Open water near a Russian-held marker can be tinted, because this is not a coastline.",
    accuracy:
      "Settlement-level estimate, on a grid of about 10 km, not a trench line. Solid stretches are the parts that pass close to a contested marker or a close pair of opposing markers. Dashed stretches are interpolated across a gap in the markers. A village between the markers can sit on either side of a dashed segment. The line is not copied from ISW or DeepStateMap.",
    sources,
    riversUsed,
    counts: {
      settlements: theater.length,
      ukr: ukr.length,
      rus: rus.length,
      contested: con.length,
      excludedRussia: points.length - theater.length,
      anchors: deduped.length,
      segments: segments.length,
      evidenced: segments.filter((segment) => segment.confidence === "evidenced").length,
      interpolated: segments.filter((segment) => segment.confidence === "interpolated").length,
    },
    segments: segments.map(publicSegment),
    areas,
    contested,
  };
}

function publicSegment(segment) {
  const names = new Set();
  const evidence = [];
  for (const anchor of segment.anchors) {
    for (const town of [anchor.con, anchor.ukr, anchor.rus]) {
      if (!town || names.has(town.name + town.side)) continue;
      names.add(town.name + town.side);
      evidence.push({
        kind: "settlement",
        name: town.name,
        side: town.side,
        section: town.section,
        lat: round(town.lat),
        lng: round(town.lng),
        url: town.url,
        text:
          town.side === "con"
            ? `${town.name} is marked contested in the Wikipedia module.`
            : `${town.name} is marked ${town.side === "ukr" ? "Ukrainian-held" : "Russian-held"} in the Wikipedia module.`,
      });
    }
    if (anchor.river) {
      evidence.push({
        kind: "river",
        name: anchor.river,
        text: `The vertex was moved onto the ${anchor.river} because the two settlement markers sit on opposite banks. The river centerline is OpenStreetMap data.`,
      });
    }
  }
  for (const item of segment.corroboration || []) evidence.push(item);
  const evidenced = segment.confidence === "evidenced";
  const title = evidenced ? "Front estimate, closer settlement evidence" : "Front estimate, interpolated";
  const pairText = segment.anchors
    .map((anchor) => {
      if (anchor.kind === "contested") return `${anchor.con.name} (contested)`;
      return `midpoint of ${anchor.ukr.name} and ${anchor.rus.name} (${anchor.contactKm.toFixed(0)} km apart)`;
    })
    .join(" to ");
  return {
    id: segment.id,
    confidence: segment.confidence,
    dash: evidenced ? null : [1.4, 1.1],
    lengthKm: segment.lengthKm,
    coordinates: segment.coordinates,
    title,
    detail: `This ${segment.lengthKm} km stretch runs near ${pairText}. ${
      evidenced
        ? "Drawn solid because a contested marker, or a close pair of opposing markers, sits on this stretch."
        : "Drawn dashed because the markers leave a gap and the line between them is interpolated."
    } This is an estimate built from settlement markers, not a traced trench line.`,
    evidence,
    sources: [
      {
        name: "Wikipedia map modules",
        url: "https://en.wikipedia.org/wiki/Module:Russo-Ukrainian_war_detailed_map",
        note: "CC BY-SA settlement-control markers. Not an ISW or DeepStateMap geometry.",
      },
    ],
  };
}

function attachCorroboration(segments, headlines, media, theater) {
  const names = theater
    .map((town) => town.name)
    .filter((name) => name.length >= 5)
    .sort((a, b) => b.length - a.length);
  for (const segment of segments) {
    segment.corroboration = [];
    const mid = {
      lat: (segment.coordinates[0][1] + segment.coordinates[1][1]) / 2,
      lng: (segment.coordinates[0][0] + segment.coordinates[1][0]) / 2,
    };
    const nearbyNames = new Set(
      theater.filter((town) => km(town, mid) < 30).map((town) => town.name.toLowerCase()),
    );
    for (const headline of headlines) {
      if (!/captur|liberat|seiz|recaptur|retaken|occup/i.test(headline.title)) continue;
      const hit = names.find((name) => nearbyNames.has(name.toLowerCase()) && includesName(headline.title, name));
      if (!hit) continue;
      segment.corroboration.push({
        kind: "headline",
        name: hit,
        text: `A headline names ${hit} with control language. The line was not moved to match it. “${headline.title}”`,
        url: headline.url,
        outlet: headline.outlet,
        publishedAt: headline.publishedAt,
      });
    }
    for (const item of media) {
      if (!item.lat || !item.lng) continue;
      if (km({ lat: item.lat, lng: item.lng }, mid) > 22) continue;
      const hit = names.find((name) => nearbyNames.has(name.toLowerCase()) && includesName(item.title || "", name));
      if (!hit) continue;
      segment.corroboration.push({
        kind: "geolocated",
        name: hit,
        text: `GeoConfirmed footage dated ${item.eventDate || "unknown"} names ${hit} within 22 km of this stretch. The date is the card date, not a filming clock time. The line was not moved.`,
        url: item.geolocationUrl || item.originalUrls?.[0] || null,
        publishedAt: item.eventDate || null,
      });
    }
    segment.corroboration = segment.corroboration.slice(0, 6);
  }
}

function includesName(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu").test(text);
}

function classifyGrid(ukr, rus) {
  const step = 0.09;
  const lng0 = 31.8;
  const lat0 = 44.4;
  const lng1 = 40.15;
  const lat1 = 52.15;
  const ni = Math.ceil((lng1 - lng0) / step);
  const nj = Math.ceil((lat1 - lat0) / step);
  const rusIndex = buildIndex(rus, 0.32);
  const ukrIndex = buildIndex(ukr, 0.32);
  const side = new Map();
  for (let j = 0; j < nj; j += 1) {
    for (let i = 0; i < ni; i += 1) {
      const origin = { lng: lng0 + (i + 0.5) * step, lat: lat0 + (j + 0.5) * step };
      const dR = nearestWithin(rusIndex, origin, 75);
      const dU = nearestWithin(ukrIndex, origin, 90);
      if (dR == null && dU == null) continue;
      if ((dR ?? 1e9) <= (dU ?? 1e9) && (dR ?? 1e9) < 58) side.set(`${i},${j}`, "rus");
      else if ((dU ?? 1e9) < 90) side.set(`${i},${j}`, "ukr");
    }
  }
  return { side, lng0, lat0, step, ni, nj };
}

function controlFromGrid(grid) {
  const filled = new Set([...grid.side.entries()].filter(([, value]) => value === "rus").map(([key]) => key));
  const loops = traceMask(filled, grid.lng0, grid.lat0, grid.step).map((ring) =>
    ring.map(([lng, lat]) => [round(lng), round(lat)]),
  );
  const groups = [];
  const centroid = (ring) => {
    const cut = ring.slice(0, -1);
    return [
      cut.reduce((sum, point) => sum + point[0], 0) / Math.max(1, cut.length),
      cut.reduce((sum, point) => sum + point[1], 0) / Math.max(1, cut.length),
    ];
  };
  const ordered = loops
    .map((ring) => ({ ring, area: Math.abs(ringArea(ring)), center: centroid(ring) }))
    .sort((a, b) => b.area - a.area);
  for (const loop of ordered) {
    const container = groups.find((group) => pointInRing(group.outer, loop.center));
    if (!container) groups.push({ outer: orient(loop.ring, true), holes: [] });
    else container.holes.push(orient(loop.ring, false));
  }
  return groups.map((group, index) => ({
    id: `control-${index + 1}`,
    partyId: "ru",
    title: "Estimated Russian-marked side",
    detail:
      "A cell is tinted when the nearest Wikipedia settlement marker is Russian-held and a Ukrainian-held marker is farther away. The boundary is that distance estimate. It is not a surveyed occupation line, and it is not an ISW or DeepStateMap polygon. Water close to a Russian-held marker can be tinted, because this is not a coastline.",
    coordinates: group.outer,
    holes: group.holes,
    sources: [
      {
        name: "Wikipedia settlement-control markers",
        url: "https://en.wikipedia.org/wiki/Module:Russo-Ukrainian_war_detailed_map",
        note: "CC BY-SA. The shade is calculated from those markers.",
      },
    ],
  }));
}

function contactLines(grid, rivers, ukr, rus) {
  const adj = new Map();
  const seen = new Set();
  const addEdge = (a, b) => {
    const id = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(id)) return;
    seen.add(id);
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  };
  for (const [key, value] of grid.side) {
    if (value !== "rus") continue;
    const [i, j] = key.split(",").map(Number);
    const link = (ni, nj, a, b) => {
      if (grid.side.get(`${ni},${nj}`) === "ukr") addEdge(a, b);
    };
    link(i, j + 1, `${i},${j + 1}`, `${i + 1},${j + 1}`);
    link(i, j - 1, `${i},${j}`, `${i + 1},${j}`);
    link(i - 1, j, `${i},${j}`, `${i},${j + 1}`);
    link(i + 1, j, `${i + 1},${j}`, `${i + 1},${j + 1}`);
  }
  const used = new Set();
  const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const raw = [];
  const starts = [...adj.keys()];
  starts.sort((a, b) => (adj.get(a).length - adj.get(b).length));
  for (const start of starts) {
    for (const next of adj.get(start) || []) {
      if (used.has(edgeKey(start, next))) continue;
      used.add(edgeKey(start, next));
      const chain = [start];
      let prev = start;
      let current = next;
      let guard = 0;
      while (guard < 6000) {
        guard += 1;
        chain.push(current);
        const options = (adj.get(current) || []).filter((candidate) => !used.has(edgeKey(current, candidate)));
        if (!options.length) break;
        const [cx, cy] = current.split(",").map(Number);
        const [px, py] = prev.split(",").map(Number);
        const incoming = { x: cx - px, y: cy - py };
        options.sort((left, right) => cornerTurn(incoming, current, right) - cornerTurn(incoming, current, left));
        const chosen = options[0];
        used.add(edgeKey(current, chosen));
        prev = current;
        current = chosen;
      }
      if (chain.length >= 2) raw.push(chain);
    }
  }
  const riversUsed = new Set();
  const lines = [];
  for (const chain of raw) {
    let line = chain.map((key) => {
      const [i, j] = key.split(",").map(Number);
      return [grid.lng0 + i * grid.step, grid.lat0 + j * grid.step];
    });
    line = simplify(line, 0.04);
    for (let index = 0; index < line.length; index += 1) {
      const snapped = snapVertex({ lng: line[index][0], lat: line[index][1] }, rivers, ukr, rus);
      if (!snapped) continue;
      line[index] = [snapped.lng, snapped.lat];
      riversUsed.add(snapped.name);
    }
    line = line.map(([lng, lat]) => [round(lng), round(lat)]);
    if (line.length >= 2) lines.push(line);
  }
  return { lines, riversUsed: [...riversUsed] };
}

function cornerTurn(incoming, currentKey, nextKey) {
  const [cx, cy] = currentKey.split(",").map(Number);
  const [nx, ny] = nextKey.split(",").map(Number);
  return Math.atan2(incoming.x * (ny - cy) - incoming.y * (nx - cx), incoming.x * (nx - cx) + incoming.y * (ny - cy));
}

function snapVertex(point, rivers, ukr, rus) {
  let best = null;
  for (const river of rivers) {
    for (const line of river.lines) {
      for (let index = 1; index < line.length; index += 1) {
        const start = { lng: line[index - 1][0], lat: line[index - 1][1] };
        const end = { lng: line[index][0], lat: line[index][1] };
        const hit = closestOnSegment(point, start, end);
        if (!hit || hit.km > 6.5) continue;
        if (!best || hit.km < best.km) best = { ...hit, name: river.name, start, end };
      }
    }
  }
  if (!best) return null;
  const ukrainian = nearest(point, ukr);
  const russian = nearest(point, rus);
  if (!ukrainian || !russian || ukrainian.km > 28 || russian.km > 28) return null;
  const sideUkr = sideOf(ukrainian.point, best.start, best.end);
  const sideRus = sideOf(russian.point, best.start, best.end);
  if (!sideUkr || !sideRus || sideUkr === sideRus) return null;
  return { lng: best.lng, lat: best.lat, name: best.name };
}

function controlPolygons(ukr, rus) {
  const step = 0.12;
  const lng0 = 31.7;
  const lat0 = 44.35;
  const lng1 = 40.3;
  const lat1 = 52.25;
  const ni = Math.ceil((lng1 - lng0) / step);
  const nj = Math.ceil((lat1 - lat0) / step);
  const rusIndex = buildIndex(rus, 0.35);
  const ukrIndex = buildIndex(ukr, 0.35);
  const filled = new Set();
  for (let j = 0; j < nj; j += 1) {
    for (let i = 0; i < ni; i += 1) {
      const origin = { lng: lng0 + (i + 0.5) * step, lat: lat0 + (j + 0.5) * step };
      const dR = nearestWithin(rusIndex, origin, 46);
      if (dR == null) continue;
      const dU = nearestWithin(ukrIndex, origin, 80);
      if (dR + 6 < (dU ?? 999)) filled.add(`${i},${j}`);
    }
  }
  const loops = traceMask(filled, lng0, lat0, step).map((ring) => ring.map(([lng, lat]) => [round(lng), round(lat)]));
  const groups = [];
  const centroid = (ring) => {
    const cut = ring.slice(0, -1);
    return [
      cut.reduce((sum, point) => sum + point[0], 0) / cut.length,
      cut.reduce((sum, point) => sum + point[1], 0) / cut.length,
    ];
  };
  const ordered = loops
    .map((ring) => ({ ring, area: Math.abs(ringArea(ring)), center: centroid(ring) }))
    .sort((a, b) => b.area - a.area);
  for (const loop of ordered) {
    const container = groups.find((group) => pointInRing(group.outer, loop.center));
    if (!container) groups.push({ outer: orient(loop.ring, true), holes: [] });
    else container.holes.push(orient(loop.ring, false));
  }
  return groups.map((group, index) => ({
    id: `control-${index + 1}`,
    partyId: "ru",
    title: "Estimated Russian-marked side",
    detail:
      "A cell is tinted when the nearest Wikipedia settlement marker is Russian-held and a Ukrainian-held marker is farther away. The boundary is that distance estimate. It is not a surveyed occupation line, and it is not an ISW or DeepStateMap polygon. Water close to a Russian-held marker can be tinted, because this is not a coastline.",
    coordinates: group.outer,
    holes: group.holes,
    sources: [
      {
        name: "Wikipedia settlement-control markers",
        url: "https://en.wikipedia.org/wiki/Module:Russo-Ukrainian_war_detailed_map",
        note: "CC BY-SA. The shade is calculated from those markers.",
      },
    ],
  }));
}

function orient(ring, positive) {
  const area = ringArea(ring);
  if (area > 0 !== positive) return [...ring].reverse();
  return ring;
}

function pointInRing(ring, point) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const hit = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + 0.0000001) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function traceMask(filled, lng0, lat0, step) {
  const adj = new Map();
  const add = (a, b) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  };
  const corner = (i, j) => `${i},${j}`;
  for (const key of filled) {
    const [i, j] = key.split(",").map(Number);
    const north = filled.has(`${i},${j + 1}`);
    const south = filled.has(`${i},${j - 1}`);
    const west = filled.has(`${i - 1},${j}`);
    const east = filled.has(`${i + 1},${j}`);
    if (!north) add(corner(i, j + 1), corner(i + 1, j + 1));
    if (!south) add(corner(i, j), corner(i + 1, j));
    if (!west) add(corner(i, j), corner(i, j + 1));
    if (!east) add(corner(i + 1, j), corner(i + 1, j + 1));
  }
  const used = new Set();
  const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const parse = (key) => key.split(",").map(Number);
  const loops = [];
  for (const [start, neighbors] of adj) {
    for (const next of neighbors) {
      const firstKey = edgeKey(start, next);
      if (used.has(firstKey)) continue;
      used.add(firstKey);
      const loop = [start];
      let prev = start;
      let current = next;
      let guard = 0;
      while (current !== start && guard < 8000) {
        guard += 1;
        loop.push(current);
        const options = (adj.get(current) || []).filter((candidate) => !used.has(edgeKey(current, candidate)));
        if (!options.length) break;
        const incoming = { x: parse(current)[0] - parse(prev)[0], y: parse(current)[1] - parse(prev)[1] };
        options.sort((left, right) => turn(incoming, current, right) - turn(incoming, current, left));
        const chosen = options[0];
        used.add(edgeKey(current, chosen));
        prev = current;
        current = chosen;
      }
      if (loop.length < 4) continue;
      const ring = loop.map((key) => {
        const [i, j] = parse(key);
        return [lng0 + i * step, lat0 + j * step];
      });
      ring.push(ring[0]);
      const area = ringArea(ring);
      if (Math.abs(area) < 0.04) continue;
      loops.push(area < 0 ? ring : ring.reverse());
    }
  }
  return loops;
}

function turn(incoming, currentKey, nextKey) {
  const [cx, cy] = currentKey.split(",").map(Number);
  const [nx, ny] = nextKey.split(",").map(Number);
  const cross = incoming.x * (ny - cy) - incoming.y * (nx - cx);
  const dot = incoming.x * (nx - cx) + incoming.y * (ny - cy);
  return Math.atan2(cross, dot);
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function snapToRivers(anchors, rivers) {
  if (!rivers.length) return;
  for (const anchor of anchors) {
    if (anchor.kind !== "midpoint" || !anchor.ukr || !anchor.rus) continue;
    let best = null;
    for (const river of rivers) {
      for (const line of river.lines) {
        for (let i = 1; i < line.length; i += 1) {
          const start = { lng: line[i - 1][0], lat: line[i - 1][1] };
          const end = { lng: line[i][0], lat: line[i][1] };
          const hit = closestOnSegment(anchor, start, end);
          if (!hit || hit.km > 6) continue;
          const sideA = sideOf(anchor.ukr, start, end);
          const sideB = sideOf(anchor.rus, start, end);
          if (sideA === 0 || sideB === 0 || sideA === sideB) continue;
          if (!best || hit.km < best.km) best = { ...hit, name: river.name };
        }
      }
    }
    if (!best) continue;
    anchor.lat = best.lat;
    anchor.lng = best.lng;
    anchor.river = best.name;
  }
}

function sideOf(point, start, end) {
  const cross = (end.lng - start.lng) * (point.lat - start.lat) - (end.lat - start.lat) * (point.lng - start.lng);
  if (Math.abs(cross) < 1e-7) return 0;
  return cross > 0 ? 1 : -1;
}

function closestOnSegment(point, start, end) {
  const dx = end.lng - start.lng;
  const dy = end.lat - start.lat;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return null;
  let t = ((point.lng - start.lng) * dx + (point.lat - start.lat) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const lat = start.lat + t * dy;
  const lng = start.lng + t * dx;
  return { lat, lng, km: km(point, { lat, lng }) };
}

function buildIndex(points, cell) {
  const map = new Map();
  for (const point of points) {
    const key = `${Math.floor(point.lng / cell)},${Math.floor(point.lat / cell)}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(point);
  }
  return { map, cell };
}

function nearbyPoints(index, origin, radiusKm) {
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180)));
  const i0 = Math.floor((origin.lng - dLng) / index.cell);
  const i1 = Math.floor((origin.lng + dLng) / index.cell);
  const j0 = Math.floor((origin.lat - dLat) / index.cell);
  const j1 = Math.floor((origin.lat + dLat) / index.cell);
  const found = [];
  for (let i = i0; i <= i1; i += 1) {
    for (let j = j0; j <= j1; j += 1) {
      const bucket = index.map.get(`${i},${j}`);
      if (!bucket) continue;
      for (const point of bucket) {
        if (km(point, origin) <= radiusKm) found.push(point);
      }
    }
  }
  return found;
}

function nearestWithin(index, origin, radiusKm) {
  let best = null;
  for (const point of nearbyPoints(index, origin, radiusKm)) {
    const dist = km(point, origin);
    if (best == null || dist < best) best = dist;
  }
  return best;
}

function gabrielPairs(rusPoints, index) {
  const pairs = [];
  for (const held of rusPoints) {
    for (const opposite of nearbyPoints(index, held, 34)) {
      if (opposite.side !== "ukr") continue;
      const dist = km(held, opposite);
      if (dist > 34 || dist < 0.5) continue;
      const mid = midpoint(held, opposite);
      const radius = dist / 2;
      const blocked = nearbyPoints(index, mid, radius).some((point) => {
        if (point === held || point === opposite) return false;
        return km(point, mid) < radius - 0.2;
      });
      if (blocked) continue;
      pairs.push({ ukr: opposite, rus: held, km: dist });
    }
  }
  return pairs;
}

function linkAnchors(anchors, towns) {
  const degree = new Array(anchors.length).fill(0);
  const edges = [];
  const consider = (maxKm, bridge) => {
    const candidates = [];
    for (let i = 0; i < anchors.length; i += 1) {
      for (let j = i + 1; j < anchors.length; j += 1) {
        if (degree[i] >= 2 || degree[j] >= 2) continue;
        const dist = km(anchors[i], anchors[j]);
        if (dist > maxKm || dist < 0.4) continue;
        if (crossesTown(anchors[i], anchors[j], towns)) continue;
        if (dist > 12 && !bridgeSitsOnContact(anchors[i], anchors[j], towns)) continue;
        candidates.push({ i, j, d: dist, bridge });
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const candidate of candidates) {
      if (degree[candidate.i] >= 2 || degree[candidate.j] >= 2) continue;
      const crosses = edges.some((edge) =>
        segmentsCross(anchors[edge.i], anchors[edge.j], anchors[candidate.i], anchors[candidate.j]),
      );
      if (crosses) continue;
      edges.push(candidate);
      degree[candidate.i] += 1;
      degree[candidate.j] += 1;
    }
  };
  consider(20, false);
  consider(32, true);
  return edges;
}

function bridgeSitsOnContact(a, b, towns) {
  const mid = midpoint(a, b);
  let russian = Infinity;
  let ukrainian = Infinity;
  for (const town of towns) {
    const dist = km(town, mid);
    if (dist > 25) continue;
    if (town.side === "ukr") ukrainian = Math.min(ukrainian, dist);
    else russian = Math.min(russian, dist);
  }
  return russian < 16 && ukrainian < 16 && Math.abs(russian - ukrainian) < 9;
}

function segmentsCross(a, b, c, d) {
  const orient = (p, q, r) => (q.lng - p.lng) * (r.lat - p.lat) - (q.lat - p.lat) * (r.lng - p.lng);
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function crossesTown(a, b, towns) {
  const owned = new Set([a.ukr, a.rus, a.con, b.ukr, b.rus, b.con].filter(Boolean));
  for (const town of towns) {
    if (owned.has(town)) continue;
    const hit = closestOnSegment(town, a, b);
    if (hit && hit.km < CROSS_TOWN_KM && hit.km < km(town, a) - 0.2 && hit.km < km(town, b) - 0.2) return true;
  }
  return false;
}

function dedupeAnchors(anchors, withinKm) {
  const kept = [];
  const sorted = [...anchors].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "contested" ? -1 : 1;
    return a.contactKm - b.contactKm;
  });
  for (const anchor of sorted) {
    if (kept.some((other) => km(other, anchor) < withinKm)) continue;
    kept.push(anchor);
  }
  return kept;
}

function nearest(origin, points) {
  let best = null;
  for (const point of points) {
    const dist = km(origin, point);
    if (!best || dist < best.km) best = { point, km: dist };
  }
  return best;
}

function midpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

function direction(from, to) {
  if (!from || !to) return { lng: 0.2, lat: 0 };
  return { lng: to.lng - from.lng, lat: to.lat - from.lat };
}

function normalize(vector) {
  const len = Math.hypot(vector.lng, vector.lat) || 1;
  return { lng: vector.lng / len, lat: vector.lat / len };
}

function km(a, b) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function writePreview(flot, points) {
  const project = (lng, lat) => [(lng - 29) * 42, (53.2 - lat) * 42];
  const parts = [];
  parts.push(`<rect width="560" height="460" fill="#f4efe4"/>`);
  for (const area of flot.areas) {
    const d = area.coordinates.map(([lng, lat]) => project(lng, lat).join(",")).join(" ");
    parts.push(`<polygon points="${d}" fill="#8a4b32" fill-opacity="0.28" stroke="none"/>`);
  }
  for (const segment of flot.segments) {
    const [a, b] = segment.coordinates.map(([lng, lat]) => project(lng, lat));
    const dash = segment.confidence === "interpolated" ? ' stroke-dasharray="4 3"' : "";
    parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#1c1915" stroke-width="1.4"${dash}/>`);
  }
  for (const point of points.filter((item) => item.inTheater)) {
    const [x, y] = project(point.lng, point.lat);
    const fill = point.side === "ukr" ? "#2f5d8a" : point.side === "rus" ? "#8a4b32" : "#c47b00";
    parts.push(`<circle cx="${x}" cy="${y}" r="1.5" fill="${fill}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="460">${parts.join("")}</svg>`;
  fs.writeFileSync("/tmp/flot-preview.svg", svg);
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(thisFile)) {
  const root = path.resolve(path.dirname(thisFile), "..");
  const flot = await buildFlot(root);
  const cacheDir = path.join(root, "data", "cache");
  const modules = fs
    .readdirSync(cacheDir)
    .filter((name) => name.endsWith(".lua"))
    .map((name) => ({ title: name, text: fs.readFileSync(path.join(cacheDir, name), "utf8") }));
  writePreview(flot, parseModules(modules));
  console.log("Preview /tmp/flot-preview.svg");
}
