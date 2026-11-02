import fs from "node:fs";
import path from "node:path";

const UA = "GroundRecord/0.1 (local conflict tracker; educational)";

export const PLACES = {
  "russia-ukraine": [
    ["Kyiv", "Kyiv"],
    ["Kiev", "Kyiv"],
    ["Kharkiv", "Kharkiv"],
    ["Donetsk", "Donetsk"],
    ["Luhansk", "Luhansk"],
    ["Zaporizhzhia", "Zaporizhzhia"],
    ["Kherson", "Kherson"],
    ["Odesa", "Odesa"],
    ["Odessa", "Odesa"],
    ["Dnipro", "Dnipro"],
    ["Sumy", "Sumy"],
    ["Chernihiv", "Chernihiv"],
    ["Pokrovsk", "Pokrovsk,_Ukraine"],
    ["Bakhmut", "Bakhmut"],
    ["Kupiansk", "Kupiansk"],
    ["Oleshky", "Oleshky"],
    ["Mariupol", "Mariupol"],
    ["Crimea", "Crimea"],
    ["Sevastopol", "Sevastopol"],
    ["Moldova", "Moldova"],
  ],
  "gaza-lebanon": [
    ["Gaza", "Gaza_City"],
    ["Rafah", "Rafah"],
    ["Khan Younis", "Khan_Yunis"],
    ["Jabalia", "Jabalia"],
    ["Deir al-Balah", "Deir_al-Balah"],
    ["Hebron", "Hebron"],
    ["West Bank", "West_Bank"],
    ["Tyre", "Tyre,_Lebanon"],
    ["Beirut", "Beirut"],
    ["southern Lebanon", "Southern_Lebanon"],
  ],
  sudan: [
    ["Khartoum", "Khartoum"],
    ["Omdurman", "Omdurman"],
    ["El Fasher", "El_Fasher"],
    ["El Obeid", "El_Obeid"],
    ["Nyala", "Nyala"],
    ["Port Sudan", "Port_Sudan"],
    ["Wad Madani", "Wad_Madani"],
    ["Darfur", "Darfur"],
    ["Kordofan", "Kordofan"],
  ],
  myanmar: [
    ["Yangon", "Yangon"],
    ["Mandalay", "Mandalay"],
    ["Naypyidaw", "Naypyidaw"],
    ["Sittwe", "Sittwe"],
    ["Rakhine", "Rakhine_State"],
    ["Sagaing", "Sagaing_Region"],
    ["Lashio", "Lashio"],
    ["Myitkyina", "Myitkyina"],
    ["Nawnghio", "Nawnghkio"],
  ],
  sahel: [
    ["Bamako", "Bamako"],
    ["Ouagadougou", "Ouagadougou"],
    ["Niamey", "Niamey"],
    ["Gao", "Gao"],
    ["Mopti", "Mopti"],
  ],
  "drc-east": [
    ["Goma", "Goma"],
    ["Bukavu", "Bukavu"],
    ["Beni", "Beni,_Democratic_Republic_of_the_Congo"],
    ["North Kivu", "North_Kivu"],
    ["Ituri", "Ituri_Province"],
  ],
  "yemen-red-sea": [
    ["Sanaa", "Sanaa"],
    ["Aden", "Aden"],
    ["Al Hudaydah", "Al_Hudaydah"],
    ["Hodeidah", "Al_Hudaydah"],
    ["Taiz", "Taiz"],
    ["al-Jawf", "Al_Jawf_Governorate"],
  ],
  korea: [
    ["Pyongyang", "Pyongyang"],
    ["Seoul", "Seoul"],
    ["Panmunjom", "Joint_Security_Area"],
  ],
  somalia: [
    ["Mogadishu", "Mogadishu"],
    ["Kismayo", "Kismayo"],
    ["Garowe", "Garowe"],
  ],
  ethiopia: [
    ["Addis Ababa", "Addis_Ababa"],
    ["Bahir Dar", "Bahir_Dar"],
    ["Amhara", "Amhara_Region"],
    ["Oromia", "Oromia"],
  ],
  "syria-spillover": [
    ["Damascus", "Damascus"],
    ["Aleppo", "Aleppo"],
    ["Idlib", "Idlib"],
    ["Suwayda", "As-Suwayda"],
  ],
  "iran-war": [
    ["Tehran", "Tehran"],
    ["Isfahan", "Isfahan"],
    ["Natanz", "Natanz"],
    ["Bandar Abbas", "Bandar_Abbas"],
    ["Hormuz", "Strait_of_Hormuz"],
  ],
  nigeria: [
    ["Maiduguri", "Maiduguri"],
    ["Abuja", "Abuja"],
    ["Zamfara", "Zamfara_State"],
    ["Kaduna", "Kaduna"],
    ["Borno", "Borno_State"],
  ],
  haiti: [
    ["Port-au-Prince", "Port-au-Prince"],
    ["Cap-Haïtien", "Cap-Haïtien"],
    ["Artibonite", "Artibonite_(department)"],
  ],
  "afghanistan-pakistan": [
    ["Kabul", "Kabul"],
    ["Kandahar", "Kandahar"],
    ["Peshawar", "Peshawar"],
    ["Quetta", "Quetta"],
    ["Torkham", "Torkham"],
    ["Khyber", "Khyber_Pakhtunkhwa"],
  ],
};

const BASE_PAGES = [
  ["Sevastopol Naval Base", "russia-ukraine"],
  ["Kulbakino Air Base", "russia-ukraine"],
  ["Wadi Seidna Air Base", "sudan"],
  ["Mingaladon Air Base", "myanmar"],
];

const WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
};

const STOP = new Set(
  "the a an of and to in on for with as at by from after over into its it be is are was were says said say new news that this their his her they will has have been not but or amid about more than after before during under out up who what when where which while after over into from with".split(
    " ",
  ),
);

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function tokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOP.has(word)),
  );
}

function similar(left, right) {
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return { score: union ? shared / union : 0, shared };
}

function parseNum(raw) {
  const value = Number(String(raw).replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return value;
}

export function findPlace(title, places) {
  const ordered = [...(places || [])].sort((a, b) => b.name.length - a.name.length);
  for (const place of ordered) {
    const escaped = place.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i");
    if (re.test(title)) return place;
  }
  return null;
}

function numbersIn(title) {
  const found = new Set();
  for (const match of title.matchAll(/\d[\d,]*/g)) {
    const value = parseNum(match[0]);
    if (value != null && value >= 2) found.add(value);
  }
  return found;
}

function casualtyFigure(title) {
  const patterns = [
    /(?:up to|at least|more than|over|nearly|about)\s+(\d[\d,]*)\s+(servicemen|soldiers|troops|personnel|people|civilians|fighters|children)/i,
    /(\d[\d,]*)\s+(servicemen|soldiers|troops|personnel|people|civilians|fighters|children)\b[^.]{0,24}?\b(killed|dead|wounded|injured)/i,
    /\b(killed|kills|dead|deaths|wounded|injured)\b[^.]{0,30}?(?:at least|up to|more than|over|nearly)?\s*(\d[\d,]*)/i,
    /casualty toll[^.]{0,60}?(\d[\d,]*)/i,
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)\b[^.]{0,40}?\b(killed|dead|injured|wounded)/i,
    /\b(kills|killed)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen)\b/i,
    /(\d[\d,]*)\s+injured\b/i,
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (!match) continue;
    const numToken = match.slice(1).find((part) => part && (/^\d/.test(part) || WORDS[part.toLowerCase()]));
    if (!numToken) continue;
    const value = WORDS[numToken.toLowerCase()] ?? parseNum(numToken);
    if (value == null) continue;
    const lower = title.toLowerCase();
    const at = lower.indexOf(String(numToken).toLowerCase());
    const prefix = lower.slice(Math.max(0, at - 16), Math.max(0, at));
    const capped = /up to|nearly|about/.test(prefix);
    const atLeast = /at least|more than|over/.test(prefix);
    const qualifier = atLeast ? "the headline says at least this" : capped ? "the headline says up to this" : "as written in the headline";
    return {
      low: value,
      high: value,
      unit: `people; ${qualifier}`,
    };
  }
  return null;
}

function weaponFigure(title) {
  const match = title.match(
    /(?:nearly|over|about|up to)?\s*(\d[\d,]*)\s+(?:of\s+(\d[\d,]*)\s+)?(?:attack\s+|guided\s+|russian\s+|more\s+)?(drones|drone|missiles|missile|bombs|bomb|rockets|rocket|ships|ship|tanks|tank)/i,
  );
  if (!match) return null;
  const value = parseNum(match[1]);
  const total = match[2] ? parseNum(match[2]) : null;
  if (value == null) return null;
  return { value, total, noun: match[3].toLowerCase() };
}

export function categoryOf(title) {
  const text = title.toLowerCase();
  if (/\b(award|summit|heroin|cocaine|gdp|innovative technolog|patriarch)\b/.test(text)) return null;
  if (/\bworld news in brief\b/.test(text)) return null;
  if (/\b(kills?|killed|dead|deaths|died|wounded|wounds|injured|injures|casualt(?:y|ies)|servicemen|personnel)\b/.test(text)) {
    const profile = /\b(wounded|injured)\b/.test(text) && !/\d/.test(text) && !/\b(attack|strike|shell|drone|missile|killed|dead|deaths)\b/.test(text);
    if (!profile) return "casualty";
  }
  if (/\b(captured|seized|seizes|recaptured|liberated|took control|lost control|expand control|under control)\b/.test(text)) return "territory";
  if (/\b(advanced|advance|withdrew|withdraws|redeployed|offensive)\b/.test(text)) return "movement";
  if (/\b(drones?|missiles?|bombs?|rockets?|artillery|airstrikes?|air strikes?|air raids?|shells?|warships?|ships?|tanks?)\b/.test(text)) return "weapon";
  if (/\b(strike|attack|shelling|clash|fighting|gunfire|airspace)\b/.test(text)) return "strike";
  return null;
}

function claimant(title, outlet) {
  const dash = title.match(/[–—]\s*([^–—]{3,60})$/);
  if (dash) return dash[1].trim();
  const says = title.match(/\b([A-Z][\w.’'-]+(?:\s+[A-Z][\w.’'-]+){0,2})\s+(?:says|said|reports|reported)\b/);
  if (says) return says[1];
  const say = title.match(/\b([A-Za-z][A-Za-z\s]{2,40}?)\s+say\b/);
  if (say) return say[1].trim();
  return outlet;
}

function partyIdFor(text, parties) {
  const hay = text.toLowerCase();
  for (const party of parties || []) {
    const bits = party.name.toLowerCase().split(/\s+/).filter((bit) => bit.length > 3);
    if (bits.some((bit) => hay.includes(bit))) return party.id;
  }
  return null;
}

function namedUnit(title) {
  const pattern =
    /\b([A-Z][A-Za-z’'-]+(?:\s+[A-Z][A-Za-z’'-]+){0,3})\s+(Army|Navy|Brigade|Battalion|Regiment|Division|Guard)\b/g;
  const skip = new Set(["Russian", "Ukrainian", "Israeli", "Sudanese", "Myanmar", "Syrian", "Haitian", "Nigerian", "Armed", "Civil", "National"]);
  for (const match of title.matchAll(pattern)) {
    if (!skip.has(match[1])) return `${match[1]} ${match[2]}`;
  }
  return null;
}

function sourcesFor(cluster) {
  const rows = [
    {
      name: cluster.outlet,
      url: cluster.url,
      publishedAt: cluster.publishedAt,
      note: cluster.outletType,
      kind: "article",
    },
    ...((cluster.related?.length ? cluster.related : cluster.alsoReportedBy) || []).map((item) => ({
      name: item.outlet,
      url: item.url,
      publishedAt: item.publishedAt,
      note: item.outletType,
      kind: "article",
    })),
  ];
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.url)) return false;
    seen.add(row.url);
    return true;
  });
}

export function clusterStories(items, places) {
  const enriched = items.map((item) => ({
    ...item,
    tokenSet: tokens(item.title),
    place: findPlace(item.title, places)?.name || "",
    nums: numbersIn(item.title),
  }));
  const used = new Set();
  const groups = [];
  for (let index = 0; index < enriched.length; index += 1) {
    if (used.has(index)) continue;
    const group = [enriched[index]];
    used.add(index);
    for (let other = index + 1; other < enriched.length; other += 1) {
      if (used.has(other)) continue;
      if (sameStory(enriched[index], enriched[other])) {
        group.push(enriched[other]);
        used.add(other);
      }
    }
    groups.push(group);
  }
  return groups.map((group) => {
    const [primary, ...rest] = group;
    const outlets = new Set(group.map((item) => item.outlet));
    return {
      ...primary,
      verification: outlets.size > 1 ? "multi-source" : "single-source",
      origin: "live",
      alsoReportedBy: rest.slice(0, 6).map((item) => ({ outlet: item.outlet, url: item.url })),
      related: rest.map((item) => ({
        title: item.title,
        outlet: item.outlet,
        url: item.url,
        outletType: item.outletType,
        publishedAt: item.publishedAt,
      })),
    };
  });
}

function sameStory(left, right) {
  const sim = similar(left.tokenSet, right.tokenSet);
  const sharedNums = [...left.nums].filter((value) => right.nums.has(value));
  if (left.nums.size && right.nums.size && sharedNums.length === 0) return false;
  if (left.outlet === right.outlet) return sim.score >= 0.62 && sim.shared >= 4;
  if (sim.shared >= 4 && sim.score >= 0.28) return true;
  if (sim.shared >= 3 && sim.score >= 0.34) return true;
  if (left.place && left.place === right.place && sharedNums.length && sim.shared >= 1) return true;
  if (left.place && left.place === right.place && sim.shared >= 2 && sim.score >= 0.22) return true;
  return false;
}

export function extractSituation(conflict, clusters, places) {
  const movements = [];
  const casualtyClaims = [];
  const units = [];
  const territory = [];
  const weapons = [];
  const markers = [];

  clusters.forEach((cluster, index) => {
    const kind = categoryOf(cluster.title);
    if (!kind) return;
    const place = findPlace(cluster.title, places);
    const who = claimant(cluster.title, cluster.outlet);
    const sources = sourcesFor(cluster);
    const base = {
      id: `live-${conflict.id}-${index}`,
      text: `“${cluster.title}”`,
      claimedBy: who,
      partyId: partyIdFor(`${who} ${cluster.title}`, conflict.parties),
      verification: cluster.verification,
      origin: "live",
      sources,
      area: place ? place.name : null,
    };
    if (kind === "movement") movements.push(base);
    if (kind === "territory") territory.push(base);
    if (kind === "casualty") {
      const figure = casualtyFigure(cluster.title);
      casualtyClaims.push({
        ...base,
        low: figure?.low ?? figure?.atLeast ?? null,
        high: figure?.high ?? null,
        unit: figure ? figure.unit : null,
      });
    }
    if (kind === "weapon" || kind === "strike") {
      const figure = weaponFigure(cluster.title);
      weapons.push({
        ...base,
        weaponType: weaponType(cluster.title),
        name: figure
        ? `${figure.value.toLocaleString("en-GB")} ${figure.noun} written in the headline`
        : kind === "strike"
          ? "Strike named in a headline"
          : `${weaponType(cluster.title)} mentioned in a headline`,
        low: figure?.value ?? null,
        high: figure?.total ?? figure?.value ?? null,
      });
    }
    const unit = namedUnit(cluster.title);
    if (unit) {
      units.push({
        id: `unit-${conflict.id}-${index}`,
        name: unit,
        partyId: partyIdFor(cluster.title, conflict.parties),
        area: place ? place.name : "Named in a headline, no mapped place",
        text: `The name appears in this headline: “${cluster.title}”`,
        claimedBy: who,
        verification: cluster.verification,
        origin: "live",
        sources,
      });
    }
    if (place?.lat != null && place?.lng != null) {
      markers.push({
        id: `pin-${conflict.id}-${index}`,
        kind: markerKind(kind),
        origin: "live",
        lat: place.lat,
        lng: place.lng,
        title: place.name,
        detail: cluster.title,
        partyId: base.partyId,
        weaponType: kind === "weapon" ? weaponType(cluster.title) : null,
        verification: cluster.verification,
        claimedBy: who,
        sources,
      });
    }
  });

  return {
    movements,
    casualtyGroups: groupClaims(casualtyClaims, "Figures written in headlines"),
    units,
    territory: groupClaims(territory, "Territory language in headlines"),
    weapons,
    markers,
  };
}

function markerKind(kind) {
  if (kind === "weapon") return "weapon";
  if (kind === "strike") return "strike";
  if (kind === "movement") return "unit";
  if (kind === "territory") return "clash";
  return "event";
}

function weaponType(title) {
  const text = title.toLowerCase();
  if (text.includes("drone")) return "drone";
  if (text.includes("missile") || text.includes("rocket")) return "missile";
  if (text.includes("bomb") || text.includes("air")) return "air";
  if (text.includes("ship") || text.includes("naval")) return "naval";
  if (text.includes("tank")) return "armor";
  if (text.includes("artillery") || text.includes("shell")) return "artillery";
  return "other";
}

function groupClaims(claims, topic) {
  if (!claims.length) return [];
  const buckets = new Map();
  for (const claim of claims) {
    const key = claim.area || "place not named";
    const bucket = buckets.get(key) || [];
    bucket.push(claim);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].map(([area, rows], index) => {
    const figures = rows.map((row) => row.low ?? row.high).filter((value) => value != null);
    const distinct = new Set(figures);
    return {
      id: `grp-${index}-${area}`,
      topic: `${topic}: ${area}`,
      summary:
        distinct.size > 1
          ? "These headlines give different figures for the same named place. Both stay. This page does not pick one."
          : "Each line is a headline from this pull. The figure, if shown, is a number written in that headline.",
      claims: rows,
    };
  });
}

export function mergeSituation(baseline, extracted, extras) {
  const referenceClaims = extras.referenceClaims || [];
  const referenceUnits = extras.referenceUnits || [];
  const placeMarkers = extras.placeMarkers || [];
  const extraShapes = extras.shapes || [];
  const liveCasualties = extracted.casualtyGroups.length > 0;
  const notes = { ...baseline.notes };

  const movements = extracted.movements.length ? extracted.movements : baseline.movements;
  if (extracted.movements.length) {
    notes.movements = "Headlines in this pull that describe movement. The words are the headline’s, not a field report written here.";
  }

  const casualtyGroups = [];
  if (referenceClaims.length) casualtyGroups.push(...referenceClaims);
  if (liveCasualties) casualtyGroups.push(...extracted.casualtyGroups);
  if (!referenceClaims.length && !liveCasualties) casualtyGroups.push(...baseline.casualtyGroups);
  if (referenceClaims.length || liveCasualties) {
    notes.casualties =
      "Reference lines are quoted from a Wikipedia infobox. Live lines are headlines. A number is shown only when that source wrote it. Sample ranges are left off this page because a sourced line was found.";
  }

  const units = [...referenceUnits, ...extracted.units];
  const unitList = units.length ? units : baseline.units;
  if (units.length) {
    notes.units =
      "Named units are names that appear in a headline or, when marked Reference, encyclopedia entries for a base. A base pin is not a report that the unit moved.";
  }

  const territory = extracted.territory.length ? extracted.territory : baseline.territory;
  if (extracted.territory.length) {
    notes.territory = "Headlines that use words such as seized, captured, or control. The headline is the claim.";
  }

  const weapons = extracted.weapons.length ? extracted.weapons : baseline.weapons;
  if (extracted.weapons.length) {
    notes.weapons = "Weapon counts are numbers written next to a weapon word in a headline. Nothing was added.";
  }

  const hasLive =
    extracted.movements.length +
      extracted.casualtyGroups.length +
      extracted.units.length +
      extracted.territory.length +
      extracted.weapons.length +
      extracted.markers.length >
    0;
  const markers = [];
  const pushPin = (marker) => {
    if (marker.lat == null || marker.lng == null) return;
    const near = markers.find(
      (existing) =>
        existing.origin === marker.origin &&
        existing.kind === marker.kind &&
        Math.abs(existing.lat - marker.lat) < 0.03 &&
        Math.abs(existing.lng - marker.lng) < 0.03,
    );
    if (near) return;
    markers.push(marker);
  };
  extracted.markers.forEach(pushPin);
  placeMarkers.forEach(pushPin);
  if (!hasLive) baseline.markers.filter((marker) => marker.origin === "sample").forEach(pushPin);
  baseline.markers.filter((marker) => marker.origin === "reference").forEach(pushPin);

  const shapes = [
    ...extraShapes,
    ...baseline.shapes.filter(
      (shape) =>
        shape.origin === "reference" &&
        !(extraShapes.some((item) => item.kind === "outline") && shape.kind === "outline"),
    ),
  ];
  if (!hasLive && !extraShapes.length) {
    shapes.push(...baseline.shapes.filter((shape) => shape.origin === "sample"));
  }

  return {
    ...baseline,
    notes,
    movements,
    casualtyGroups,
    units: unitList,
    territory,
    weapons,
    casualtyTrend: liveCasualties || referenceClaims.length ? null : baseline.casualtyTrend,
    markers,
    shapes,
  };
}

export async function loadGazetteer(root, fetchText) {
  const file = path.join(root, "data", "gazetteer.json");
  const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  let changed = false;
  for (const [conflictId, rows] of Object.entries(PLACES)) {
    saved[conflictId] = saved[conflictId] || [];
    for (const [name, page] of rows) {
      const existing = saved[conflictId].find((place) => place.name === name);
      if (existing?.lat != null) continue;
      const hit = await wikiPoint(page, fetchText);
      const record = {
        name,
        page,
        lat: hit?.lat ?? null,
        lng: hit?.lng ?? null,
        description: hit?.description || "",
        url: `https://en.wikipedia.org/wiki/${page}`,
      };
      if (existing) Object.assign(existing, record);
      else saved[conflictId].push(record);
      changed = true;
      await sleep(350);
    }
  }
  if (!saved.bases) {
    saved.bases = [];
    for (const [page, conflictId] of BASE_PAGES) {
      const hit = await wikiPoint(page, fetchText);
      if (hit && /base|air base|naval/i.test(`${hit.description} ${hit.extract}`)) {
        saved.bases.push({
          name: hit.title || page.replace(/_/g, " "),
          conflictId,
          lat: hit.lat,
          lng: hit.lng,
          description: hit.description,
          url: `https://en.wikipedia.org/wiki/${page}`,
        });
      }
      await sleep(350);
    }
    changed = true;
  }
  if (changed) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(saved, null, 2) + "\n");
  }
  return saved;
}

async function wikiPoint(page, fetchText) {
  try {
    const body = await fetchText(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`, {
      headers: { "Api-User-Agent": UA },
    });
    const data = JSON.parse(body);
    if (!data.coordinates) return null;
    return {
      lat: data.coordinates.lat,
      lng: data.coordinates.lon,
      title: data.title,
      description: data.description || "",
      extract: data.extract || "",
    };
  } catch {
    return null;
  }
}

export function placeMarkersFor(conflictId, gazetteer, headlines) {
  const places = gazetteer[conflictId] || [];
  const mentioned = places.filter((place) => place.lat != null && headlines.some((item) => findPlace(item.title, [place])));
  const chosen = mentioned.length ? mentioned : places.filter((place) => place.lat != null).slice(0, 3);
  return chosen.map((place) => ({
    id: `ref-${conflictId}-${place.name}`,
    kind: "reference",
    origin: "reference",
    lat: place.lat,
    lng: place.lng,
    title: place.name,
    detail: mentioned.length
      ? "A place named in a headline in this pull. The coordinate is the Wikipedia summary coordinate, for orientation. It is not a damage assessment."
      : "A reference city so the map has a landmark. No headline in this pull named it.",
    partyId: null,
    weaponType: null,
    verification: "single-source",
    claimedBy: "Wikipedia place summary",
    sources: [
      {
        name: `Wikipedia: ${place.name}`,
        url: place.url,
        note: "Coordinate from the Wikipedia REST summary. Wikipedia text is CC BY-SA 4.0. The coordinate itself is a gazetteer point.",
        kind: "reference",
      },
    ],
  }));
}

export function baseMarkers(conflictId, gazetteer) {
  return (gazetteer.bases || [])
    .filter((base) => base.conflictId === conflictId && base.lat != null)
    .map((base) => ({
      id: `base-${conflictId}-${base.name}`,
      name: base.name,
      partyId: null,
      area: base.name,
      text: `${base.description || "Listed on Wikipedia as a base."} This is a reference location, not a report of movement or of aircraft operating today.`,
      claimedBy: "Wikipedia",
      verification: "single-source",
      origin: "reference",
      sources: [
        {
          name: `Wikipedia: ${base.name}`,
          url: base.url,
          note: "Encyclopedia location. Not an operational sighting.",
          kind: "reference",
        },
      ],
      lat: base.lat,
      lng: base.lng,
    }));
}

function removeTemplates(input) {
  let text = String(input || "");
  let output = "";
  for (let index = 0; index < text.length; index += 1) {
    if (text.slice(index, index + 2) === "{{") {
      let depth = 1;
      index += 2;
      while (index < text.length && depth > 0) {
        if (text.slice(index, index + 2) === "{{") {
          depth += 1;
          index += 2;
          continue;
        }
        if (text.slice(index, index + 2) === "}}") {
          depth -= 1;
          index += 2;
          continue;
        }
        index += 1;
      }
      index -= 1;
      output += " ";
      continue;
    }
    output += text[index];
  }
  return output;
}

function stripWiki(input) {
  let text = removeTemplates(input);
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ");
  text = text.replace(/<ref[^>]*\/>/gi, " ");
  for (let pass = 0; pass < 6; pass += 1) {
    const next = text.replace(/\{\{[^{}]*\}\}/g, (block) => {
      const inner = block.slice(2, -2);
      const parts = inner.split("|").map((part) => part.trim());
      const last = parts[parts.length - 1] || "";
      if (last.includes("=") && !last.startsWith("http")) return "";
      return last;
    });
    if (next === text) break;
    text = next;
  }
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2");
  text = text.replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/'{2,}/g, "");
  text = text.replace(/<br\s*\/?>/gi, " ");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function infoboxFields(wikitext) {
  const fields = {};
  const lines = String(wikitext || "").split("\n");
  let key = null;
  const buffer = [];
  const flush = () => {
    if (!key) return;
    const raw = buffer.join("\n");
    const bullets = [...raw.matchAll(/(?:^|\n)\s*\*\s*([^\n]+)/g)]
      .map((match) => stripWiki(match[1]))
      .filter((line) => line.length > 3 && /\d|killed|dead|thousand/i.test(line));
    const text = bullets.length ? bullets.join("; ") : stripWiki(raw);
    if (text && /\d|killed|dead|thousand/i.test(text)) fields[key] = text;
    key = null;
    buffer.length = 0;
  };
  for (const line of lines) {
    const match = line.match(/^\|\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      flush();
      const name = match[1].toLowerCase();
      if (/^(casualties\d*|strength\d*|casualties|strength)$/.test(name)) {
        key = name;
        buffer.push(match[2]);
      }
    } else if (key) {
      buffer.push(line);
    }
  }
  flush();
  return fields;
}

export async function wikipediaFigures(conflict, fetchText) {
  const cacheFile = path.join("data", "cache", "infobox", `${conflict.id}.json`);
  const full = path.join(process.cwd(), cacheFile);
  if (fs.existsSync(full)) {
    const cached = JSON.parse(fs.readFileSync(full, "utf8"));
    if (Date.now() - new Date(cached.fetchedAt).getTime() < 7 * 24 * 3600 * 1000) return cached;
  }
  const page = encodeURIComponent(conflict.wikipediaTitle.replace(/ /g, "_"));
  let record = { fetchedAt: new Date().toISOString(), claims: [], units: [] };
  try {
    const body = await fetchText(
      `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=wikitext&section=0&format=json&origin=*`,
    );
    const data = JSON.parse(body);
    const wikitext = data?.parse?.wikitext?.["*"] || "";
    const fields = infoboxFields(wikitext);
    const url = `https://en.wikipedia.org/wiki/${conflict.wikipediaTitle.replace(/ /g, "_")}`;
    for (const key of ["casualties1", "casualties2", "casualties3", "casualties"]) {
      const text = clipField(fields[key]);
      if (!text || text.length < 8) continue;
      record.claims.push({
        id: `wiki-${conflict.id}-${key}`,
        text,
        claimedBy: `Wikipedia infobox, field ${key}`,
        partyId: null,
        verification: "single-source",
        origin: "reference",
        sources: [
          {
            name: `Wikipedia: ${conflict.wikipediaTitle}`,
            url,
            note: "Quoted from the infobox. Wikipedia text is CC BY-SA 4.0. This is not a figure calculated by this app.",
            kind: "reference",
          },
        ],
      });
    }
    for (const key of ["strength1", "strength2", "strength3", "strength"]) {
      const text = clipField(fields[key]);
      if (!text || text.length < 4 || /for details/i.test(text)) continue;
      record.units.push({
        id: `wiki-unit-${conflict.id}-${key}`,
        name: `Wikipedia infobox ${key}`,
        partyId: null,
        area: "Not a mapped location",
        text,
        claimedBy: `Wikipedia infobox, field ${key}`,
        verification: "single-source",
        origin: "reference",
        sources: [
          {
            name: `Wikipedia: ${conflict.wikipediaTitle}`,
            url,
            note: "Quoted from the infobox. Not a sighting from this pull.",
            kind: "reference",
          },
        ],
      });
    }
  } catch (error) {
    record = { fetchedAt: new Date().toISOString(), claims: [], units: [], error: error.message };
  }
  if (!record.error) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify(record, null, 2) + "\n");
  }
  return record;
}

function clipField(text) {
  if (!text) return "";
  if (text.length <= 420) return text;
  return `${text.slice(0, 400).trim()}…`;
}

export async function gazaOutline(fetchText) {
  const file = path.join(process.cwd(), "data", "geometry", "gaza-strip.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const query = `[out:json][timeout:25];relation["boundary"="administrative"]["name"="Gaza Strip"];out geom;`;
  try {
    const body = await fetchText("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: query,
      timeout: 40000,
    });
    const data = JSON.parse(body);
    const relation = (data.elements || []).find((item) => item.type === "relation");
    const outer = (relation?.members || []).filter((member) => member.type === "way" && member.role === "outer" && member.geometry);
    const ring = [];
    for (const way of outer) {
      for (const point of way.geometry) ring.push([point.lon, point.lat]);
    }
    if (ring.length < 8) return null;
    const step = Math.ceil(ring.length / 80);
    const simplified = ring.filter((_, index) => index % step === 0);
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) simplified.push(first);
    const shape = {
      id: "gaza-osm-outline",
      kind: "outline",
      origin: "reference",
      partyId: null,
      title: "Gaza Strip administrative outline",
      detail:
        "A simplified outline of the OpenStreetMap administrative relation named Gaza Strip. It is a geographic boundary for orientation, not a control assessment and not a damage map.",
      verification: "single-source",
      claimedBy: "OpenStreetMap contributors",
      sources: [
        {
          name: "OpenStreetMap administrative relation “Gaza Strip”",
          url: relation?.id
            ? `https://www.openstreetmap.org/relation/${relation.id}`
            : "https://www.openstreetmap.org/",
          note: "© OpenStreetMap contributors, ODbL. Geometry simplified for this page.",
          kind: "reference",
        },
      ],
      coordinates: simplified,
    };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(shape, null, 2) + "\n");
    return shape;
  } catch {
    return null;
  }
}

export function referenceGroups(claims) {
  if (!claims.length) return [];
  return [
    {
      id: "wiki-infobox",
      topic: "Wikipedia infobox",
      summary:
        "Quoted from the Wikipedia infobox. If the infobox gives more than one side’s figure, each field is kept. This page does not turn them into one number.",
      claims,
    },
  ];
}
