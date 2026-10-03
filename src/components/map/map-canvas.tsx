"use client";
import { useEffect, useRef } from "react";
import type { EventRecord } from "@/lib/domain/types";
import { markerLevel, priorityMarker, specialMarker } from "@/lib/domain/marker-utils";
import { drawMapIcon, iconName } from "@/components/map/map-icons";

const style = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
// Keep the initial flight gentle, gain speed close to the destination, then settle.
const approachEasing = (t: number) => {
  const smooth = t * t * (3 - 2 * t);
  return smooth ** 1.7;
};
function circle(lng: number, lat: number, radiusKm: number) {
  const coordinates: number[][] = [];
  for (let i = 0; i <= 64; i++) {
    const bearing = (i * Math.PI * 2) / 64;
    const latOffset = (radiusKm / 111.32) * Math.cos(bearing);
    const lngOffset =
      (radiusKm / (111.32 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)))) * Math.sin(bearing);
    coordinates.push([lng + lngOffset, lat + latOffset]);
  }
  return coordinates;
}
function points(events: EventRecord[], priority = false) {
  return {
    type: "FeatureCollection" as const,
    features: events
      .filter((e) => priorityMarker(e) === priority)
      .map((e) => {
        const marker = specialMarker(e);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [e.lng, e.lat] },
          properties: {
            id: e.id,
            impact: e.impact,
            category: e.category,
            special: Boolean(marker),
            icon: marker ? iconName(marker, markerLevel(e)) : "",
          },
        };
      }),
  };
}
function areas(events: EventRecord[]) {
  return {
    type: "FeatureCollection" as const,
    features: events
      .filter(
        (e) =>
          !priorityMarker(e) &&
          (e.geometry || (e.geoType === "regional" && e.radiusKm && e.geoPrecision !== "country")),
      )
      .map((e) => ({
        type: "Feature" as const,
        geometry: e.geometry ?? {
          type: "Polygon" as const,
          coordinates: [circle(e.lng, e.lat, e.radiusKm!)],
        },
        properties: { id: e.id, impact: e.impact },
      })),
  };
}
function addIcons(map: import("maplibre-gl").Map, events: EventRecord[]) {
  for (const event of events) {
    const marker = specialMarker(event);
    if (!marker) continue;
    const level = markerLevel(event),
      name = iconName(marker, level);
    if (!map.hasImage(name)) map.addImage(name, drawMapIcon(marker, level), { pixelRatio: 2 });
  }
}
type Props = {
  events: EventRecord[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onPickLocation?: (lng: number, lat: number) => void;
  globe?: boolean;
  compact?: boolean;
  intro?: boolean;
  focusLocation?: { lat: number; lng: number } | null;
};
export function MapCanvas({
  events,
  selectedId,
  onSelect,
  onPickLocation,
  globe = false,
  compact = false,
  intro = false,
  focusLocation = null,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const eventsRef = useRef(events);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPickLocation);
  const introRef = useRef(intro);
  const globeRef = useRef(globe);
  const focusRef = useRef(focusLocation);
  const lastFocusRef = useRef<string | null>(null);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    onPickRef.current = onPickLocation;
  }, [onPickLocation]);
  useEffect(() => {
    introRef.current = intro;
  }, [intro]);
  useEffect(() => {
    globeRef.current = globe;
  }, [globe]);
  useEffect(() => {
    focusRef.current = focusLocation;
  }, [focusLocation]);
  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let rotation: ReturnType<typeof setInterval> | null = null;
    import("maplibre-gl").then(({ Map, NavigationControl, setWorkerUrl }) => {
      if (cancelled || !container.current) return;
      setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      const map = new Map({
        container: container.current,
        style,
        center:
          compact && eventsRef.current[0]
            ? [eventsRef.current[0].lng, eventsRef.current[0].lat]
            : [10, 18],
        zoom: compact ? 5 : 1.6,
      });
      mapRef.current = map;
      map.addControl(new NavigationControl({ showCompass: true }), "bottom-right");
      map.on("click", (e) => onPickRef.current?.(e.lngLat.lng, e.lngLat.lat));
      map.on("style.load", () => {
        map.setProjection({ type: globeRef.current ? "globe" : "mercator" });
        addIcons(map, eventsRef.current);
        map.addSource("regions", { type: "geojson", data: areas(eventsRef.current) });
        map.addLayer({
          id: "regions-fill",
          type: "fill",
          source: "regions",
          paint: {
            "fill-color": [
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
            "fill-opacity": 0.13,
          },
        });
        map.addLayer({
          id: "regions-outline",
          type: "line",
          source: "regions",
          paint: {
            "line-color": [
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
            "line-opacity": 0.5,
            "line-width": 1,
          },
        });
        map.addSource("events", {
          type: "geojson",
          data: points(eventsRef.current),
          cluster: !compact,
          clusterMaxZoom: 8,
          clusterRadius: 48,
        });
        map.addSource("priority", { type: "geojson", data: points(eventsRef.current, true) });
        if (!compact) {
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "events",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#152a20",
              "circle-radius": ["step", ["get", "point_count"], 17, 15, 22, 50, 28],
              "circle-stroke-width": 1,
              "circle-stroke-color": "#9afc6b",
            },
          });
          map.addLayer({
            id: "cluster-labels",
            type: "symbol",
            source: "events",
            filter: ["has", "point_count"],
            layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
            paint: { "text-color": "#dfffd2" },
          });
          map.on("click", "clusters", async (e) => {
            const f = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
            const id = f?.properties?.cluster_id;
            const source = map.getSource("events") as import("maplibre-gl").GeoJSONSource;
            if (id !== undefined) {
              const zoom = await source.getClusterExpansionZoom(id);
              map.easeTo({
                center: (f.geometry as GeoJSON.Point).coordinates as [number, number],
                zoom,
              });
            }
          });
        }
        const regularFilter: import("maplibre-gl").FilterSpecification = [
          "all",
          ["!", ["has", "point_count"]],
          ["!=", ["get", "special"], true],
        ];
        map.addLayer({
          id: "event-halo",
          type: "circle",
          source: "events",
          filter: regularFilter,
          paint: {
            "circle-radius": 13,
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
            "circle-opacity": 0.13,
            "circle-blur": 0.6,
          },
        });
        map.addLayer({
          id: "event-points",
          type: "circle",
          source: "events",
          filter: regularFilter,
          paint: {
            "circle-radius": ["case", ["==", ["get", "id"], selectedId ?? ""], 8, 5],
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
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#0a100c",
          },
        });
        map.addLayer({
          id: "special-icons",
          type: "symbol",
          source: "events",
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "special"], true]],
          layout: { "icon-image": ["get", "icon"], "icon-size": 1, "icon-allow-overlap": false },
        });
        map.addLayer({
          id: "priority-icons",
          type: "symbol",
          source: "priority",
          layout: { "icon-image": ["get", "icon"], "icon-size": 1, "icon-allow-overlap": true },
        });
        map.on("click", "event-points", (e) => {
          const id = map.queryRenderedFeatures(e.point, { layers: ["event-points"] })[0]?.properties
            ?.id;
          if (typeof id === "string") onSelectRef.current?.(id);
        });
        for (const layer of ["event-points", "special-icons", "priority-icons"]) {
          if (layer !== "event-points")
            map.on("click", layer, (e) => {
              const id = map.queryRenderedFeatures(e.point, { layers: [layer] })[0]?.properties?.id;
              if (typeof id === "string") onSelectRef.current?.(id);
            });
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        }
        if (focusRef.current) {
          const key = `${focusRef.current.lat},${focusRef.current.lng}`;
          if (lastFocusRef.current !== key) {
            lastFocusRef.current = key;
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
              map.jumpTo({ center: [focusRef.current.lng, focusRef.current.lat], zoom: 4 });
            else
              map.easeTo({
                center: [focusRef.current.lng, focusRef.current.lat],
                zoom: 4,
                duration: 3600,
                easing: approachEasing,
                essential: false,
              });
          }
        }
        if (!rotation && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
          rotation = setInterval(() => {
            if (introRef.current && !document.hidden && !focusRef.current && map.isStyleLoaded()) {
              map.setCenter([map.getCenter().lng + 0.035, map.getCenter().lat]);
            }
          }, 100);
      });
    });
    return () => {
      cancelled = true;
      if (rotation) clearInterval(rotation);
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // map is created only once; data and selection update below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    addIcons(map, events);
    (map.getSource("events") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(
      points(events),
    );
    (map.getSource("priority") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(
      points(events, true),
    );
    (map.getSource("regions") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(
      areas(events),
    );
  }, [events]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyProjection = () => map.setProjection({ type: globe ? "globe" : "mercator" });
    if (map.getStyle()) applyProjection();
    else map.once("style.load", applyProjection);
    return () => {
      map.off("style.load", applyProjection);
    };
  }, [globe]);
  const focusLat = focusLocation?.lat,
    focusLng = focusLocation?.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (focusLat === undefined || focusLng === undefined) {
      lastFocusRef.current = null;
      return;
    }
    if (!map?.isStyleLoaded()) return; // style.load uses the latest focusRef value
    const key = `${focusLat},${focusLng}`;
    if (lastFocusRef.current === key) return;
    lastFocusRef.current = key;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      map.jumpTo({ center: [focusLng, focusLat], zoom: 4 });
    else
      map.easeTo({
        center: [focusLng, focusLat],
        zoom: 4,
        duration: 3600,
        easing: approachEasing,
        essential: false,
      });
  }, [focusLat, focusLng]);
  const selectedEvent = events.find((e) => e.id === selectedId);
  const selectedLng = selectedEvent?.lng,
    selectedLat = selectedEvent?.lat,
    selectedPrecision = selectedEvent?.geoPrecision;
  useEffect(() => {
    const map = mapRef.current;
    if (map && selectedLng !== undefined && selectedLat !== undefined)
      map.flyTo({
        center: [selectedLng, selectedLat],
        zoom: Math.max(map.getZoom(), selectedPrecision === "country" ? 2.5 : compact ? 5 : 3.4),
        duration: 900,
      });
  }, [selectedId, selectedLng, selectedLat, selectedPrecision, compact]);
  return <div className="map-canvas" ref={container} aria-label="Mapa interativo de eventos" />;
}
