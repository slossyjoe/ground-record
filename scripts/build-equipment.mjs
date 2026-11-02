import fs from "node:fs";
import path from "node:path";

const UA = "GroundRecord/0.1 (educational; Wikipedia CC BY-SA; equipment catalog)";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SYSTEMS = [
  { id: "t-90", name: "T-90", category: "Main battle tank", operators: "Russia", page: "T-90", aliases: ["T-90M", "T-90MS", "T-90A", "T-90S", "T-90 Proryv", "Proryv", "T-90"] },
  { id: "t-72", name: "T-72", category: "Main battle tank", operators: "Russia", page: "T-72", aliases: ["T-72B3", "T-72B", "T-72A", "T-72"] },
  { id: "t-80", name: "T-80", category: "Main battle tank", operators: "Russia", page: "T-80", aliases: ["T-80BVM", "T-80BV", "T-80U", "T-80"] },
  { id: "bmp-3", name: "BMP-3", category: "Infantry fighting vehicle", operators: "Russia", page: "BMP-3", aliases: ["BMP-3"] },
  { id: "bmp-2", name: "BMP-2", category: "Infantry fighting vehicle", operators: "Russia", page: "BMP-2", aliases: ["BMP-2"] },
  { id: "btr-82", name: "BTR-82A", category: "Armored personnel carrier", operators: "Russia", page: "BTR-80", aliases: ["BTR-82A", "BTR-82"] },
  { id: "ka-52", name: "Ka-52", category: "Attack helicopter", operators: "Russia", page: "Kamov Ka-52", aliases: ["Ka-52", "Kamov Ka-52", "Alligator"] },
  { id: "su-34", name: "Su-34", category: "Strike aircraft", operators: "Russia", page: "Sukhoi Su-34", aliases: ["Su-34", "Sukhoi Su-34"] },
  { id: "su-25", name: "Su-25", category: "Ground-attack aircraft", operators: "Russia", page: "Sukhoi Su-25", aliases: ["Su-25", "Sukhoi Su-25"] },
  { id: "lancet", name: "Lancet", category: "Loitering munition", operators: "Russia", page: "ZALA Lancet", aliases: ["Lancet-3", "Lancet"] },
  { id: "shahed", name: "Shahed-136", category: "One-way attack drone", operators: "Russia (as Geran-2); designed in Iran", page: "HESA Shahed 136", aliases: ["Shahed-136", "Shahed 136", "Geran-2", "Geran 2"] },
  { id: "iskander", name: "Iskander", category: "Short-range ballistic missile", operators: "Russia", page: "9K720 Iskander", aliases: ["Iskander-M", "Iskander"] },
  { id: "grad", name: "BM-21 Grad", category: "Multiple rocket launcher", operators: "Russia and Ukraine", page: "BM-21 Grad", aliases: ["BM-21", "Grad"] },
  { id: "tos-1", name: "TOS-1", category: "Heavy flamethrower system", operators: "Russia", page: "TOS-1", aliases: ["TOS-1A", "TOS-1"] },
  { id: "s-400", name: "S-400", category: "Long-range air-defense system", operators: "Russia", page: "S-400 missile system", aliases: ["S-400"] },
  { id: "orlan", name: "Orlan-10", category: "Reconnaissance drone", operators: "Russia", page: "Orlan-10", aliases: ["Orlan-10", "Orlan 10"] },
  { id: "kinzhal", name: "Kh-47M2 Kinzhal", category: "Air-launched ballistic missile", operators: "Russia", page: "Kh-47M2 Kinzhal", aliases: ["Kinzhal", "Kh-47M2"] },
  { id: "leopard-2", name: "Leopard 2", category: "Main battle tank", operators: "Ukraine (supplied); designed in Germany", page: "Leopard 2", aliases: ["Leopard 2A6", "Leopard 2A4", "Leopard 2"] },
  { id: "abrams", name: "M1 Abrams", category: "Main battle tank", operators: "Ukraine (supplied); designed in the United States", page: "M1 Abrams", aliases: ["M1A1", "M1 Abrams", "Abrams"] },
  { id: "bradley", name: "M2 Bradley", category: "Infantry fighting vehicle", operators: "Ukraine (supplied); designed in the United States", page: "M2 Bradley", aliases: ["M2A2", "Bradley", "M2 Bradley"] },
  { id: "himars", name: "M142 HIMARS", category: "Rocket artillery", operators: "Ukraine (supplied); designed in the United States", page: "M142 HIMARS", aliases: ["HIMARS", "M142"] },
  { id: "m777", name: "M777", category: "Towed howitzer", operators: "Ukraine (supplied)", page: "M777 howitzer", aliases: ["M777"] },
  { id: "javelin", name: "FGM-148 Javelin", category: "Anti-tank missile", operators: "Ukraine (supplied)", page: "FGM-148 Javelin", aliases: ["Javelin", "FGM-148"] },
  { id: "nlaw", name: "NLAW", category: "Anti-tank weapon", operators: "Ukraine (supplied)", page: "NLAW", aliases: ["NLAW"] },
  { id: "tb2", name: "Bayraktar TB2", category: "Armed drone", operators: "Ukraine", page: "Bayraktar TB2", aliases: ["Bayraktar TB2", "TB2", "Bayraktar"] },
  { id: "storm-shadow", name: "Storm Shadow", category: "Air-launched cruise missile", operators: "Ukraine (supplied)", page: "Storm Shadow", aliases: ["Storm Shadow", "SCALP-EG", "SCALP"] },
  { id: "atacms", name: "ATACMS", category: "Tactical ballistic missile", operators: "Ukraine (supplied)", page: "ATACMS", aliases: ["ATACMS", "MGM-140"] },
  { id: "patriot", name: "MIM-104 Patriot", category: "Air-defense system", operators: "Ukraine (supplied)", page: "MIM-104 Patriot", aliases: ["Patriot", "MIM-104"] },
  { id: "caesar", name: "CAESAR", category: "Truck-mounted howitzer", operators: "Ukraine (supplied); designed in France", page: "CAESAR self-propelled howitzer", aliases: ["CAESAR"] },
  { id: "f-16", name: "F-16", category: "Multirole fighter", operators: "Ukraine (supplied)", page: "General Dynamics F-16 Fighting Falcon", aliases: ["F-16", "Fighting Falcon"] },
  { id: "challenger-2", name: "Challenger 2", category: "Main battle tank", operators: "Ukraine (supplied); designed in the United Kingdom", page: "Challenger 2", aliases: ["Challenger 2"] },
];

const SPEC_KEYS = [
  ["crew", "Crew"],
  ["mass", "Weight"],
  ["weight", "Weight"],
  ["length", "Length"],
  ["width", "Width"],
  ["height", "Height"],
  ["armour", "Armor"],
  ["armor", "Armor"],
  ["primary_armament", "Main armament"],
  ["main_armament", "Main armament"],
  ["armament", "Armament"],
  ["secondary_armament", "Secondary armament"],
  ["engine", "Engine"],
  ["operational_range", "Range"],
  ["vehicle_range", "Range"],
  ["range", "Range"],
  ["maximum_speed", "Speed"],
  ["speed", "Speed"],
  ["guidance", "Guidance"],
  ["guidance_system", "Guidance"],
  ["warhead", "Warhead"],
  ["wingspan", "Wingspan"],
  ["payload", "Payload"],
  ["unit_cost", "Reported unit cost"],
];

function stripWiki(input) {
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
  return output
    .replace(/<ref[\s\S]*?<\/ref>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldsFrom(wikitext) {
  const fields = {};
  let key = null;
  const buffer = [];
  const flush = () => {
    if (!key) return;
    const text = stripWiki(buffer.join(" ")).replace(/&nbsp;/g, " ").replace(/\}\}/g, " ").replace(/\s+/g, " ").trim();
    if (text) fields[key] = text.slice(0, 180);
    key = null;
    buffer.length = 0;
  };
  for (const line of String(wikitext).split("\n")) {
    const match = line.match(/^\|\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      flush();
      key = match[1].toLowerCase();
      buffer.push(match[2]);
    } else if (key) {
      const trimmed = line.trim();
      if (/^(The |A |An |'''|==)/.test(trimmed)) flush();
      else buffer.push(line);
    }
  }
  flush();
  return fields;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function one(system) {
  const page = encodeURIComponent(system.page.replace(/ /g, "_"));
  let summary = null;
  let wikitext = "";
  try {
    summary = JSON.parse(
      await fetchText(`https://en.wikipedia.org/api/rest_v1/page/summary/${page}`),
    );
  } catch (error) {
    console.log("  summary fail", system.id, error.message);
  }
  await sleep(1200);
  try {
    const parsed = JSON.parse(
      await fetchText(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${page}&prop=wikitext&section=0&format=json`,
      ),
    );
    wikitext = parsed?.parse?.wikitext?.["*"] || "";
  } catch (error) {
    console.log("  infobox fail", system.id, error.message);
  }
  const fields = fieldsFrom(wikitext);
  const wanted = ["Crew", "Weight", "Main armament", "Armament", "Armor", "Speed", "Range", "Guidance", "Warhead", "Engine", "Wingspan", "Payload"];
  const specs = [];
  const seen = new Set();
  for (const [key, label] of SPEC_KEYS) {
    if (!fields[key] || seen.has(label)) continue;
    if (!wanted.includes(label) && label !== "Secondary armament" && label !== "Length" && label !== "Reported unit cost") continue;
    seen.add(label);
    specs.push({ label, value: fields[key] });
  }
  for (const label of wanted) {
    if (!specs.some((spec) => spec.label === label)) specs.push({ label, value: "Unknown" });
  }
  const article = summary?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${page}`;
  return {
    id: system.id,
    name: system.name,
    category: system.category,
    operators: system.operators,
    aliases: system.aliases,
    summary: summary?.extract ? summary.extract.slice(0, 420) : "Unknown. The Wikipedia summary was not retrieved.",
    image: summary?.thumbnail?.source
      ? {
          url: summary.thumbnail.source,
          page: article,
          attribution:
            "Thumbnail from the Wikipedia summary. The file’s author and exact license are on the article’s image file page. Article text is CC BY-SA 4.0.",
        }
      : null,
    specs,
    sources: [{ name: `Wikipedia: ${summary?.title || system.page}`, url: article }],
  };
}

const file = path.join(process.cwd(), "data", "equipment.json");
const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
const good = new Set(
  previous
    .filter((entry) =>
      entry.specs?.some(
        (spec) =>
          ["Main armament", "Crew", "Range", "Armament"].includes(spec.label) &&
          spec.value !== "Unknown" &&
          !spec.value.includes("The "),
      ),
    )
    .map((entry) => entry.id),
);
const out = [...previous];
for (const system of SYSTEMS) {
  if (good.has(system.id)) {
    console.log("keep", system.id);
    continue;
  }
  console.log("fetch", system.id);
  const built = await one(system);
  const index = out.findIndex((entry) => entry.id === system.id);
  if (index >= 0) out[index] = built;
  else out.push(built);
  await sleep(7000);
}
fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log("wrote", out.length);
