"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mapStyleOptions } from "@/lib/map-style";
import type { Conflict, MapMarker, MapShape, MediaPin } from "@/lib/types";
import { EquipmentText } from "@/components/equipment";
import { weaponLabel } from "@/lib/labels";
import { OriginBadge, VerificationBadge } from "@/components/verification-badge";
import { SourceList } from "@/components/claims";

type LayerKey = MapMarker["kind"] | MapShape["kind"];

const LAYER_LABEL: Record<LayerKey, string> = {
  unit: "Unit position",
  clash: "Clash",
  strike: "Strike",
  weapon: "Weapon",
  reference: "Reference place",
  event: "Dataset event",
  control: "Sample control area",
  front: "Sample front line",
  outline: "Reference outline",
  line: "Reference or sample line",
};

function safeColor(color: string | undefined, fallback = "#1c1915") {
  return color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function markerSvg(marker: MapMarker, color: string) {
  const fill = safeColor(color);
  if (marker.kind === "reference") {
    return `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4" fill="#fbf8f3" stroke="${fill}" stroke-width="2"/></svg>`;
  }
  if (marker.kind === "unit") {
    return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="4" y="4" width="18" height="18" rx="2" fill="${fill}" stroke="#fbf8f3" stroke-width="2"/><path d="M9 17 V11 h3.2 a2.4 2.4 0 0 1 0 4.8 H11.2" fill="none" stroke="#fbf8f3" stroke-width="1.4"/></svg>`;
  }
  if (marker.kind === "clash") {
    return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="9" fill="#1c1915" stroke="#fbf8f3" stroke-width="2"/><path d="M8 8 l10 10 M18 8 L8 18" stroke="#f4f1ea" stroke-width="1.7"/></svg>`;
  }
  if (marker.kind === "strike") {
    return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 3 L23 13 L13 23 L3 13 Z" fill="${fill}" stroke="#fbf8f3" stroke-width="2"/></svg>`;
  }
  if (marker.kind === "event") {
    return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="8" fill="none" stroke="#1e3a34" stroke-width="2.4"/><circle cx="13" cy="13" r="3" fill="#1e3a34"/></svg>`;
  }
  const letter = (marker.weaponType ?? "other").slice(0, 1).toUpperCase();
  return `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 3 L23 22 H3 Z" fill="${fill}" stroke="#fbf8f3" stroke-width="2"/><text x="13" y="19" text-anchor="middle" font-size="8" font-family="sans-serif" fill="#fbf8f3">${letter}</text></svg>`;
}

export function ConflictMap({
  conflict,
  markers,
  shapes,
  media = [],
}: {
  conflict: Conflict;
  markers: MapMarker[];
  shapes: MapShape[];
  media?: MediaPin[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const htmlMarkers = useRef<import("maplibre-gl").Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const present = useMemo(() => {
    const keys = new Set<LayerKey>();
    markers.forEach((marker) => keys.add(marker.kind));
    shapes.forEach((shape) => keys.add(shape.kind));
    return keys;
  }, [markers, shapes]);
  const [layers, setLayers] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    present.forEach((key) => {
      initial[key] = true;
    });
    return initial;
  });
  const mediaDates = useMemo(
    () => [...new Set(media.map((item) => item.eventDate).filter((day): day is string => Boolean(day)))].sort(),
    [media],
  );
  const [fromDate, setFromDate] = useState(mediaDates[0] || "");
  const [toDate, setToDate] = useState(mediaDates[mediaDates.length - 1] || "");
  const [mediaTypes, setMediaTypes] = useState({ photo: true, video: true, other: true });
  const [revealOriginal, setRevealOriginal] = useState(false);
  const visibleMedia = useMemo(
    () =>
      media.filter((item) => {
        if (!mediaTypes[item.mediaType]) return false;
        if (fromDate && item.eventDate && item.eventDate < fromDate) return false;
        if (toDate && item.eventDate && item.eventDate > toDate) return false;
        return true;
      }),
    [media, mediaTypes, fromDate, toDate],
  );

  useEffect(() => {
    let cancelled = false;
    const element = containerRef.current;
    if (!element) return;

    (async () => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelled || !containerRef.current) return;
        const map = new maplibregl.Map({
          container: containerRef.current,
          cooperativeGestures: true,
          center: [conflict.center.lng, conflict.center.lat],
          zoom: conflict.zoom,
          ...mapStyleOptions(),
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          if (cancelled) return;
          map.addSource("shapes", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "outline-fill",
            type: "fill",
            source: "shapes",
            filter: ["==", ["get", "kind"], "outline"],
            paint: { "fill-color": "#1e3a34", "fill-opacity": 0.08 },
          });
          map.addLayer({
            id: "outline-line",
            type: "line",
            source: "shapes",
            filter: ["==", ["get", "kind"], "outline"],
            paint: { "line-color": "#1e3a34", "line-width": 1.4 },
          });
          map.addLayer({
            id: "control-fill",
            type: "fill",
            source: "shapes",
            filter: ["==", ["get", "kind"], "control"],
            paint: { "fill-color": ["get", "color"], "fill-opacity": 0.28 },
          });
          map.addLayer({
            id: "control-line",
            type: "line",
            source: "shapes",
            filter: ["==", ["get", "kind"], "control"],
            paint: { "line-color": ["get", "color"], "line-width": 1.2 },
          });
          map.addLayer({
            id: "front-line",
            type: "line",
            source: "shapes",
            filter: ["==", ["get", "kind"], "front"],
            paint: { "line-color": "#1c1915", "line-width": 2.4, "line-dasharray": [1.2, 1] },
          });
          map.addLayer({
            id: "ref-line",
            type: "line",
            source: "shapes",
            filter: ["==", ["get", "kind"], "line"],
            paint: { "line-color": ["get", "color"], "line-width": 2.2 },
          });
          for (const layerId of ["outline-fill", "control-fill", "front-line", "ref-line"]) {
            map.on("click", layerId, (event) => {
              const id = event.features?.[0]?.properties?.id;
              if (typeof id === "string") setSelectedId(id);
            });
            map.on("mouseenter", layerId, () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", layerId, () => {
              map.getCanvas().style.cursor = "";
            });
          }
          setReady(true);
        });
        mapRef.current = map;
      } catch (error) {
        setFailed(error instanceof Error ? error.message : "The map could not start.");
      }
    })();

    return () => {
      cancelled = true;
      htmlMarkers.current.forEach((marker) => marker.remove());
      htmlMarkers.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [conflict.center.lat, conflict.center.lng, conflict.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled) return;
      const source = map.getSource("shapes") as import("maplibre-gl").GeoJSONSource | undefined;
      const features = shapes
        .filter((shape) => layers[shape.kind] !== false)
        .map((shape) => {
          const party = conflict.parties.find((item) => item.id === shape.partyId);
          const color =
            shape.origin === "reference" ? "#1e3a34" : safeColor(party?.color, "#8a6232");
          const geometry =
            shape.kind === "front" || shape.kind === "line"
              ? { type: "LineString" as const, coordinates: shape.coordinates }
              : { type: "Polygon" as const, coordinates: [shape.coordinates] };
          return {
            type: "Feature" as const,
            properties: { id: shape.id, kind: shape.kind, color },
            geometry,
          };
        });
      source?.setData({ type: "FeatureCollection", features });

      htmlMarkers.current.forEach((marker) => marker.remove());
      htmlMarkers.current = [];
      for (const item of markers) {
        if (layers[item.kind] === false) continue;
        const party = conflict.parties.find((entry) => entry.id === item.partyId);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "map-marker";
        button.setAttribute("aria-label", item.title);
        button.innerHTML = markerSvg(item, party?.color ?? "#1c1915");
        button.addEventListener("click", () => setSelectedId(item.id));
        const pin = new maplibregl.Marker({ element: button, anchor: "center" })
          .setLngLat([item.lng, item.lat])
          .addTo(map);
        htmlMarkers.current.push(pin);
      }
      if (layers.media !== false) {
        for (const item of visibleMedia) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "map-marker";
          button.setAttribute("aria-label", `${item.mediaType} verified by GeoConfirmed: ${item.title}`);
          button.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="3" y="5" width="20" height="16" rx="2" fill="#1e3a34" stroke="#fbf8f3" stroke-width="2"/><circle cx="13" cy="13" r="4" fill="none" stroke="#f4f1ea" stroke-width="1.6"/></svg>`;
          button.addEventListener("click", () => {
            setRevealOriginal(false);
            setSelectedId(`media:${item.id}`);
          });
          const pin = new maplibregl.Marker({ element: button, anchor: "center" })
            .setLngLat([item.lng, item.lat])
            .addTo(map);
          htmlMarkers.current.push(pin);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, layers, markers, shapes, conflict.parties, visibleMedia]);

  const selectedMedia = selectedId?.startsWith("media:")
    ? visibleMedia.find((item) => item.id === selectedId.slice(6)) ?? null
    : null;
  const selected = selectedMedia
    ? null
    : markers.find((marker) => marker.id === selectedId) ??
      shapes.find((shape) => shape.id === selectedId) ??
      null;
  const sampleOn = shapes.some((shape) => shape.origin === "sample" && layers[shape.kind] !== false) ||
    markers.some((marker) => marker.origin === "sample" && layers[marker.kind] !== false);

  return (
    <div>
      <div className="map-shell relative overflow-hidden rounded-md border border-border">
        <div ref={containerRef} className="h-[340px] w-full sm:h-[480px]" />
        {sampleOn ? (
          <p className="pointer-events-none absolute bottom-8 left-1/2 w-[min(92%,28rem)] -translate-x-1/2 rounded bg-[#fbf3df]/95 px-3 py-1 text-center text-xs font-semibold text-[#6d4e16]">
            Sample positions are illustrations. They are not a live control map.
          </p>
        ) : null}
        {failed ? (
          <p className="absolute inset-0 flex items-center justify-center bg-[#fbf8f3] p-6 text-center text-sm">
            The map did not load. {failed} The same places are listed under the map.
          </p>
        ) : null}
      </div>
      {media.length > 0 ? (
        <div className="mt-3 rounded-md border border-border bg-card p-3 text-sm">
          <p className="font-medium">Verified media from GeoConfirmed</p>
          <p className="mt-1 text-muted-foreground">
            {visibleMedia.length} of {media.length} pins. Photos and videos stay on the original post. Nothing plays on this page.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["photo", "video", "other"] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={mediaTypes[type]}
                onClick={() => setMediaTypes((current) => ({ ...current, [type]: !current[type] }))}
                className={`rounded-full border px-3 py-1 text-xs ${mediaTypes[type] ? "border-[#1e3a34] bg-[#e7f2ec]" : "border-border text-muted-foreground"}`}
              >
                {type}
              </button>
            ))}
          </div>
          {mediaDates.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-xs">
                From
                <input type="date" value={fromDate} min={mediaDates[0]} max={mediaDates[mediaDates.length - 1]} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background px-2 py-1" />
              </label>
              <label className="text-xs">
                To
                <input type="date" value={toDate} min={mediaDates[0]} max={mediaDates[mediaDates.length - 1]} onChange={(event) => setToDate(event.target.value)} className="mt-1 block w-full rounded border border-border bg-background px-2 py-1" />
              </label>
              <label className="sm:col-span-2 text-xs">
                Timeline end
                <input
                  type="range"
                  min={0}
                  max={Math.max(mediaDates.length - 1, 0)}
                  value={Math.max(0, mediaDates.indexOf(toDate))}
                  onChange={(event) => setToDate(mediaDates[Number(event.target.value)] || toDate)}
                  className="mt-1 block w-full"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {[...present].map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={layers[key] !== false}
            onClick={() => setLayers((current) => ({ ...current, [key]: current[key] === false }))}
            className={`rounded-full border px-3 py-1 text-xs ${layers[key] === false ? "border-border bg-transparent text-muted-foreground" : "border-[#1e3a34] bg-[#e7f2ec] text-[#1e3a34]"}`}
          >
            {LAYER_LABEL[key]}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Legend</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li className="flex items-center gap-2"><Swatch kind="unit" /> Unit position, colored by the party named on the card</li>
            <li className="flex items-center gap-2"><Swatch kind="clash" /> Clash</li>
            <li className="flex items-center gap-2"><Swatch kind="strike" /> Strike</li>
            <li className="flex items-center gap-2"><Swatch kind="weapon" /> Weapon, letter marks the type</li>
            <li className="flex items-center gap-2"><Swatch kind="front" /> Sample front, dashed</li>
            <li className="flex items-center gap-2"><Swatch kind="control" /> Sample control area, tinted</li>
            <li className="flex items-center gap-2"><Swatch kind="reference" /> Reference place or line</li>
            <li className="flex items-center gap-2"><Swatch kind="event" /> Dataset event, only if ACLED or UCDP returned one</li>
            <li className="flex items-center gap-2"><span className="inline-block h-3.5 w-3.5 rounded-sm bg-[#1e3a34]" /> Verified photo or video (GeoConfirmed). Opens a link, not a player.</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Colors separate parties. They are not a judgment about who is right.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {conflict.parties.map((party) => (
              <li key={party.id} className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm" style={{ background: party.color }} />
                {party.name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            On a phone, use two fingers to move the map so the page can still scroll.
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          {selectedMedia ? (
            <MediaDetail item={selectedMedia} reveal={revealOriginal} onReveal={() => setRevealOriginal(true)} />
          ) : selected && "lat" in selected ? (
            <Detail
              title={selected.title}
              detail={selected.detail}
              origin={selected.origin}
              verification={selected.verification}
              claimedBy={selected.claimedBy}
              sources={selected.sources}
              extra={selected.kind === "weapon" ? weaponLabel(selected.weaponType) : selected.kind}
            />
          ) : selected ? (
            <Detail
              title={selected.title}
              detail={selected.detail}
              origin={selected.origin}
              verification={selected.verification}
              claimedBy={selected.claimedBy}
              sources={selected.sources}
              extra={LAYER_LABEL[selected.kind]}
            />
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Select a marker or a shaded area. Its source and verification show up here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({
  title,
  detail,
  origin,
  verification,
  claimedBy,
  sources,
  extra,
}: {
  title: string;
  detail: string;
  origin: MapMarker["origin"];
  verification: MapMarker["verification"];
  claimedBy: string;
  sources: MapMarker["sources"];
  extra?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <OriginBadge origin={origin} />
        <VerificationBadge level={verification} />
      </div>
      <h3 className="mt-3 font-serif text-xl">{title}</h3>
      {extra ? <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{extra}</p> : null}
      <p className="mt-2 text-sm leading-6">
        <EquipmentText text={detail} />
      </p>
      <p className="mt-2 text-sm">
        <span className="text-muted-foreground">Who said it: </span>
        {claimedBy}
      </p>
      <SourceList sources={sources} />
    </div>
  );
}

function MediaDetail({
  item,
  reveal,
  onReveal,
}: {
  item: MediaPin;
  reveal: boolean;
  onReveal: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <OriginBadge origin="live" />
        <VerificationBadge level="single-source" />
        <span className="rounded-full bg-[#e7f2ec] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#1e3a34]">
          {item.mediaType}
        </span>
      </div>
      <h3 className="mt-3 font-serif text-xl">{item.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{item.place} · filed by GeoConfirmed under {item.filedUnder}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">When it was recorded</dt>
          <dd>{item.eventDate ? `Date on the GeoConfirmed card: ${item.eventDate}.` : "Unknown."} {item.timeNote}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">When it was first posted</dt>
          <dd>Not copied into this record. It is the timestamp on the original post.</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">When it was geolocated</dt>
          <dd>GeoConfirmed published a geolocation post. A separate clock time for that step is not in the feed.</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Who checked it, and how sure</dt>
          <dd>{item.verifiedBy}. Confidence: geolocated. Records without both an original post and a geolocation post are left off this map.</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm leading-6">
        The footage is not stored here and does not play here. Opening the original post may show graphic combat images.
      </p>
      {reveal ? (
        <ul className="mt-2 space-y-1 text-sm">
          {item.originalUrls.map((url) => (
            <li key={url}>
              Original post: <a href={url} target="_blank" rel="noreferrer">open outside this page</a>
            </li>
          ))}
          {item.geolocationUrl ? (
            <li>
              Geolocation post: <a href={item.geolocationUrl} target="_blank" rel="noreferrer">open GeoConfirmed’s post</a>
            </li>
          ) : null}
        </ul>
      ) : (
        <button type="button" className="mt-3 rounded border border-[#8c3a2f] px-3 py-2 text-sm text-[#8c3a2f]" onClick={onReveal}>
          Show links. This may be graphic. Nothing will autoplay.
        </button>
      )}
    </div>
  );
}

function Swatch({ kind }: { kind: string }) {
  const common = "inline-block h-3.5 w-3.5 border border-[#1c1915]";
  if (kind === "unit") return <span className={common} style={{ background: "#2f5d8a" }} />;
  if (kind === "clash") return <span className={`${common} rounded-full bg-[#1c1915]`} />;
  if (kind === "strike") return <span className={common} style={{ background: "#8a4b32", transform: "rotate(45deg)" }} />;
  if (kind === "weapon") return <span className={common} style={{ background: "#3f6b4e", clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }} />;
  if (kind === "front") return <span className="inline-block h-0.5 w-6 border-t-2 border-dashed border-[#1c1915]" />;
  if (kind === "control") return <span className={common} style={{ background: "rgba(47,93,138,0.35)" }} />;
  if (kind === "event") return <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[#1e3a34]" />;
  return <span className="inline-block h-3 w-3 rounded-full border-2 border-[#1e3a34] bg-[#fbf8f3]" />;
}
