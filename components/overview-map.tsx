"use client";

import { useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";
import { mapStyleOptions } from "@/lib/map-style";

export type OverviewDot = {
  id: string;
  name: string;
  status: "active" | "armistice";
  lat: number;
  lng: number;
};

export function OverviewMap({ dots }: { dots: OverviewDot[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState("");

  useEffect(() => {
    let cancelled = false;
    const markers: import("maplibre-gl").Marker[] = [];
    let map: import("maplibre-gl").Map | null = null;

    (async () => {
      try {
        const maplibregl = (await import("maplibre-gl")).default;
        if (cancelled || !containerRef.current) return;
        map = new maplibregl.Map({
          container: containerRef.current,
          cooperativeGestures: true,
          center: [20, 18],
          zoom: 1.35,
          ...mapStyleOptions(),
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        for (const dot of dots) {
          const link = document.createElement("a");
          link.href = withBasePath(`/conflicts/${dot.id}/`);
          link.className = "overview-dot";
          link.style.background = dot.status === "armistice" ? "#8a6232" : "#1e3a34";
          link.setAttribute("aria-label", `${dot.name}, ${dot.status === "armistice" ? "armistice" : "active fighting"}`);
          const marker = new maplibregl.Marker({ element: link, anchor: "center" })
            .setLngLat([dot.lng, dot.lat])
            .addTo(map);
          markers.push(marker);
        }
      } catch (error) {
        setFailed(error instanceof Error ? error.message : "The map could not start.");
      }
    })();

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      map?.remove();
    };
  }, [dots]);

  return (
    <div className="map-shell overflow-hidden rounded-md border border-border">
      <div ref={containerRef} className="h-[280px] w-full sm:h-[420px]" />
      {failed ? <p className="px-4 py-3 text-sm">The overview map did not load. {failed} The list below still works.</p> : null}
    </div>
  );
}
