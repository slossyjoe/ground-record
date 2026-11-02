"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CompetingClaims, SourceList } from "@/components/claims";
import { EquipmentText } from "@/components/equipment";
import { OriginBadge, VerificationBadge } from "@/components/verification-badge";
import { MapLayers, MapSelection, WarMap } from "@/components/war-map";
import { equipmentCounts, type Equipment } from "@/lib/equipment";
import { formatDay, formatWhen } from "@/lib/utils";
import type { Baseline, Conflict, DailyReport, FlotEstimate, MapMarker, MediaPin, PlacedUnit } from "@/lib/types";

const LAYER_LABELS: { key: keyof MapLayers; label: string }[] = [
  { key: "flot", label: "Front line" },
  { key: "control", label: "Control" },
  { key: "units", label: "Units" },
  { key: "media", label: "Media" },
  { key: "strikes", label: "Strikes" },
];

const LEGEND: { sidc: string; label: string }[] = [
  { sidc: "SFGPUCI----H---", label: "Ukraine infantry brigade" },
  { sidc: "SFGPUCIZ---H---", label: "Mechanized brigade" },
  { sidc: "SFGPUCA----H---", label: "Armor brigade" },
  { sidc: "SFGPUCF----H---", label: "Artillery brigade" },
  { sidc: "SFGPUCIA---H---", label: "Airborne brigade" },
  { sidc: "SFGPUCR----G---", label: "Reconnaissance regiment" },
  { sidc: "SFGPUCIN---H---", label: "Marine infantry brigade" },
  { sidc: "SHGPUCI----H---", label: "Russia infantry brigade" },
  { sidc: "SHGPUCA----I---", label: "Russia armor division" },
  { sidc: "SFGPUCI----F---", label: "Battalion, marked II" },
  { sidc: "SFGPUCI----G---", label: "Regiment, marked III" },
  { sidc: "SFGPUCI----H---", label: "Brigade, marked X" },
];

export function MapDesk({
  conflict,
  report,
  baseline,
  dates,
  activeDate,
  media,
  catalog,
  flot,
  units,
  latestHref,
}: {
  conflict: Conflict;
  report: DailyReport;
  baseline: Baseline;
  dates: string[];
  activeDate: string | null;
  media: MediaPin[];
  catalog: Equipment[];
  flot: FlotEstimate | null;
  units: PlacedUnit[];
  latestHref: string;
}) {
  const [layers, setLayers] = useState<MapLayers>({
    flot: true,
    control: true,
    units: true,
    media: false,
    strikes: true,
  });
  const [panel, setPanel] = useState<"open" | "peek">("open");
  const [tab, setTab] = useState<"report" | "losses" | "gear" | "legend">("report");
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const [revealMedia, setRevealMedia] = useState(false);
  const mediaDates = useMemo(
    () => [...new Set(media.map((item) => item.eventDate).filter((day): day is string => Boolean(day)))].sort(),
    [media],
  );
  const [toDate, setToDate] = useState(mediaDates[mediaDates.length - 1] || "");
  const [mediaTypes, setMediaTypes] = useState({ photo: true, video: true, other: true });

  useEffect(() => {
    if (window.matchMedia("(max-width: 860px)").matches) setPanel("peek");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleMedia = media.filter((item) => {
    if (!mediaTypes[item.mediaType]) return false;
    if (toDate && item.eventDate && item.eventDate > toDate) return false;
    return true;
  });
  const strikes = useMemo(
    () =>
      baseline.markers.filter(
        (marker) => marker.origin !== "sample" && (marker.kind === "strike" || marker.kind === "weapon" || marker.kind === "clash"),
      ),
    [baseline.markers],
  );

  function choose(next: MapSelection) {
    setSelection(next);
    setRevealMedia(false);
    setPanel("open");
  }

  return (
    <div className="map-desk">
      <div className="map-stage">
        <WarMap
          flot={flot}
          units={units}
          media={visibleMedia}
          strikes={strikes}
          layers={layers}
          resizeKey={`${panel}-${tab}`}
          onSelect={choose}
        />
        <div className="map-toolbar">
          <Link href="/" className="map-chip no-underline font-serif text-sm text-inherit">
            Ground Record
          </Link>
          {LAYER_LABELS.map((layer) => (
            <button
              key={layer.key}
              type="button"
              className="map-chip"
              aria-pressed={layers[layer.key]}
              onClick={() => setLayers((current) => ({ ...current, [layer.key]: !current[layer.key] }))}
            >
              {layer.label}
            </button>
          ))}
          <Link href="/method" className="map-chip no-underline text-inherit">
            How to read this
          </Link>
          <button type="button" className="map-chip md:hidden" onClick={() => setPanel(panel === "open" ? "peek" : "open")}>
            {panel === "open" ? "Close record" : "Open record"}
          </button>
        </div>
      </div>
      <aside className={`map-desk-panel ${panel}`} aria-label="Record">
        <div className="border-b border-border px-4 py-3">
          <button type="button" className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-[#d9d0c2] md:hidden" onClick={() => setPanel(panel === "open" ? "peek" : "open")} aria-label={panel === "open" ? "Collapse the record" : "Expand the record"} />
          <p className="font-serif text-xl leading-tight">{conflict.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Front estimate {flot ? formatDay(flot.asOf) : "not built"}. {flot?.counts.evidenced ?? 0} solid stretches, {flot?.counts.interpolated ?? 0} dashed.
          </p>
          {mediaDates.length > 0 ? (
            <label className="mt-2 block text-xs text-muted-foreground">
              Media through {toDate ? formatDay(toDate) : "the latest pin"}. The line does not move.
              <input
                type="range"
                className="mt-1 block w-full"
                min={0}
                max={Math.max(mediaDates.length - 1, 0)}
                value={Math.max(0, mediaDates.indexOf(toDate))}
                onChange={(event) => setToDate(mediaDates[Number(event.target.value)] || toDate)}
              />
            </label>
          ) : null}
        </div>
        {panel === "open" ? (
          <div className="map-desk-scroll">
            {selection ? (
              <SelectionCard
                selection={selection}
                flot={flot}
                units={units}
                media={visibleMedia}
                strikes={strikes}
                revealMedia={revealMedia}
                onReveal={() => setRevealMedia(true)}
                onClear={() => setSelection(null)}
              />
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                Click a stretch of the line, a tinted area, a unit symbol, or a pin. The source for that mark opens here.
              </p>
            )}
            <div className="mt-4 flex gap-2 overflow-x-auto">
              {(
                [
                  ["report", "Report"],
                  ["losses", "Losses"],
                  ["gear", "Gear"],
                  ["legend", "Legend"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`map-chip ${tab === id ? "" : ""}`}
                  aria-pressed={tab === id}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "report" ? (
              <ReportTab conflict={conflict} report={report} baseline={baseline} dates={dates} activeDate={activeDate} latestHref={latestHref} />
            ) : null}
            {tab === "losses" ? <LossesTab conflict={conflict} baseline={baseline} /> : null}
            {tab === "gear" ? <GearTab report={report} baseline={baseline} catalog={catalog} /> : null}
            {tab === "legend" ? (
              <LegendTab flot={flot} mediaTypes={mediaTypes} onToggleType={(type) => setMediaTypes((current) => ({ ...current, [type]: !current[type] }))} />
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function SelectionCard({
  selection,
  flot,
  units,
  media,
  strikes,
  revealMedia,
  onReveal,
  onClear,
}: {
  selection: MapSelection;
  flot: FlotEstimate | null;
  units: PlacedUnit[];
  media: MediaPin[];
  strikes: MapMarker[];
  revealMedia: boolean;
  onReveal: () => void;
  onClear: () => void;
}) {
  if (selection.kind === "segment") {
    const segment = flot?.segments.find((item) => item.id === selection.id);
    if (!segment) return null;
    return (
      <article className="rounded-md border border-border bg-card p-3">
        <button type="button" className="text-xs text-muted-foreground" onClick={onClear}>
          Clear
        </button>
        <div className="mt-2 flex flex-wrap gap-2">
          <OriginBadge origin="reference" />
          <VerificationBadge level={segment.confidence === "evidenced" ? "single-source" : "unverified"} />
        </div>
        <h2 className="mt-2 font-serif text-xl">{segment.title}</h2>
        <p className="mt-2 text-sm leading-6">{segment.detail}</p>
        <ul className="mt-3 space-y-2 text-sm leading-6">
          {segment.evidence.map((item, index) => (
            <li key={`${item.kind}-${item.name}-${index}`}>
              {item.url ? <a href={item.url}>{item.text}</a> : item.text}
              {item.outlet ? <span className="text-muted-foreground"> · {item.outlet}</span> : null}
            </li>
          ))}
        </ul>
        <SourceList sources={segment.sources} />
      </article>
    );
  }
  if (selection.kind === "area") {
    const area = flot?.areas.find((item) => item.id === selection.id);
    if (!area) return null;
    return (
      <article className="rounded-md border border-border bg-card p-3">
        <button type="button" className="text-xs text-muted-foreground" onClick={onClear}>Clear</button>
        <h2 className="mt-2 font-serif text-xl">{area.title}</h2>
        <p className="mt-2 text-sm leading-6">{area.detail}</p>
        <SourceList sources={area.sources} />
      </article>
    );
  }
  if (selection.kind === "contested") {
    const town = flot?.contested.find((item) => item.id === selection.id);
    if (!town) return null;
    return (
      <article className="rounded-md border border-border bg-card p-3">
        <button type="button" className="text-xs text-muted-foreground" onClick={onClear}>Clear</button>
        <h2 className="mt-2 font-serif text-xl">{town.name}</h2>
        <p className="mt-2 text-sm leading-6">
          Marked contested in the Wikipedia settlement module{town.section ? `, ${town.section}` : ""}. The orange dot is that marker, not a measured trench.
        </p>
        <p className="mt-2 text-sm">
          <a href={town.url}>Wikipedia page used for this marker</a>
        </p>
      </article>
    );
  }
  if (selection.kind === "unit") {
    const unit = units.find((item) => item.id === selection.id);
    if (!unit) return null;
    return (
      <article className="rounded-md border border-border bg-card p-3">
        <button type="button" className="text-xs text-muted-foreground" onClick={onClear}>Clear</button>
        <div className="mt-2 flex flex-wrap gap-2">
          <OriginBadge origin="live" />
          <VerificationBadge level="single-source" />
        </div>
        <h2 className="mt-2 font-serif text-xl">{unit.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {unit.typeLabel} · {unit.echelon}
          {unit.parent ? ` · parent ${unit.parent}` : " · parent formation not in the source"}
        </p>
        <p className="mt-2 text-sm leading-6">{unit.confidenceNote}</p>
        <p className="mt-2 text-sm">
          <span className="text-muted-foreground">Last reported scene: </span>
          {unit.place}
          {unit.reportedOn ? ` · card date ${formatDay(unit.reportedOn)}` : ""}. The card date is not a filming clock time.
        </p>
        <p className="mt-2 text-sm leading-6">
          <EquipmentText text={unit.caption} />
        </p>
        <SourceList sources={unit.sources} />
      </article>
    );
  }
  if (selection.kind === "media") {
    const item = media.find((entry) => entry.id === selection.id);
    if (!item) return null;
    return (
      <article className="rounded-md border border-border bg-card p-3">
        <button type="button" className="text-xs text-muted-foreground" onClick={onClear}>Clear</button>
        <h2 className="mt-2 font-serif text-xl">{item.title}</h2>
        <p className="mt-2 text-sm leading-6">{item.timeNote}</p>
        <p className="mt-2 text-sm">Verified by {item.verifiedBy}. Confidence: geolocated. Filed under {item.filedUnder}.</p>
        {revealMedia ? (
          <ul className="mt-2 space-y-1 text-sm">
            {item.originalUrls.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">Original post</a>
              </li>
            ))}
            {item.geolocationUrl ? (
              <li>
                <a href={item.geolocationUrl} target="_blank" rel="noreferrer">Geolocation post</a>
              </li>
            ) : null}
          </ul>
        ) : (
          <button type="button" className="mt-3 rounded border border-[#8c3a2f] px-3 py-2 text-sm text-[#8c3a2f]" onClick={onReveal}>
            Show links. This may be graphic. Nothing will autoplay.
          </button>
        )}
      </article>
    );
  }
  const strike = strikes.find((item) => item.id === selection.id);
  if (!strike) return null;
  return (
    <article className="rounded-md border border-border bg-card p-3">
      <button type="button" className="text-xs text-muted-foreground" onClick={onClear}>Clear</button>
      <div className="mt-2 flex flex-wrap gap-2">
        <OriginBadge origin={strike.origin} />
        <VerificationBadge level={strike.verification} />
      </div>
      <h2 className="mt-2 font-serif text-xl">{strike.title}</h2>
      <p className="mt-2 text-sm leading-6">
        <EquipmentText text={strike.detail} />
      </p>
      <p className="mt-2 text-sm">Who said it: {strike.claimedBy}</p>
      <SourceList sources={strike.sources} />
    </article>
  );
}

function ReportTab({
  conflict,
  report,
  baseline,
  dates,
  activeDate,
  latestHref,
}: {
  conflict: Conflict;
  report: DailyReport;
  baseline: Baseline;
  dates: string[];
  activeDate: string | null;
  latestHref: string;
}) {
  const liveWeapons = baseline.weapons.filter((item) => item.origin !== "sample");
  return (
    <div className="mt-4 space-y-4 text-sm leading-6">
      <p>
        {report.pull.generatedAt
          ? `Headlines fetched ${formatWhen(report.pull.generatedAt)} for ${formatDay(report.date)}.`
          : "No open-source pull has been saved yet."}{" "}
        {activeDate ? "This is a saved day. The front line is still the current settlement estimate." : "This is the latest pull."}
      </p>
      {dates.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto">
          <Link href={latestHref} className={`map-chip no-underline ${activeDate ? "text-inherit" : ""}`} aria-current={activeDate ? undefined : "page"}>
            Latest
          </Link>
          {dates.map((date) => (
            <Link key={date} href={`/conflicts/${conflict.id}/day/${date}`} className="map-chip no-underline text-inherit" aria-current={activeDate === date ? "page" : undefined}>
              {formatDay(date)}
            </Link>
          ))}
        </div>
      ) : null}
      <div>
        <h2 className="font-serif text-2xl">Headlines</h2>
        {report.headlines.length === 0 ? <p className="mt-2 text-muted-foreground">No headline matched this pull.</p> : null}
        <ul className="mt-2 space-y-3">
          {report.headlines.map((item) => (
            <li key={item.id}>
              <p className="font-medium">
                <EquipmentText text={item.title} />
              </p>
              <p className="text-muted-foreground">
                {item.outlet}
                {item.side ? ` · ${item.side}` : ""} · {formatWhen(item.publishedAt)}
              </p>
              <p>
                <a href={item.url}>Read the article</a>
              </p>
            </li>
          ))}
        </ul>
      </div>
      {liveWeapons.length > 0 ? (
        <div>
          <h2 className="font-serif text-2xl">Weapons named in this pull</h2>
          <ul className="mt-2 space-y-2">
            {liveWeapons.map((item) => (
              <li key={item.id}>
                <EquipmentText text={item.name} />
                <span className="text-muted-foreground"> · {item.claimedBy}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-muted-foreground">
        Movement cards in the data file are still sample illustrations, so they are not listed here. GDELT this pull: {report.pull.gdelt}.
      </p>
    </div>
  );
}

function LossesTab({ conflict, baseline }: { conflict: Conflict; baseline: Baseline }) {
  const groups = baseline.casualtyGroups
    .map((group) => ({ ...group, claims: group.claims.filter((claim) => claim.origin !== "sample") }))
    .filter((group) => group.claims.length > 0);
  if (!groups.length) {
    return <p className="mt-4 text-sm text-muted-foreground">No sourced casualty line is in this pull. Sample ranges are not shown.</p>;
  }
  return (
    <div className="mt-2">
      {groups.map((group) => (
        <CompetingClaims key={group.id} group={group} parties={conflict.parties} />
      ))}
    </div>
  );
}

function GearTab({ report, baseline, catalog }: { report: DailyReport; baseline: Baseline; catalog: Equipment[] }) {
  const texts = [
    ...report.headlines.map((item) => item.title),
    ...baseline.weapons.filter((item) => item.origin !== "sample").flatMap((item) => [item.name, item.text]),
    ...baseline.casualtyGroups.flatMap((group) => group.claims.filter((claim) => claim.origin !== "sample").map((claim) => claim.text)),
  ];
  const rows = equipmentCounts(texts, catalog);
  return (
    <div className="mt-4 text-sm">
      <p className="leading-6 text-muted-foreground">A name opens its specifications on this page. Unknown fields stay unknown. Counts are mentions, not losses.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.item.id} className="flex items-baseline justify-between gap-3">
            <EquipmentText text={row.item.name} />
            <span className="text-muted-foreground">{row.count}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {catalog.map((item) => (
          <span key={item.id} className="rounded-full border border-border px-2 py-1">
            <EquipmentText text={item.aliases[0] || item.name} />
          </span>
        ))}
      </div>
    </div>
  );
}

function LegendTab({
  flot,
  mediaTypes,
  onToggleType,
}: {
  flot: FlotEstimate | null;
  mediaTypes: { photo: boolean; video: boolean; other: boolean };
  onToggleType: (type: "photo" | "video" | "other") => void;
}) {
  const [marks, setMarks] = useState<{ sidc: string; label: string; svg: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    import("milsymbol").then((mod) => {
      if (cancelled) return;
      const milsymbol = mod.default;
      setMarks(
        LEGEND.map((item) => ({
          ...item,
          svg: new milsymbol.Symbol(item.sidc, { size: 28 }).asSVG(),
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="mt-4 space-y-3 text-sm leading-6">
      <p>
        A solid black stretch is close to a contested settlement or a close pair of opposing settlement markers. A dashed stretch is interpolated between those markers. Click either one for the settlements behind it.
      </p>
      <p>The brown tint is the side closer to a Russian-held marker than to a Ukrainian-held marker. It can cover nearby water. It is not a copied occupation polygon.</p>
      <p>{flot?.accuracy}</p>
      <p>{flot?.timelineNote}</p>
      <p>
        Rectangle frames are the APP-6 mark used here for Ukrainian units. Diamond frames are the mark used here for Russian units. Those are the standard’s friendly and hostile frames, used so the sides can be told apart. They are not a verdict.
      </p>
      <ul className="space-y-2">
        {marks.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center" dangerouslySetInnerHTML={{ __html: item.svg }} />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      <p>Orange dots are settlements the Wikipedia module marks contested. Green camera pins are GeoConfirmed footage. Diamonds are strikes named in a headline.</p>
      <div className="flex flex-wrap gap-2">
        {(["photo", "video", "other"] as const).map((type) => (
          <button key={type} type="button" className="map-chip" aria-pressed={mediaTypes[type]} onClick={() => onToggleType(type)}>
            {type}
          </button>
        ))}
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {(flot?.sources || []).map((source) => (
          <li key={source.name}>
            {source.url ? <a href={source.url}>{source.name}</a> : source.name}
            {source.note ? ` — ${source.note}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
