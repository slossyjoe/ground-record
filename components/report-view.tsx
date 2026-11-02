import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { CasualtyChart, OutletChart } from "@/components/charts";
import { ClaimCard, CompetingClaims, SourceList } from "@/components/claims";
import { ConflictMap } from "@/components/conflict-map";
import { EquipmentText } from "@/components/equipment";
import { OriginBadge, VerificationBadge } from "@/components/verification-badge";
import { VERIFICATION_HELP, VERIFICATION_LABEL, weaponLabel } from "@/lib/labels";
import { formatDay, formatWhen, partyById } from "@/lib/utils";
import { equipmentCounts } from "@/lib/equipment";
import type { Equipment } from "@/lib/equipment";
import type { Baseline, Conflict, DailyReport, MediaPin, Verification } from "@/lib/types";

const NAV = [
  ["headlines", "Headlines"],
  ["map", "Map"],
  ["background", "Background"],
  ["movements", "Movements"],
  ["casualties", "Casualties"],
  ["units", "Units"],
  ["territory", "Territory"],
  ["weapons", "Weapons"],
  ["charts", "Charts"],
];

export function ReportView({
  conflict,
  report,
  baseline,
  dates,
  activeDate,
  usingArchive,
  media = [],
  catalog = [],
  latestHref,
}: {
  conflict: Conflict;
  report: DailyReport;
  baseline: Baseline;
  dates: string[];
  activeDate: string | null;
  usingArchive: boolean;
  media?: MediaPin[];
  catalog?: Equipment[];
  latestHref?: string;
}) {
  const liveFigures = baseline.casualtyGroups
    .flatMap((group) => group.claims)
    .filter((claim) => claim.origin === "live" && claim.low != null)
    .map((claim) => ({
      label: claim.claimedBy,
      value: claim.low as number,
      detail: (claim.area || claim.text).slice(0, 110),
    }));
  const markers = [
    ...baseline.markers,
    ...report.datasetEvents
      .filter((event) => event.lat != null && event.lng != null)
      .map((event) => ({
        id: event.id,
        kind: "event" as const,
        origin: "live" as const,
        lat: event.lat as number,
        lng: event.lng as number,
        title: event.title,
        detail: event.detail,
        partyId: null,
        weaponType: null,
        verification: event.verification,
        claimedBy: event.claimedBy,
        sources: event.sources,
      })),
  ];

  return (
    <>
    <SiteHeader />
    <article className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm">
        <Link href="/">Back to the map</Link>
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={conflict.status === "armistice" ? "armistice" : "active"}>{conflict.statusLabel}</Badge>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {conflict.region} · since {conflict.started}
        </span>
      </div>
      <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{conflict.name}</h1>
      <p className="mt-3 max-w-3xl text-lg leading-8">{conflict.blurb}</p>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{conflict.complexityNote}</p>
      <ul className="mt-4 flex flex-wrap gap-3 text-sm">
        {conflict.parties.map((party) => (
          <li key={party.id} className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: party.color }} />
            {party.name}
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-3xl text-sm leading-6">
        {conflict.inclusion.text}{" "}
        <a href={conflict.inclusion.sourceUrl}>{conflict.inclusion.sourceName}</a>.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="live-panel rounded-md p-4 text-sm leading-6">
          <OriginBadge origin="live" />
          <p className="mt-2">
            {report.pull.generatedAt
              ? `Headlines were fetched ${formatWhen(report.pull.generatedAt)} for ${formatDay(report.date)}.`
              : "No open-source pull has been saved yet."}{" "}
            {usingArchive
              ? "You are looking at a saved day."
              : "Situation cards below use this pull when a headline or a Wikipedia infobox supplied them."}
          </p>
        </div>
        <div className="sample-panel rounded-md p-4 text-sm leading-6">
          <OriginBadge origin="sample" />
          <p className="mt-2">
            A card marked Sample is still a layout example, used only where this pull had no headline or infobox line for that section. Reference means an encyclopedia or map source. From the latest pull means a headline.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(VERIFICATION_LABEL) as Verification[]).map((level) => (
          <div key={level} className="rounded-md border border-border bg-card p-3">
            <dt>
              <VerificationBadge level={level} />
            </dt>
            <dd className="mt-2 text-xs leading-5 text-muted-foreground">{VERIFICATION_HELP[level]}</dd>
          </div>
        ))}
      </dl>

      {dates.length > 1 ? (
        <div className="mt-4 flex gap-2 overflow-x-auto text-sm">
          <Link
            href={latestHref || `/conflicts/${conflict.id}`}
            className={`shrink-0 rounded-full border px-3 py-1 no-underline ${activeDate ? "border-border text-foreground" : "border-[#1e3a34] bg-[#1e3a34] text-[#f6f3ec]"}`}
          >
            Latest
          </Link>
          {dates.map((date) => (
            <Link
              key={date}
              href={`/conflicts/${conflict.id}/day/${date}`}
              className={`shrink-0 rounded-full border px-3 py-1 no-underline ${activeDate === date ? "border-[#1e3a34] bg-[#1e3a34] text-[#f6f3ec]" : "border-border text-foreground"}`}
            >
              {formatDay(date)}
            </Link>
          ))}
        </div>
      ) : null}

      <nav className="sticky top-0 z-20 mt-6 flex gap-2 overflow-x-auto border-b border-border bg-[#f3efe6]/95 py-2 text-sm backdrop-blur">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-foreground no-underline">
            {label}
          </a>
        ))}
      </nav>

      <section id="headlines" className="mt-8 scroll-mt-16">
        <h2 className="font-serif text-3xl">Open-source headlines</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          These are titles from the feeds and, when it answered, GDELT. The wording is theirs. State outlets are labeled by type so you can see who is speaking. Matching titles from more than one outlet are marked “Multiple outlets.” That means the claim was widely published, not that it was confirmed on the ground.
        </p>
        {report.headlines.length === 0 ? (
          <p className="mt-4 rounded-md border border-dashed border-border bg-card p-4 text-sm">
            No article in this pull matched this conflict. The source log at the bottom says which feeds answered.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {report.headlines.map((item) => (
              <li key={item.id} className="live-panel rounded-md p-4">
                <div className="flex flex-wrap gap-2">
                  <OriginBadge origin="live" />
                  <VerificationBadge level={item.verification} />
                  <Badge variant="outline">{item.outletType}</Badge>
                </div>
                <h3 className="mt-2 font-serif text-xl leading-snug">
                  <EquipmentText text={item.title} />
                </h3>
                <p className="mt-2 text-sm">
                  <a href={item.url} rel="noreferrer">Read the article</a>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.outlet}
                  {item.side ? ` · ${item.side}` : ""}
                  {item.country ? ` · ${item.country}` : ""} · {formatWhen(item.publishedAt)} · via {item.via}
                </p>
                {item.excerpt ? <p className="mt-2 text-sm leading-6">{item.excerpt}</p> : null}
                {item.alsoReportedBy.length > 0 ? (
                  <p className="mt-2 text-sm">
                    Also published by{" "}
                    {item.alsoReportedBy.map((other, index) => (
                      <span key={other.url}>
                        {index > 0 ? ", " : ""}
                        <a href={other.url} rel="noreferrer">
                          {other.outlet}
                        </a>
                      </span>
                    ))}
                    .
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="map" className="mt-12 scroll-mt-16">
        <h2 className="font-serif text-3xl">Map</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Pins from this pull sit on places named in a headline. The coordinate comes from that place’s Wikipedia summary. The Gaza outline, where shown, is the OpenStreetMap administrative boundary. Sample shapes remain only if this pull produced no mapped headline. They are not a surveyed front line. ISW and DeepState control maps are not drawn here; their terms do not allow this app to republish the files.
        </p>
        <div className="mt-4">
          <ConflictMap conflict={conflict} markers={markers} shapes={baseline.shapes} media={media} />
        </div>
        <details className="mt-4 rounded-md border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">All map items as text</summary>
          <ul className="mt-3 space-y-3 text-sm">
            {markers.map((marker) => (
              <li key={marker.id}>
                <span className="font-medium">{marker.title}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {marker.kind} · {marker.origin} · {marker.lat.toFixed(2)}, {marker.lng.toFixed(2)}
                </span>
                <p>{marker.detail}</p>
              </li>
            ))}
            {baseline.shapes.map((shape) => (
              <li key={shape.id}>
                <span className="font-medium">{shape.title}</span>
                <span className="text-muted-foreground"> · {shape.kind} · {shape.origin}</span>
                <p>{shape.detail}</p>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section id="background" className="mt-12 scroll-mt-16">
        <h2 className="font-serif text-3xl">Background</h2>
        {report.background ? (
          <blockquote className="reference-panel mt-4 rounded-md p-4">
            <div className="flex flex-wrap gap-2">
              <OriginBadge origin="live" />
              <VerificationBadge level="single-source" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Wikipedia summary of “{report.background.title}”. This is their wording, not ours.{" "}
              {report.background.description}
            </p>
            <p className="mt-3 text-base leading-7">{report.background.extract}</p>
            <p className="mt-3 text-sm">
              <a href={report.background.url}>{report.background.title} on Wikipedia</a>
              <span className="text-muted-foreground">
                {" "}
                · {report.background.license} · fetched {formatWhen(report.background.fetchedAt)}
              </span>
            </p>
          </blockquote>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No Wikipedia summary was saved. The pull log at the bottom says why.
          </p>
        )}
      </section>

      <Section
        id="movements"
        title="Troop movements"
        note={baseline.notes.movements}
        sample={baseline.movements.every((item) => item.origin === "sample")}
      >
        {baseline.movements.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {baseline.movements.map((item) => (
              <ClaimCard key={item.id} claim={item} parties={conflict.parties} />
            ))}
          </div>
        )}
      </Section>

      <Section
        id="casualties"
        title="Casualties"
        note={baseline.notes.casualties}
        sample={baseline.casualtyGroups.every((group) => group.claims.every((item) => item.origin === "sample"))}
      >
        {baseline.casualtyGroups.length === 0 ? <Empty /> : null}
        {baseline.casualtyGroups.map((group) => (
          <CompetingClaims key={group.id} group={group} parties={conflict.parties} />
        ))}
        {report.datasetEvents.length > 0 ? (
          <div className="mt-6">
            <h3 className="font-serif text-xl">Dataset events</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              These rows came from a conflict dataset during the pull. A fatality field is that dataset’s figure. It is one source. It is not a confirmed total, and it is not mixed into the sample chart.
            </p>
            <ul className="mt-3 space-y-3">
              {report.datasetEvents.map((event) => (
                <li key={event.id} className="live-panel rounded-md p-4 text-sm leading-6">
                  <div className="flex flex-wrap gap-2">
                    <OriginBadge origin="live" />
                    <VerificationBadge level="single-source" />
                    <Badge variant="outline">{event.dataset}</Badge>
                  </div>
                  <p className="mt-2 font-medium">{event.title}</p>
                  <p className="text-muted-foreground">
                    {event.location}
                    {event.date ? ` · ${formatDay(event.date)}` : ""}
                    {event.fatalities != null ? ` · fatalities recorded: ${event.fatalities}` : ""}
                  </p>
                  <p className="mt-2">{event.detail}</p>
                  <p className="mt-2">
                    <span className="text-muted-foreground">Who recorded it: </span>
                    {event.claimedBy}
                  </p>
                  <SourceList sources={event.sources} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section id="units" title="Units and where they are" note={baseline.notes.units} sample={baseline.units.some((item) => item.origin === "sample")}>
        {baseline.units.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {baseline.units.map((item) => {
              const party = partyById(conflict.parties, item.partyId);
              return (
                <li key={item.id} className="rounded-md border border-border bg-card/80 p-4 text-sm leading-6">
                  <div className="flex flex-wrap gap-2">
                    <OriginBadge origin={item.origin} />
                    <VerificationBadge level={item.verification} />
                  </div>
                  <h3 className="mt-2 font-serif text-xl">{item.name}</h3>
                  <p className="text-muted-foreground">
                    {item.area}
                    {party ? ` · ${party.name}` : ""}
                  </p>
                  <p className="mt-2">{item.text}</p>
                  <p className="mt-2">
                    <span className="text-muted-foreground">Who said it: </span>
                    {item.claimedBy}
                  </p>
                  <SourceList sources={item.sources} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        id="territory"
        title="Territory gained and lost"
        note={baseline.notes.territory}
        sample={baseline.territory.some((group) => group.claims.some((item) => item.origin === "sample"))}
      >
        {baseline.territory.length === 0 ? <Empty /> : null}
        {baseline.territory.map((group) => (
          <CompetingClaims key={group.id} group={group} parties={conflict.parties} />
        ))}
      </Section>

      <Section id="weapons" title="Weapons in use" note={baseline.notes.weapons} sample={baseline.weapons.some((item) => item.origin === "sample")}>
        {baseline.weapons.length === 0 ? (
          <Empty />
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {baseline.weapons.map((item) => {
              const party = partyById(conflict.parties, item.partyId);
              return (
                <li key={item.id} className="rounded-md border border-border bg-card/80 p-4 text-sm leading-6">
                  <div className="flex flex-wrap gap-2">
                    <OriginBadge origin={item.origin} />
                    <VerificationBadge level={item.verification} />
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{weaponLabel(item.weaponType)}</p>
                  <h3 className="font-serif text-xl">
                    <EquipmentText text={item.name} />
                  </h3>
                  <p className="text-muted-foreground">
                    {item.area}
                    {party ? ` · ${party.name}` : ""}
                  </p>
                  <p className="mt-2">{item.text}</p>
                  <p className="mt-2">
                    <span className="text-muted-foreground">Who said it: </span>
                    {item.claimedBy}
                  </p>
                  <SourceList sources={item.sources} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <section id="equipment" className="mt-12 scroll-mt-16">
        <h2 className="font-serif text-3xl">Equipment named in this record</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          A name is listed when it appears in a headline or situation line above. The count is mentions, not confirmed losses. Click a name for the open specifications. Unknown fields stay unknown.
        </p>
        <EquipmentIndex texts={mentionTexts(report, baseline)} catalog={catalog} />
      </section>

      <section id="charts" className="mt-12 scroll-mt-16">
        <h2 className="font-serif text-3xl">Charts</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="live-panel rounded-md p-4">
            <OriginBadge origin="live" />
            <h3 className="mt-3 font-serif text-xl">Articles in this pull</h3>
            <div className="mt-3">
              <OutletChart counts={report.outletCounts} />
            </div>
          </div>
          <div className={liveFigures.length ? "live-panel rounded-md p-4" : "sample-panel rounded-md p-4"}>
            <OriginBadge origin={liveFigures.length ? "live" : "sample"} />
            <h3 className="mt-3 font-serif text-xl">
              {liveFigures.length ? "Figures written in headlines" : "Claimed casualty ranges"}
            </h3>
            <div className="mt-3">
              <CasualtyChart trend={baseline.casualtyTrend} figures={liveFigures} parties={conflict.parties} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-md border border-border bg-card p-4 text-sm leading-6">
        <h2 className="font-serif text-2xl">What this pull did</h2>
        <ul className="mt-3 space-y-1">
          <li>GDELT: {report.pull.gdelt}</li>
          <li>Wikipedia: {report.pull.wikipedia}</li>
          <li>ACLED: {report.pull.acled}</li>
          <li>ReliefWeb: {report.pull.reliefweb}</li>
          <li>UCDP: {report.pull.ucdp}</li>
          <li>Articles kept after matching: {report.pull.matchedArticles}</li>
        </ul>
        {report.pull.feedNotes.length > 0 ? (
          <ul className="mt-3 space-y-1 text-muted-foreground">
            {report.pull.feedNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </article>
    <SiteFooter />
    </>
  );
}

function Section({
  id,
  title,
  note,
  sample,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  sample?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-16">
      <h2 className="font-serif text-3xl">{title}</h2>
      <div className={`mt-4 rounded-md p-4 ${sample ? "sample-panel" : "reference-panel"}`}>
        {note ? <p className="mb-4 text-sm leading-6">{note}</p> : null}
        {children}
      </div>
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">Nothing is filed in this section.</p>;
}

function mentionTexts(report: DailyReport, baseline: Baseline) {
  return [
    ...report.headlines.map((item) => item.title),
    ...baseline.movements.map((item) => item.text),
    ...baseline.casualtyGroups.flatMap((group) => group.claims.map((claim) => claim.text)),
    ...baseline.weapons.flatMap((item) => [item.name, item.text]),
    ...baseline.territory.flatMap((group) => group.claims.map((claim) => claim.text)),
    ...baseline.units.map((item) => `${item.name} ${item.text}`),
  ];
}

function EquipmentIndex({ texts, catalog }: { texts: string[]; catalog: Equipment[] }) {
  const rows = equipmentCounts(texts, catalog);
  return (
    <div className="mt-4">
      {rows.length ? (
        <ul className="divide-y divide-border rounded-md border border-border bg-card">
          {rows.map((row) => (
            <li key={row.item.id} className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm">
              <EquipmentText text={row.item.name} />
              <span className="text-muted-foreground">{row.count} mention{row.count === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No catalogued system is named in this pull. The names below still open.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {catalog.map((item) => (
          <span key={item.id} className="rounded-full border border-border bg-card px-3 py-1 text-sm">
            <EquipmentText text={item.aliases[0] || item.name} />
          </span>
        ))}
      </div>
    </div>
  );
}
