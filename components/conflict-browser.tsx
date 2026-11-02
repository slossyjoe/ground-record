"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { OverviewMap, type OverviewDot } from "@/components/overview-map";
import { formatWhen } from "@/lib/utils";

export type ConflictCard = OverviewDot & {
  statusLabel: string;
  region: string;
  blurb: string;
  parties: { id: string; name: string; color: string }[];
  headlineCount: number;
  generatedAt: string | null;
};

const FILTERS = ["All", "Active fighting", "Armistice", "Africa", "Americas", "Asia", "Europe", "Middle East"] as const;

export function ConflictBrowser({
  cards,
  generatedAt,
}: {
  cards: ConflictCard[];
  generatedAt: string | null;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (filter === "Active fighting" && card.status !== "active") return false;
      if (filter === "Armistice" && card.status !== "armistice") return false;
      if (["Africa", "Americas", "Asia", "Europe", "Middle East"].includes(filter) && card.region !== filter) return false;
      if (!needle) return true;
      const hay = `${card.name} ${card.region} ${card.blurb} ${card.parties.map((party) => party.name).join(" ")}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [cards, filter, query]);

  return (
    <div>
      <div className="mt-8">
        <OverviewMap dots={visible} />
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-[#1e3a34]" /> Active fighting
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-[#8a6232]" /> Armistice
          </span>
          <span>Dots mark the conflict so you can open it. They are not battle locations.</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => setFilter(item)}
              className={`shrink-0 rounded-full border px-3 py-1 text-sm ${filter === item ? "border-[#1e3a34] bg-[#1e3a34] text-[#f6f3ec]" : "border-border bg-card"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          <span className="sr-only">Filter by name</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name or country"
            className="w-full rounded-md border border-border bg-card px-3 py-2 sm:w-64"
          />
        </label>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {visible.length} of {cards.length} conflicts
        {generatedAt ? ` · latest pull ${formatWhen(generatedAt)}` : " · no pull saved yet"}
      </p>

      {visible.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-border bg-card p-6 text-sm">
          Nothing in this list matches that filter. Clear the search or choose All.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {visible.map((card) => (
            <li key={card.id}>
              <article className="flex h-full flex-col rounded-md border border-border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={card.status === "armistice" ? "armistice" : "active"}>{card.statusLabel}</Badge>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{card.region}</span>
                </div>
                <h2 className="mt-3 font-serif text-2xl leading-tight">
                  <Link href={`/conflicts/${card.id}`} className="text-foreground no-underline hover:underline">
                    {card.name}
                  </Link>
                </h2>
                <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {card.parties.map((party) => (
                    <li key={party.id} className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: party.color }} />
                      {party.name}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex-1 text-sm leading-6">{card.blurb}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {card.headlineCount > 0
                    ? `${card.headlineCount} open-source articles in the latest pull.`
                    : "No matching articles in the latest pull."}{" "}
                  Sample or reference situation blocks are on the daily page, and they are labeled.
                </p>
                <Link href={`/conflicts/${card.id}`} className="mt-3 text-sm font-medium">
                  Open the daily record
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
