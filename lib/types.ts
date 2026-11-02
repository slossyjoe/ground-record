export type Origin = "live" | "sample" | "reference";

export type Verification =
  | "multi-source"
  | "single-source"
  | "disputed"
  | "unverified";

export type ConflictStatus = "active" | "armistice";

export type Source = {
  name: string;
  url?: string | null;
  publishedAt?: string | null;
  note?: string | null;
  kind?: string | null;
};

export type Party = {
  id: string;
  name: string;
  color: string;
};

export type Conflict = {
  id: string;
  name: string;
  status: ConflictStatus;
  statusLabel: string;
  region: string;
  started: string;
  blurb: string;
  complexityNote: string;
  parties: Party[];
  center: { lat: number; lng: number };
  zoom: number;
  wikipediaTitle: string;
  matchTerms: string[];
  gdeltQuery: string;
  reliefwebQuery: string;
  acledCountries: string[];
  /** When false, the war stays in the data files but is not shown on the public site. */
  listed?: boolean;
  inclusion: {
    text: string;
    sourceName: string;
    sourceUrl: string;
  };
};

export type Claim = {
  id: string;
  text: string;
  claimedBy: string;
  partyId?: string | null;
  verification: Verification;
  origin: Origin;
  sources: Source[];
  low?: number | null;
  high?: number | null;
  unit?: string | null;
  area?: string | null;
};

export type ClaimGroup = {
  id: string;
  topic: string;
  summary?: string | null;
  claims: Claim[];
};

export type UnitRecord = {
  id: string;
  name: string;
  partyId?: string | null;
  area: string;
  text: string;
  claimedBy: string;
  verification: Verification;
  origin: Origin;
  sources: Source[];
};

export type WeaponRecord = {
  id: string;
  weaponType: string;
  name: string;
  partyId?: string | null;
  area: string;
  text: string;
  claimedBy: string;
  verification: Verification;
  origin: Origin;
  sources: Source[];
};

export type MapMarker = {
  id: string;
  kind: "unit" | "clash" | "strike" | "weapon" | "reference" | "event";
  origin: Origin;
  lat: number;
  lng: number;
  title: string;
  detail: string;
  partyId?: string | null;
  weaponType?: string | null;
  verification: Verification;
  claimedBy: string;
  sources: Source[];
};

export type MapShape = {
  id: string;
  kind: "control" | "front" | "outline" | "line";
  origin: Origin;
  partyId?: string | null;
  title: string;
  detail: string;
  verification: Verification;
  claimedBy: string;
  sources: Source[];
  /** Line: [lng, lat][]. Polygon: one ring, [lng, lat][]. */
  coordinates: number[][];
};

export type TrendPoint = {
  date: string;
  values: { id: string; label: string; partyId?: string | null; low: number; high: number }[];
};

export type CasualtyTrend = {
  origin: "sample";
  unit: string;
  caption: string;
  points: TrendPoint[];
};

export type Baseline = {
  notes: {
    movements?: string;
    casualties?: string;
    units?: string;
    territory?: string;
    weapons?: string;
  };
  movements: Claim[];
  casualtyGroups: ClaimGroup[];
  units: UnitRecord[];
  territory: ClaimGroup[];
  weapons: WeaponRecord[];
  casualtyTrend: CasualtyTrend | null;
  markers: MapMarker[];
  shapes: MapShape[];
};

export type Headline = {
  id: string;
  title: string;
  url: string;
  outlet: string;
  outletType: string;
  side?: string;
  country: string;
  publishedAt: string | null;
  excerpt: string;
  via: string;
  verification: Verification;
  origin: "live";
  alsoReportedBy: { outlet: string; url: string }[];
};

export type DatasetEvent = {
  id: string;
  origin: "live";
  dataset: "ACLED" | "UCDP";
  date: string | null;
  title: string;
  detail: string;
  location: string;
  lat: number | null;
  lng: number | null;
  fatalities: number | null;
  verification: "single-source";
  claimedBy: string;
  sources: Source[];
};

export type MediaPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  place: string;
  mediaType: "photo" | "video" | "other";
  /** Calendar date from GeoConfirmed. Not a filming clock time. */
  eventDate: string | null;
  recordedTimeKnown: false;
  postedAt: null;
  geolocatedAt: null;
  timeNote: string;
  originalUrls: string[];
  geolocationUrl: string | null;
  verifiedBy: string;
  confidence: "geolocated";
  filedUnder: string;
};

export type OutletCount = {
  name: string;
  outletType: string;
  count: number;
};

export type PullLog = {
  generatedAt: string;
  date: string;
  matchedArticles: number;
  gdelt: string;
  wikipedia: string;
  acled: string;
  reliefweb: string;
  ucdp: string;
  feedNotes: string[];
};

export type Background = {
  origin: "live";
  title: string;
  description: string;
  extract: string;
  url: string;
  license: string;
  fetchedAt: string;
  verification: "single-source";
  claimedBy: string;
} | null;

export type DailyReport = {
  conflictId: string;
  date: string;
  background: Background;
  headlines: Headline[];
  outletCounts: OutletCount[];
  datasetEvents: DatasetEvent[];
  baseline: Baseline;
  pull: PullLog;
};

export type Manifest = {
  generatedAt: string;
  date: string;
  optional: {
    acled: string;
    reliefweb: string;
    ucdp: string;
  };
  feeds: { name: string; status: string; items: number }[];
  conflicts: Record<string, { headlines: number; gdelt: string; wikipedia: string }>;
};

export type Feed = {
  id: string;
  name: string;
  type: string;
  country: string;
  url: string;
};

export type FlotEvidence = {
  kind: string;
  name?: string;
  side?: string;
  section?: string;
  lat?: number;
  lng?: number;
  url?: string | null;
  text: string;
  outlet?: string;
  publishedAt?: string | null;
};

export type FlotSegment = {
  id: string;
  confidence: "evidenced" | "interpolated";
  dash: number[] | null;
  lengthKm: number;
  coordinates: number[][];
  title: string;
  detail: string;
  evidence: FlotEvidence[];
  sources: Source[];
};

export type FlotArea = {
  id: string;
  partyId: string;
  title: string;
  detail: string;
  coordinates: number[][];
  holes?: number[][][];
  sources: Source[];
};

export type FlotContested = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  section: string;
  url: string;
};

export type FlotEstimate = {
  id: string;
  asOf: string;
  fetchedAt: string;
  history: null;
  timelineNote: string;
  summary: string;
  accuracy: string;
  sources: Source[];
  riversUsed: string[];
  counts: Record<string, number>;
  segments: FlotSegment[];
  areas: FlotArea[];
  contested: FlotContested[];
};

export type PlacedUnit = {
  id: string;
  name: string;
  partyId: string;
  sidc: string;
  branch: string;
  typeLabel: string;
  echelon: string;
  parent: string | null;
  lat: number;
  lng: number;
  place: string;
  reportedOn: string | null;
  recordedTimeKnown: false;
  confidence: "single-source";
  confidenceNote: string;
  caption: string;
  sources: Source[];
};
