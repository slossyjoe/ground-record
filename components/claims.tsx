import { EquipmentText } from "@/components/equipment";
import { OriginBadge, VerificationBadge } from "@/components/verification-badge";
import { formatWhen, partyById } from "@/lib/utils";
import type { Claim, ClaimGroup, Party, Source } from "@/lib/types";

export function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return <p className="text-sm text-muted-foreground">No source attached.</p>;
  }
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {sources.map((source, index) => (
        <li key={`${source.name}-${index}`}>
          <span className="text-muted-foreground">Source: </span>
          {source.url ? (
            <a href={source.url} rel="noreferrer">
              {source.name}
            </a>
          ) : (
            <span>{source.name}</span>
          )}
          {source.publishedAt ? (
            <span className="text-muted-foreground"> · {formatWhen(source.publishedAt)}</span>
          ) : null}
          {source.note ? <span className="block text-muted-foreground">{source.note}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function figureText(claim: Claim) {
  if (claim.low == null && claim.high == null) return null;
  const unit = claim.unit ? ` ${claim.unit}` : "";
  if (claim.low != null && claim.high != null && claim.low !== claim.high) {
    return `${claim.low.toLocaleString("en-GB")}–${claim.high.toLocaleString("en-GB")}${unit}`;
  }
  const value = claim.low ?? claim.high;
  return `${value?.toLocaleString("en-GB")}${unit}`;
}

export function ClaimCard({ claim, parties }: { claim: Claim; parties: Party[] }) {
  const party = partyById(parties, claim.partyId);
  const range = figureText(claim);
  return (
    <article className="rounded-md border border-border bg-card/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <OriginBadge origin={claim.origin} />
        <VerificationBadge level={claim.verification} />
        {party ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: party.color }} />
            {party.name}
          </span>
        ) : null}
      </div>
      {range ? <p className="mt-3 font-serif text-2xl leading-none">{range}</p> : null}
      <p className="mt-3 text-sm leading-6">
        <EquipmentText text={claim.text} />
      </p>
      {claim.area ? <p className="mt-2 text-sm text-muted-foreground">Area: {claim.area}</p> : null}
      <p className="mt-3 text-sm">
        <span className="text-muted-foreground">Who said it: </span>
        {claim.claimedBy}
      </p>
      <SourceList sources={claim.sources} />
    </article>
  );
}

export function CompetingClaims({ group, parties }: { group: ClaimGroup; parties: Party[] }) {
  return (
    <section className="mt-4">
      <h3 className="font-serif text-xl">{group.topic}</h3>
      {group.summary ? <p className="mt-1 text-sm leading-6 text-muted-foreground">{group.summary}</p> : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {group.claims.map((item) => (
          <ClaimCard key={item.id} claim={item} parties={parties} />
        ))}
      </div>
    </section>
  );
}
