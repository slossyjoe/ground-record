/**
 * Unit markers only where a source names the unit at a geolocated scene.
 * A unit that is only said to have fired at a place is not given that place as its position.
 */
import fs from "node:fs";
import path from "node:path";
import ms from "milsymbol";

const SIDC = {
  infantry: "UCI---",
  marine: "UCIN--",
  mechanized: "UCIZ--",
  armor: "UCA---",
  artillery: "UCF---",
  airborne: "UCIA--",
  recon: "UCR---",
  generic: "UC----",
};

const ECHELON = {
  Battalion: "F",
  Regiment: "G",
  Brigade: "H",
  Division: "I",
};

export function buildUnits(root) {
  const mediaPath = path.join(root, "data", "media", "ukraine.json");
  const outPath = path.join(root, "data", "units", "ukraine.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const media = fs.existsSync(mediaPath) ? JSON.parse(fs.readFileSync(mediaPath, "utf8")).items || [] : [];
  const units = [];
  for (const item of media) {
    for (const placement of placementsFor(item)) {
      const code = sidc(placement.partyId, placement.branch, placement.echelon);
      const symbol = new ms.Symbol(code, { size: 32 });
      if (!symbol.isValid()) throw new Error(`Invalid SIDC ${code}`);
      units.push({
        id: `${item.id}-${units.length + 1}`,
        name: placement.name,
        partyId: placement.partyId,
        sidc: code,
        branch: placement.branch,
        typeLabel: placement.typeLabel,
        echelon: placement.echelon,
        parent: placement.parent,
        lat: item.lat,
        lng: item.lng,
        place: placement.place,
        reportedOn: item.eventDate,
        recordedTimeKnown: false,
        confidence: "single-source",
        confidenceNote: placement.note,
        caption: item.title,
        sources: [
          {
            name: "GeoConfirmed",
            url: item.geolocationUrl,
            publishedAt: item.eventDate,
            note: "Geolocation post. The card date is not a filming clock time.",
          },
          ...(item.originalUrls || []).slice(0, 2).map((url) => ({
            name: "Original post linked by GeoConfirmed",
            url,
            publishedAt: null,
            note: "The footage stays on this post. It is not stored here.",
          })),
        ],
      });
    }
  }
  const saved = {
    asOf: new Date().toISOString().slice(0, 10),
    note: "Each marker is a unit named in geolocated footage. The coordinate is the footage point from GeoConfirmed, not a headquarters and not a guessed garrison. Units that are only described as shelling or striking a target are omitted, because the pin is the target.",
    units,
  };
  fs.writeFileSync(outPath, JSON.stringify(saved, null, 2));
  console.log(`Units placed: ${units.length}. ${units.map((unit) => unit.name).join("; ") || "none"}`);
  return saved;
}

function sidc(partyId, branch, echelon) {
  const frame = partyId === "ua" ? "F" : "H";
  const func = SIDC[branch] || SIDC.generic;
  const mark = ECHELON[echelon] || "-";
  return `S${frame}GP${func}-${mark}---`;
}

function placementsFor(item) {
  const title = item.title || "";
  const found = [];
  if (/actually filming in Myrnohrad/i.test(title)) {
    found.push(unit({
      name: "177th Separate Guards Marine Infantry Regiment",
      partyId: "ru",
      branch: "marine",
      typeLabel: "Marine infantry",
      echelon: "Regiment",
      parent: null,
      place: "Myrnohrad",
      note: "GeoConfirmed says this regiment’s footage was filmed in Myrnohrad, not in Dobropillia as the footage claimed. The coordinate is that geolocation. It is the camera’s scene, not a headquarters.",
    }));
  }
  if (/39nd Marine Brigade/i.test(title) && /Kupiansk/i.test(title)) {
    found.push(unit({
      name: "39nd Marine Brigade",
      partyId: "ua",
      branch: "marine",
      typeLabel: "Marine infantry",
      echelon: "Brigade",
      parent: null,
      place: "Kupiansk",
      note: "The caption, kept as written, names the “39nd Marine Brigade” in a drone attack in Kupiansk. GeoConfirmed locates the footage there. This is the scene in the footage, not a headquarters.",
    }));
  }
  if (/Russian 3rd Division/i.test(title) && /3rd Assault Brigade/i.test(title)) {
    found.push(unit({
      name: "Russian 3rd Division",
      partyId: "ru",
      branch: "generic",
      typeLabel: "Ground unit",
      echelon: "Division",
      parent: null,
      place: "Geolocated footage, town not named",
      note: "The description names the Russian 3rd Division as observing an assault at this GeoConfirmed coordinate. It does not name the town, and it does not say this is the division’s base. The symbol is a generic ground unit because the caption does not give a branch.",
    }));
    found.push(unit({
      name: "3rd Assault Brigade",
      partyId: "ua",
      branch: "infantry",
      typeLabel: "Infantry",
      echelon: "Brigade",
      parent: null,
      place: "Geolocated footage, town not named",
      note: "The same description says the assault was “reportedly from the 3rd Assault Brigade.” The coordinate is the footage point. The symbol is infantry because the caption says assault brigade and does not name a vehicle type. This is not a headquarters.",
    }));
  }
  if (/filming in|filmed in/i.test(title) && found.length === 0) {
    const named = title.match(/(\d+(?:st|nd|rd|th)?\s+[A-Za-z][\w’'-]*(?:\s+[A-Za-z][\w’'-]*){0,6}\s+(?:Brigade|Regiment|Battalion|Division))/);
    const place = title.match(/film(?:ing|ed)\s+in\s+([A-Z][\w’'-]+)/);
    if (named && place) {
      const echelon = named[1].match(/Brigade|Regiment|Battalion|Division/)[0];
      found.push(unit({
        name: named[1],
        partyId: /Russian|Guards/i.test(title) ? "ru" : "ua",
        branch: /Marine/i.test(named[1]) ? "marine" : /Tank|Armor|Armour/i.test(named[1]) ? "armor" : "infantry",
        typeLabel: /Marine/i.test(named[1]) ? "Marine infantry" : "Infantry",
        echelon,
        parent: null,
        place: place[1],
        note: `The caption says this unit was filming in ${place[1]}, and GeoConfirmed locates the footage at this coordinate. This is the camera’s scene, not a headquarters.`,
      }));
    }
  }
  return found;
}

function unit(fields) {
  return fields;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  buildUnits(path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."));
}
