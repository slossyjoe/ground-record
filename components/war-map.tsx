"use client";

import { useEffect, useRef, useState } from "react";
import { mapStyleOptions } from "@/lib/map-style";
import type { FlotEstimate, MapMarker, MediaPin, PlacedUnit } from "@/lib/types";

export type MapLayers = {
  flot: boolean;
  control: boolean;
  units: boolean;
  media: boolean;
  strikes: boolean;
};

export type MapSelection =
  | { kind: "segment"; id: string }
  | { kind: "area"; id: string }
  | { kind: "contested"; id: string }
  | { kind: "unit"; id: string }
  | { kind: "media"; id: string }
  | { kind: "strike"; id: string };

export function WarMap({
  flot,
  units,
  media,
  strikes,
  layers,
  resizeKey,
  onSelect,
}: {
  flot: FlotEstimate | null;
  units: PlacedUnit[];
  media: MediaPin[];
  strikes: MapMarker[];
  layers: MapLayers;
  resizeKey: string;
  onSelect: (selection: MapSelection) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const htmlMarkers = useRef<import("maplibre-gl").Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    const element = containerRef.current;
    if (!element) return;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;
      const map = new maplibregl.Map({
        container: containerRef.current,
        center: [36.6, 48.2],
        zoom: 5.8,
        ...mapStyleOptions(),
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.on("load", () => {
        if (cancelled) return;
        map.addSource("control", { type: "geojson", data: emptyCollection() });
        map.addSource("flot", { type: "geojson", data: emptyCollection() });
        map.addSource("contested", { type: "geojson", data: emptyCollection() });
        map.addLayer({
          id: "control-fill",
          type: "fill",
          source: "control",
          paint: { "fill-color": "#8a4b32", "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: "flot-dashed",
          type: "line",
          source: "flot",
          filter: ["==", ["get", "confidence"], "interpolated"],
          paint: { "line-color": "#1c1915", "line-width": 2.4, "line-dasharray": [1.4, 1.1] },
        });
        map.addLayer({
          id: "flot-solid",
          type: "line",
          source: "flot",
          filter: ["==", ["get", "confidence"], "evidenced"],
          paint: { "line-color": "#1c1915", "line-width": 3.2 },
        });
        map.addLayer({
          id: "flot-hit",
          type: "line",
          source: "flot",
          paint: { "line-color": "#1c1915", "line-width": 16, "line-opacity": 0.01 },
        });
        map.addLayer({
          id: "contested-dot",
          type: "circle",
          source: "contested",
          paint: {
            "circle-radius": 5,
            "circle-color": "#c47b00",
            "circle-stroke-color": "#fbf8f3",
            "circle-stroke-width": 1.5,
          },
        });
        for (const layerId of ["control-fill", "flot-hit", "contested-dot"]) {
          map.on("click", layerId, (event) => {
            const feature = event.features?.[0];
            const id = feature?.properties?.id;
            const kind = feature?.properties?.selectKind;
            if (typeof id === "string" && (kind === "segment" || kind === "area" || kind === "contested")) {
              onSelectRef.current({ kind, id });
            }
          });
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }
        const bounds = flotBounds(flot);
        if (bounds) map.fitBounds(bounds, { padding: 56, maxZoom: 6.6, duration: 0 });
        setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      setReady(false);
      htmlMarkers.current.forEach((marker) => marker.remove());
      htmlMarkers.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [flot]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const control = map.getSource("control") as import("maplibre-gl").GeoJSONSource | undefined;
      const line = map.getSource("flot") as import("maplibre-gl").GeoJSONSource | undefined;
      const dots = map.getSource("contested") as import("maplibre-gl").GeoJSONSource | undefined;
      control?.setData({
        type: "FeatureCollection",
        features: layers.control && flot ? flot.areas.map(areaFeature) : [],
      });
      line?.setData({
        type: "FeatureCollection",
        features: layers.flot && flot ? flot.segments.map(segmentFeature) : [],
      });
      dots?.setData({
        type: "FeatureCollection",
        features:
          layers.flot && flot
            ? flot.contested.map((town) => ({
                type: "Feature" as const,
                properties: { id: town.id, selectKind: "contested" },
                geometry: { type: "Point" as const, coordinates: [town.lng, town.lat] },
              }))
            : [],
      });
    };
    if (map.getSource("flot")) apply();
  }, [ready, flot, layers.control, layers.flot]);

  useEffect(() => {
    let cancelled = false;
    const map = mapRef.current;
    if (!map || !ready) return;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      const milsymbol = (await import("milsymbol")).default;
      if (cancelled) return;
      const draw = () => {
        if (cancelled || !mapRef.current) return;
        htmlMarkers.current.forEach((marker) => marker.remove());
        htmlMarkers.current = [];
        if (layers.units) {
          const seen = new Map<string, number>();
          for (const unit of units) {
            const key = `${unit.lat.toFixed(3)},${unit.lng.toFixed(3)}`;
            const slot = seen.get(key) || 0;
            seen.set(key, slot + 1);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "map-marker";
            button.setAttribute("aria-label", `${unit.name}, ${unit.typeLabel}`);
            const svg = new milsymbol.Symbol(unit.sidc, { size: 32 }).asSVG();
            button.innerHTML = `<span style="display:inline-block;transform:translate(${slot * 18}px,0)">${svg}</span>`;
            button.addEventListener("click", (event) => {
              event.stopPropagation();
              onSelectRef.current({ kind: "unit", id: unit.id });
            });
            htmlMarkers.current.push(
              new maplibregl.Marker({ element: button, anchor: "center" }).setLngLat([unit.lng, unit.lat]).addTo(map),
            );
          }
        }
        if (layers.media) {
          for (const item of media) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "map-marker";
            button.setAttribute("aria-label", `${item.mediaType} verified by GeoConfirmed: ${item.title}`);
            button.innerHTML = `<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="3" y="5" width="20" height="16" rx="2" fill="#1e3a34" stroke="#fbf8f3" stroke-width="2"/><circle cx="13" cy="13" r="4" fill="none" stroke="#f4f1ea" stroke-width="1.6"/></svg>`;
            button.addEventListener("click", (event) => {
              event.stopPropagation();
              onSelectRef.current({ kind: "media", id: item.id });
            });
            htmlMarkers.current.push(
              new maplibregl.Marker({ element: button, anchor: "center" }).setLngLat([item.lng, item.lat]).addTo(map),
            );
          }
        }
        if (layers.strikes) {
          for (const item of strikes) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "map-marker";
            button.setAttribute("aria-label", item.title);
            button.innerHTML = `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><path d="M11 2 L20 11 L11 20 L2 11 Z" fill="#6d4e16" stroke="#fbf8f3" stroke-width="1.6"/></svg>`;
            button.addEventListener("click", (event) => {
              event.stopPropagation();
              onSelectRef.current({ kind: "strike", id: item.id });
            });
            htmlMarkers.current.push(
              new maplibregl.Marker({ element: button, anchor: "center" }).setLngLat([item.lng, item.lat]).addTo(map),
            );
          }
        }
      };
      draw();
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, layers.units, layers.media, layers.strikes, units, media, strikes]);

  useEffect(() => {
    mapRef.current?.resize();
  }, [resizeKey]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

function areaFeature(area: FlotEstimate["areas"][number]) {
  return {
    type: "Feature" as const,
    properties: { id: area.id, selectKind: "area" },
    geometry: {
      type: "Polygon" as const,
      coordinates: [area.coordinates, ...(area.holes || [])],
    },
  };
}

function segmentFeature(segment: FlotEstimate["segments"][number]) {
  return {
    type: "Feature" as const,
    properties: { id: segment.id, selectKind: "segment", confidence: segment.confidence },
    geometry: { type: "LineString" as const, coordinates: segment.coordinates },
  };
}

function flotBounds(flot: FlotEstimate | null): [[number, number], [number, number]] | null {
  const coords = flot?.segments.flatMap((segment) => segment.coordinates) || [];
  if (!coords.length) return null;
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;
  for (const [lng, lat] of coords) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}
