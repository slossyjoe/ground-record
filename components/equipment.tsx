"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import { splitEquipment, type Equipment } from "@/lib/equipment";

const EquipmentContext = createContext<{
  catalog: Equipment[];
  open: (id: string) => void;
} | null>(null);

export function EquipmentProvider({
  catalog,
  children,
}: {
  catalog: Equipment[];
  children: React.ReactNode;
}) {
  const [id, setId] = useState<string | null>(null);
  const item = catalog.find((entry) => entry.id === id) ?? null;

  useEffect(() => {
    if (!item) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item]);

  return (
    <EquipmentContext.Provider value={{ catalog, open: setId }}>
      {children}
      {item ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1c1915]/50 p-3 sm:items-center" role="presentation" onClick={() => setId(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="equipment-title"
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-md border border-border bg-[#fbf8f3] p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.category}</p>
                <h2 id="equipment-title" className="font-serif text-2xl">{item.name}</h2>
                <p className="text-sm text-muted-foreground">{item.operators}</p>
              </div>
              <button type="button" className="rounded border border-border px-2 py-1 text-sm" onClick={() => setId(null)}>
                Close
              </button>
            </div>
            {item.image ? (
              <figure className="mt-3">
                {/* Wikimedia thumbnail. Not a combat video. */}
                <img src={withBasePath(item.image.url)} alt="" className="max-h-48 w-full rounded object-contain bg-[#efe8dc]" />
                <figcaption className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.image.attribution}{" "}
                  <a href={item.image.page} target="_blank" rel="noreferrer">Article and file page</a>
                </figcaption>
              </figure>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Photo: unknown. No Wikipedia thumbnail was stored.</p>
            )}
            <p className="mt-3 text-sm leading-6">{item.summary}</p>
            <dl className="mt-3 divide-y divide-border border-y border-border">
              {item.specs.map((spec) => (
                <div key={spec.label} className="grid grid-cols-[8rem_1fr] gap-2 py-2 text-sm">
                  <dt className="text-muted-foreground">{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 text-sm">
              {item.sources.map((source) => (
                <li key={source.url}>
                  Source: <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </EquipmentContext.Provider>
  );
}

export function EquipmentText({ text, className }: { text: string; className?: string }) {
  const context = useContext(EquipmentContext);
  if (!context) return <span className={className}>{text}</span>;
  const parts = splitEquipment(text, context.catalog);
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.equipmentId ? (
          <button
            key={`${part.equipmentId}-${index}`}
            type="button"
            className="underline decoration-dotted underline-offset-2"
            onClick={() => context.open(part.equipmentId!)}
          >
            {part.text}
          </button>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  );
}
