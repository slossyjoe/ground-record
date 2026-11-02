import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import {
  baseMarkers,
  clusterStories,
  extractSituation,
  gazaOutline,
  loadGazetteer,
  mergeSituation,
  placeMarkersFor,
  referenceGroups,
  wikipediaFigures,
} from "./real-data.mjs";
import { refreshUkraineMedia } from "./fetch-media.mjs";
import { buildFlot } from "./build-flot.mjs";
import { buildUnits } from "./build-units.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const UA = "GroundRecord/0.1 (local conflict tracker; educational; contact: local-owner)";
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
});

function loadEnv() {
  const file = path.join(root, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
}

function writeJson(relative, value) {
  const full = path.join(root, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(value, null, 2) + "\n");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "User-Agent": UA, Accept: "application/json, application/xml, text/xml, */*", ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(options.timeout ?? 25000),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}`);
    error.status = response.status;
    error.body = text.slice(0, 240);
    throw error;
  }
  return text;
}

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return asText(value[0]);
  if (typeof value === "object") {
    return asText(value["#text"] ?? value.__cdata ?? value.href ?? value.url ?? "");
  }
  return "";
}

function stripHtml(value) {
  return asText(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x27;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text, max = 280) {
  if (!text || text.length <= max) return text || "";
  const slice = text.slice(0, max);
  const space = slice.lastIndexOf(" ");
  return `${(space > 80 ? slice.slice(0, space) : slice).trim()}…`;
}

function parseWhen(value) {
  const raw = asText(value);
  if (!raw) return null;
  const gdelt = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (gdelt) {
    const date = new Date(Date.UTC(+gdelt[1], +gdelt[2] - 1, +gdelt[3], +gdelt[4], +gdelt[5], +gdelt[6]));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function canonicalUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "fbclid") parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function hashId(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function matchesConflict(text, terms) {
  return terms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (term.includes(" ")) return new RegExp(escaped, "i").test(text);
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(text);
  });
}

const STOP = new Set("the a an of and to in on for with as at by from after over into its it be is are was were says said say new news that this their his her they will has have been not but or amid about more than after before during under out up who what when where which while".split(" "));

function tokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOP.has(word)),
  );
}

function similar(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return { score: union ? shared / union : 0, shared };
}

function mostlyLatin(title) {
  const letters = title.match(/[A-Za-z]/g)?.length ?? 0;
  return letters >= 18 || letters / Math.max(title.length, 1) > 0.45;
}

function itemsFromXml(xml) {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item;
  const rdf = doc?.["rdf:RDF"]?.item;
  const atom = doc?.feed?.entry;
  const raw = rssItems ?? rdf ?? atom ?? [];
  return (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
}

async function fetchFeed(feed) {
  try {
    const xml = await fetchText(feed.url);
    if (!/<(rss|feed|rdf:RDF)\b/i.test(xml)) {
      return { feed, status: "response was not a feed", items: [] };
    }
    const items = itemsFromXml(xml)
      .map((item) => {
        const title = stripHtml(item.title);
        const url = asText(item.link ?? item.guid ?? item.id);
        if (!title || !url.startsWith("http")) return null;
        return {
          title,
          url: canonicalUrl(url),
          publishedAt: parseWhen(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"] ?? item.date),
          excerpt: clip(stripHtml(item.description ?? item.summary ?? item["content:encoded"] ?? "")),
          outlet: feed.name,
          outletType: feed.type,
          side: feed.side || "",
          country: feed.country,
          onlyConflicts: feed.conflicts || null,
          via: "RSS",
        };
      })
      .filter(Boolean);
    return { feed, status: "ok", items };
  } catch (error) {
    return { feed, status: error.message || "failed", items: [] };
  }
}

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

async function fetchWikipedia(conflict) {
  const cachePath = path.join("data", "cache", "wikipedia", `${conflict.id}.json`);
  const full = path.join(root, cachePath);
  if (fs.existsSync(full)) {
    const cached = JSON.parse(fs.readFileSync(full, "utf8"));
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < 3 * 24 * 60 * 60 * 1000) return { status: "cached", background: cached };
  }
  const title = encodeURIComponent(conflict.wikipediaTitle.replace(/ /g, "_"));
  try {
    const body = await fetchText(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { "Api-User-Agent": UA },
    });
    const data = JSON.parse(body);
    const background = {
      origin: "live",
      title: data.title || conflict.wikipediaTitle,
      description: data.description || "",
      extract: clip(data.extract || "", 900),
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${title}`,
      license: "Wikipedia text is available under CC BY-SA 4.0",
      fetchedAt: new Date().toISOString(),
      verification: "single-source",
      claimedBy: "Wikipedia contributors",
    };
    writeJson(cachePath, background);
    return { status: "ok", background };
  } catch (error) {
    return { status: error.message || "failed", background: null };
  }
}

function gdeltCacheFile(query) {
  return path.join(root, "data", "cache", "gdelt", `${hashId(query)}.json`);
}

function readGdeltCache(query) {
  const file = gdeltCacheFile(query);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeGdeltCache(query, record) {
  const file = gdeltCacheFile(query);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record));
}

async function waitForGdeltSlot() {
  const stamp = path.join(root, "data", "cache", "gdelt-last.txt");
  let last = 0;
  if (fs.existsSync(stamp)) last = Number(fs.readFileSync(stamp, "utf8")) || 0;
  const wait = 8000 - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  fs.mkdirSync(path.dirname(stamp), { recursive: true });
  fs.writeFileSync(stamp, String(Date.now()));
}

function gdeltItems(articles) {
  return articles
    .map((article) => {
      const title = stripHtml(article.title);
      const link = asText(article.url);
      if (!title || !link.startsWith("http") || !mostlyLatin(title)) return null;
      const language = asText(article.language);
      if (language && !/^(english|en|eng)$/i.test(language)) return null;
      return {
        title,
        url: canonicalUrl(link),
        publishedAt: parseWhen(article.seendate),
        excerpt: "",
        outlet: asText(article.domain) || "GDELT source",
        outletType: "Web source via GDELT",
        country: asText(article.sourcecountry) || "",
        via: "GDELT",
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

async function fetchGdelt(conflict) {
  const query = conflict.gdeltQuery;
  const cached = readGdeltCache(query);
  const freshFor = cached?.ok ? 12 * 60 * 60 * 1000 : 20 * 60 * 1000;
  if (cached && Date.now() - cached.fetchedAt < freshFor) {
    return { status: `${cached.status} (cached)`, items: cached.items || [] };
  }
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", "15");
  url.searchParams.set("format", "json");
  url.searchParams.set("timespan", "14d");
  let lastError = "not requested";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await waitForGdeltSlot();
    try {
      const body = await fetchText(url);
      const data = JSON.parse(body);
      const articles = Array.isArray(data.articles) ? data.articles : [];
      const items = gdeltItems(articles);
      const status = !articles.length
        ? "ok, no articles in the 14-day window"
        : items.length
          ? `ok, ${items.length} kept`
          : "ok, articles were not kept as English";
      writeGdeltCache(query, { fetchedAt: Date.now(), ok: true, status, items });
      return { status, items };
    } catch (error) {
      lastError = error.body ? `${error.message}: ${error.body}` : error.message || "fetch failed";
      if (error.status === 429 || /fetch failed|rate/i.test(lastError)) {
        await sleep(15000);
        continue;
      }
      break;
    }
  }
  writeGdeltCache(query, { fetchedAt: Date.now(), ok: false, status: lastError, items: [] });
  return { status: lastError, items: [] };
}

async function acledToken() {
  const email = process.env.ACLED_EMAIL;
  const password = process.env.ACLED_PASSWORD;
  if (!email || !password) return { token: null, status: "not configured" };
  const body = new URLSearchParams({
    username: email,
    password,
    grant_type: "password",
    client_id: "acled",
    scope: "authenticated",
  });
  try {
    const text = await fetchText("https://acleddata.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = JSON.parse(text);
    if (!data.access_token) return { token: null, status: "login answered without a token" };
    return { token: data.access_token, status: "ok" };
  } catch (error) {
    return { token: null, status: `login failed: ${error.message}` };
  }
}

async function fetchAcled(conflict, token) {
  if (!token) return { status: "not configured", events: [] };
  if (!conflict.acledCountries?.length) return { status: "no country set", events: [] };
  const url = new URL("https://acleddata.com/api/acled/read");
  url.searchParams.set("_format", "json");
  url.searchParams.set("country", conflict.acledCountries.join("|"));
  url.searchParams.set("year", String(new Date().getUTCFullYear()));
  url.searchParams.set("limit", "40");
  url.searchParams.set(
    "fields",
    "event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|location|admin1|latitude|longitude|fatalities|notes|source",
  );
  try {
    const text = await fetchText(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = JSON.parse(text);
    const rows = data.data || data.results || [];
    const cutoff = Date.now() - 21 * 24 * 60 * 60 * 1000;
    const events = (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const when = parseWhen(row.event_date);
        if (when && new Date(when).getTime() < cutoff) return null;
        const lat = Number(row.latitude);
        const lng = Number(row.longitude);
        const fatalities = Number(row.fatalities);
        return {
          id: `acled-${row.event_id_cnty || hashId(JSON.stringify(row))}`,
          origin: "live",
          dataset: "ACLED",
          date: when,
          title: [row.event_type, row.sub_event_type].filter(Boolean).join(" — ") || "ACLED event",
          detail: clip(stripHtml(row.notes || ""), 420),
          location: [row.location, row.admin1].filter(Boolean).join(", "),
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          fatalities: Number.isFinite(fatalities) ? fatalities : null,
          verification: "single-source",
          claimedBy: "ACLED",
          sources: [
            {
              name: row.source ? `ACLED, citing ${row.source}` : "ACLED",
              url: "https://acleddata.com/",
              publishedAt: when,
              note: "One dataset’s coding of an event. Not a confirmed total.",
              kind: "dataset",
            },
          ],
        };
      })
      .filter(Boolean)
      .slice(0, 15);
    return { status: events.length ? `ok, ${events.length} in the last 21 days` : "ok, none in the last 21 days", events };
  } catch (error) {
    return { status: error.message || "failed", events: [] };
  }
}

async function fetchReliefWeb(conflict, appname) {
  if (!appname) return { status: "not configured", items: [] };
  try {
    const text = await fetchText(`https://api.reliefweb.int/v2/reports?appname=${encodeURIComponent(appname)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: { value: conflict.reliefwebQuery, operator: "AND" },
        limit: 8,
        profile: "list",
        sort: ["date:desc"],
      }),
    });
    const data = JSON.parse(text);
    const items = (data.data || [])
      .map((row) => {
        const fields = row.fields || {};
        const title = stripHtml(fields.title);
        const url = asText(fields.url);
        if (!title || !url.startsWith("http")) return null;
        const source = Array.isArray(fields.source) ? fields.source[0]?.name : fields.source?.name;
        return {
          title,
          url: canonicalUrl(url),
          publishedAt: parseWhen(fields.date?.created),
          excerpt: "",
          outlet: source || "ReliefWeb",
          outletType: "Humanitarian information service",
          country: "",
          via: "ReliefWeb",
        };
      })
      .filter(Boolean);
    return { status: `ok, ${items.length} reports`, items };
  } catch (error) {
    return { status: error.message || "failed", items: [] };
  }
}

async function fetchUcdp(conflict, token) {
  if (!token) return { status: "not configured", events: [] };
  const versions = ["25.1", "24.1"];
  let last = "not requested";
  for (const version of versions) {
    try {
      const text = await fetchText(`https://ucdpapi.pcr.uu.se/api/gedevents/${version}?pagesize=50`, {
        headers: { "x-ucdp-access-token": token },
      });
      const data = JSON.parse(text);
      const rows = data.Result || data.result || data.data || [];
      const names = new Set(conflict.acledCountries.map((name) => name.toLowerCase()));
      const events = (Array.isArray(rows) ? rows : [])
        .filter((row) => {
          const country = String(row.country || row.country_name || "").toLowerCase();
          return !names.size || names.has(country) || conflict.acledCountries.some((name) => country.includes(name.toLowerCase()));
        })
        .slice(0, 10)
        .map((row) => {
          const lat = Number(row.latitude);
          const lng = Number(row.longitude);
          const fatalities = Number(row.best ?? row.deaths_a + row.deaths_b + row.deaths_civilians);
          return {
            id: `ucdp-${row.id || hashId(JSON.stringify(row))}`,
            origin: "live",
            dataset: "UCDP",
            date: parseWhen(row.date_start || row.year),
            title: row.type_of_violence_name || "UCDP event",
            detail: clip(stripHtml(row.source_article || row.where_description || ""), 420),
            location: [row.where_coordinates, row.adm_1].filter(Boolean).join(", "),
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
            fatalities: Number.isFinite(fatalities) ? fatalities : null,
            verification: "single-source",
            claimedBy: "UCDP",
            sources: [
              {
                name: "Uppsala Conflict Data Program",
                url: "https://ucdp.uu.se/",
                note: "A research dataset. Not a same-day confirmed total.",
                kind: "dataset",
              },
            ],
          };
        });
      return { status: `ok via ${version}, ${events.length} matched`, events };
    } catch (error) {
      last = `${version}: ${error.message}`;
    }
  }
  return { status: last, events: [] };
}

function withIds(clusters) {
  return clusters.map((cluster) => ({
    ...cluster,
    id: hashId(`${cluster.url}|${cluster.title}`),
  }));
}

function outletCounts(headlines) {
  const map = new Map();
  for (const item of headlines) {
    const current = map.get(item.outlet) || { name: item.outlet, outletType: item.outletType, count: 0 };
    current.count += 1;
    map.set(item.outlet, current);
  }
  return [...map.values()].sort((left, right) => right.count - left.count);
}

async function mediazonaGroup() {
  try {
    const html = await fetchText("https://en.zona.media/article/2026/10/23/casualties_eng-trl");
    const description = html.match(/property="og:description" content="([^"]+)"/) || html.match(/og:description" content="([^"]+)"/);
    const method = html.match(/name="description" content="([^"]+)"/);
    if (!description) return [];
    return [
      {
        id: "mediazona-named",
        topic: "Named Russian military deaths",
        summary:
          "This is Mediazona’s published description of its named list, made with BBC Russian. It is not an official total and not the Ukrainian General Staff figure.",
        claims: [
          {
            id: "mediazona-named-claim",
            text: `Mediazona’s page says: “${description[1]}”. ${method ? method[1] : "Each name is checked against open sources. The list is not complete."}`,
            claimedBy: "Mediazona and the BBC Russian service",
            partyId: "ru",
            verification: "single-source",
            origin: "reference",
            sources: [
              {
                name: "Mediazona: How many Russian soldiers died in the war with Ukraine",
                url: "https://en.zona.media/article/2026/10/23/casualties_eng-trl",
                note: "Quoted from the page description. The full name-by-name list is not copied.",
                kind: "reference",
              },
            ],
          },
        ],
      },
    ];
  } catch (error) {
    console.log("Mediazona:", error.message);
    return [];
  }
}

async function main() {
  loadEnv();
  const allConflicts = readJson("data/conflicts.json");
  const conflicts = process.env.UPDATE_ALL === "1" ? allConflicts : allConflicts.filter((item) => item.listed !== false);
  console.log(`Updating ${conflicts.map((item) => item.name).join(", ") || "no listed conflicts"}. Set UPDATE_ALL=1 to refresh parked wars.`);
  if (conflicts.some((item) => item.id === "russia-ukraine")) {
    try {
      await refreshUkraineMedia(root);
    } catch (error) {
      console.log("GeoConfirmed:", error.message);
    }
  }
  const feeds = readJson("data/feeds.json");
  console.log(`Fetching ${feeds.length} feeds…`);
  const feedResults = await pool(feeds, 4, fetchFeed);
  const allItems = feedResults.flatMap((result) => result.items);
  console.log(`Feeds done. ${allItems.length} items before matching.`);
  console.log("Loading place coordinates from Wikipedia…");
  const gazetteer = await loadGazetteer(root, fetchText);
  const gazaShape = await gazaOutline(fetchText);
  if (gazaShape) console.log("Gaza Strip outline is ready.");

  const reliefName = process.env.RELIEFWEB_APPNAME || "";
  const ucdpToken = process.env.UCDP_ACCESS_TOKEN || "";
  const acled = await acledToken();
  if (acled.status !== "not configured") console.log(`ACLED: ${acled.status === "ok" ? "signed in" : acled.status}`);

  const date = new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();
  const manifest = {
    generatedAt,
    date,
    optional: {
      acled: acled.status,
      reliefweb: reliefName ? "configured" : "not configured",
      ucdp: ucdpToken ? "configured" : "not configured",
    },
    feeds: feedResults.map((result) => ({
      name: result.feed.name,
      status: result.status,
      items: result.items.length,
    })),
    conflicts: {},
  };

  for (const conflict of conflicts) {
    console.log(`Sources: ${conflict.name}`);
    const gdelt = await fetchGdelt(conflict);
    const wiki = await fetchWikipedia(conflict);
    await sleep(400);
    const figures = await wikipediaFigures(conflict, fetchText);
    await sleep(400);
    const relief = await fetchReliefWeb(conflict, reliefName);
    const acledEvents = await fetchAcled(conflict, acled.token);
    const ucdp = await fetchUcdp(conflict, ucdpToken);
    const sample = readJson(path.join("data", "baselines", `${conflict.id}.json`));
    const places = gazetteer[conflict.id] || [];
    const matched = allItems.filter((item) => {
      if (item.onlyConflicts && !item.onlyConflicts.includes(conflict.id)) return false;
      return matchesConflict(item.title, conflict.matchTerms);
    });
    const combined = [...matched, ...gdelt.items, ...relief.items];
    const seen = new Set();
    const unique = [];
    for (const item of combined) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      unique.push(item);
    }
    unique.sort((left, right) => {
      const a = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const b = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return b - a;
    });
    const headlines = withIds(clusterStories(unique.slice(0, 50), places));
    const extracted = extractSituation(conflict, headlines, places);
    const bases = baseMarkers(conflict.id, gazetteer);
    const basePins = bases
      .filter((base) => base.lat != null)
      .map((base) => ({
        id: `${base.id}-pin`,
        kind: "reference",
        origin: "reference",
        lat: base.lat,
        lng: base.lng,
        title: base.name,
        detail: base.text,
        partyId: null,
        weaponType: null,
        verification: "single-source",
        claimedBy: "Wikipedia",
        sources: base.sources,
      }));
    const baseline = mergeSituation(sample, extracted, {
      referenceClaims: [
        ...referenceGroups(figures.claims || []),
        ...(conflict.id === "russia-ukraine" ? await mediazonaGroup() : []),
      ],
      referenceUnits: [...(figures.units || []), ...bases.map(({ lat, lng, ...unit }) => unit)],
      placeMarkers: [...placeMarkersFor(conflict.id, gazetteer, headlines), ...basePins],
      shapes: conflict.id === "gaza-lebanon" && gazaShape ? [gazaShape] : [],
    });
    const datasetEvents = [...acledEvents.events, ...ucdp.events];
    const feedNotes = feedResults
      .filter((result) => result.status !== "ok")
      .map((result) => `${result.feed.name}: ${result.status}`);
    feedNotes.push(
      `Extracted from headlines: ${extracted.casualtyGroups.length} casualty groups, ${extracted.weapons.length} weapon lines, ${extracted.territory.length} territory lines, ${extracted.movements.length} movement lines, ${extracted.markers.length} mapped places.`,
    );
    const report = {
      conflictId: conflict.id,
      date,
      background: wiki.background,
      headlines,
      outletCounts: outletCounts(headlines),
      datasetEvents,
      baseline,
      pull: {
        generatedAt,
        date,
        matchedArticles: headlines.length,
        gdelt: gdelt.status,
        wikipedia: wiki.status,
        acled: acledEvents.status,
        reliefweb: relief.status,
        ucdp: ucdp.status,
        feedNotes,
      },
    };
    writeJson(path.join("data", "reports", date, `${conflict.id}.json`), report);
    writeJson(path.join("data", "reports", "latest", `${conflict.id}.json`), report);
    manifest.conflicts[conflict.id] = {
      headlines: headlines.length,
      gdelt: gdelt.status,
      wikipedia: wiki.status,
    };
    console.log(`  ${headlines.length} headlines · GDELT ${gdelt.status} · Wikipedia ${wiki.status}`);
  }

  writeJson(path.join("data", "reports", "manifest.json"), manifest);
  console.log("Saved daily reports.");
  try {
    await buildFlot(root);
  } catch (error) {
    console.log("Front line was not refreshed:", error instanceof Error ? error.message : error);
  }
  try {
    buildUnits(root);
  } catch (error) {
    console.log("Unit markers were not refreshed:", error instanceof Error ? error.message : error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
