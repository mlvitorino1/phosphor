"use client";
import { useEffect, useRef } from "react";
import type { EventRecord } from "@/lib/domain/types";

const style = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
export function HeroGlobe({ events }: { events: EventRecord[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let map: import("maplibre-gl").Map | undefined;
    let rotateTimer: ReturnType<typeof setInterval> | undefined;
    import("maplibre-gl").then(({ Map, setWorkerUrl }) => {
      if (disposed || !container.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      map = new Map({
        container: container.current,
        style,
        center: [25, 12],
        zoom: 1.15,
        attributionControl: false,
        interactive: true,
      });
      map.on("style.load", () => {
        if (!map) return;
        map.setProjection({ type: "globe" });
        map.addSource("hero-events", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: events.map((e) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [e.lng, e.lat] },
              properties: { impact: e.impact },
            })),
          },
        });
        map.addLayer({
          id: "hero-halo",
          type: "circle",
          source: "hero-events",
          paint: {
            "circle-radius": 11,
            "circle-color": "#9afc6b",
            "circle-opacity": 0.12,
            "circle-blur": 0.65,
          },
        });
        map.addLayer({
          id: "hero-points",
          type: "circle",
          source: "hero-events",
          paint: {
            "circle-radius": 3,
            "circle-color": [
              "match",
              ["get", "impact"],
              "critical",
              "#ff5e5e",
              "high",
              "#ffad56",
              "moderate",
              "#e6cf64",
              "#9afc6b",
            ],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#10230f",
          },
        });
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          rotateTimer = setInterval(() => {
            if (map && !document.hidden)
              map.setCenter([map.getCenter().lng + 0.045, map.getCenter().lat]);
          }, 100);
      });
      map.on("mousedown", () => {
        if (rotateTimer) clearInterval(rotateTimer);
      });
      map.on("touchstart", () => {
        if (rotateTimer) clearInterval(rotateTimer);
      });
    });
    return () => {
      disposed = true;
      if (rotateTimer) clearInterval(rotateTimer);
      map?.remove();
    };
  }, [events]);
  return <div className="hero-globe" ref={container} aria-label="Globo interativo com eventos" />;
}
