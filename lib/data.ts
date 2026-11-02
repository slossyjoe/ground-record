import fs from "fs";
import path from "path";
import type {
  Baseline,
  Conflict,
  DailyReport,
  Feed,
  FlotEstimate,
  Manifest,
  MediaPin,
  PlacedUnit,
} from "./types";

const root = process.cwd();

function readJson<T>(relativePath: string): T {
  const full = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

export function getConflicts(): Conflict[] {
  return readJson<Conflict[]>("data/conflicts.json");
}

export function getListedConflicts(): Conflict[] {
  return getConflicts().filter((conflict) => conflict.listed !== false);
}

export function getConflict(id: string): Conflict | undefined {
  return getConflicts().find((conflict) => conflict.id === id);
}

export function getFeeds(): Feed[] {
  return readJson<Feed[]>("data/feeds.json");
}

export function getBaseline(id: string): Baseline | null {
  const relative = path.join("data", "baselines", `${id}.json`);
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return null;
  return readJson<Baseline>(relative);
}

export function reportDates(): string[] {
  const dir = path.join(root, "data", "reports");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort()
    .reverse();
}

export function getReport(id: string, date?: string | null): DailyReport | null {
  const relative = date
    ? path.join("data", "reports", date, `${id}.json`)
    : path.join("data", "reports", "latest", `${id}.json`);
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return null;
  return readJson<DailyReport>(relative);
}

export function getFlot(id: string): FlotEstimate | null {
  if (id !== "russia-ukraine") return null;
  const relative = path.join("data", "flot", "ukraine.json");
  if (!fs.existsSync(path.join(root, relative))) return null;
  return readJson<FlotEstimate>(relative);
}

export function getUnits(id: string): PlacedUnit[] {
  if (id !== "russia-ukraine") return [];
  const relative = path.join("data", "units", "ukraine.json");
  if (!fs.existsSync(path.join(root, relative))) return [];
  const saved = readJson<{ units?: PlacedUnit[] }>(relative);
  return saved.units || [];
}

export function getMedia(id: string): MediaPin[] {
  if (id !== "russia-ukraine") return [];
  const relative = path.join("data", "media", "ukraine.json");
  const full = path.join(root, relative);
  if (!fs.existsSync(full)) return [];
  const saved = readJson<{ items?: MediaPin[] }>(relative);
  return saved.items || [];
}

export function getManifest(): Manifest | null {
  const relative = path.join("data", "reports", "manifest.json");
  if (!fs.existsSync(path.join(root, relative))) return null;
  return readJson<Manifest>(relative);
}

export function fallbackReport(conflict: Conflict): DailyReport {
  const baseline = getBaseline(conflict.id);
  const emptyBaseline: Baseline = {
    notes: {},
    movements: [],
    casualtyGroups: [],
    units: [],
    territory: [],
    weapons: [],
    casualtyTrend: null,
    markers: [],
    shapes: [],
  };
  return {
    conflictId: conflict.id,
    date: new Date().toISOString().slice(0, 10),
    background: null,
    headlines: [],
    outletCounts: [],
    datasetEvents: [],
    baseline: baseline ?? emptyBaseline,
    pull: {
      generatedAt: "",
      date: "",
      matchedArticles: 0,
      gdelt: "not run",
      wikipedia: "not run",
      acled: "not run",
      reliefweb: "not run",
      ucdp: "not run",
      feedNotes: [
        "No daily pull has been saved yet. Run node scripts/run.mjs to fetch open sources.",
      ],
    },
  };
}
