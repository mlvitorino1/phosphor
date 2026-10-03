import { readResponseText } from "./http";
import { mergeEvents } from "@/lib/domain/event-deduplication";
import "server-only";
import type { Category, EventRecord, Impact } from "@/lib/domain/types";
import { getCode, getName } from "country-list";
import {
  canadaAlerts,
  copernicus,
  geonet,
  nhcCyclones,
  nwsAlerts,
  tsunamiAlerts,
} from "@/lib/server/official-feeds";
import { firms, firmsConfigured, ifrc, jma, meteoalarm, who } from "@/lib/server/regional-feeds";
import { readLocalState, writeLocalState } from "@/lib/server/local-state";
import { db, getSetting, patchSetting } from "@/lib/server/database";
import { newsChannels } from "@/lib/domain/news-channels";

type FeedResult = {
  events: EventRecord[];
  available: string[];
  unavailable: string[];
  fetchedAt: string;
};
const asDate = (value: string | number | undefined) => {
  const date = new Date(value ?? 0);
  return Number.isNaN(date.valueOf()) ? new Date(0).toISOString() : date.toISOString();
};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const number = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const validPoint = (coords: unknown): coords is [number, number] =>
  Array.isArray(coords) &&
  coords.length >= 2 &&
  typeof coords[0] === "number" &&
  typeof coords[1] === "number" &&
  Number.isFinite(coords[0]) &&
  Number.isFinite(coords[1]) &&
  Math.abs(coords[0]) <= 180 &&
  Math.abs(coords[1]) <= 90;
const impactFromMagnitude = (m: number): Impact =>
  m >= 7 ? "critical" : m >= 6 ? "high" : m >= 5 ? "moderate" : "low";
const impactFromAlert = (s: string): Impact =>
  s.toLowerCase() === "red"
    ? "critical"
    : s.toLowerCase() === "orange"
      ? "high"
      : s.toLowerCase() === "green"
        ? "moderate"
        : "low";

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(12000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Fonte respondeu ${response.status}`);
  return JSON.parse(await readResponseText(response)) as unknown;
}

async function usgs(): Promise<EventRecord[]> {
  const data = (await getJson(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson",
  )) as { features?: unknown[] };
  return (data.features ?? []).flatMap((raw) => {
    const feature = raw as {
      id?: string;
      properties?: Record<string, unknown>;
      geometry?: { coordinates?: unknown };
    };
    const p = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates;
    const mag = number(p.mag);
    if (!feature.id || !validPoint(coordinates) || mag === null || !number(p.time)) return [];
    const location = text(p.place) || "Localização não informada";
    const sourceUrl = text(p.url);
    const suffix = location.split(", ").at(-1) || "";
    const country =
      suffix.length > 2 ? (getCode(suffix) ? (getName(getCode(suffix)!) ?? "") : "") : "";
    return [
      {
        id: `usgs-${feature.id}`,
        title: `Terremoto M${mag.toFixed(1)} — ${location}`,
        category: "earthquake" as const,
        location,
        country,
        lng: coordinates[0],
        lat: coordinates[1],
        geoType: "localized" as const,
        radiusKm: null,
        kind: "incident" as const,
        geoPrecision: "point" as const,
        impact: impactFromMagnitude(mag),
        status: "monitoring" as const,
        startedAt: asDate(p.time as number),
        updatedAt: asDate((number(p.updated) ?? p.time) as number),
        summary: `Terremoto de magnitude ${mag.toFixed(1)} registrado pelo USGS em ${location}. A avaliação de impacto pode mudar conforme novos dados são publicados.`,
        sources: [
          {
            name: "USGS",
            url: sourceUrl.startsWith("https://earthquake.usgs.gov/")
              ? sourceUrl
              : "https://earthquake.usgs.gov/earthquakes/",
            sourceId: feature.id,
          },
        ],
        updates: [
          {
            at: asDate((number(p.updated) ?? p.time) as number),
            text: "Registro atualizado pelo USGS.",
          },
        ],
        metrics: {
          Magnitude: mag,
          ...(number((coordinates as number[])[2]) !== null
            ? { "Profundidade (km)": (coordinates as number[])[2] }
            : {}),
        },
      },
    ];
  });
}

function eonetCategory(raw: string): Category {
  return (
    (
      {
        wildfires: "wildfire",
        severeStorms: "storm",
        volcanoes: "volcano",
        floods: "flood",
        landslides: "landslide",
        earthquakes: "earthquake",
      } as Record<string, Category>
    )[raw] ?? "other"
  );
}
async function eonet(): Promise<EventRecord[]> {
  const data = (await getJson(
    "https://eonet.gsfc.nasa.gov/api/v3/events?days=30&limit=200&status=open",
  )) as { events?: unknown[] };
  return (data.events ?? []).flatMap((raw) => {
    const e = raw as {
      id?: string;
      title?: string;
      description?: string;
      link?: string;
      closed?: string | null;
      categories?: { id?: string }[];
      sources?: { id?: string; url?: string }[];
      geometry?: {
        date?: string;
        type?: string;
        coordinates?: unknown;
        magnitudeValue?: number;
        magnitudeUnit?: string;
      }[];
    };
    const points = (e.geometry ?? []).filter(
      (g) => g.type === "Point" && validPoint(g.coordinates),
    );
    const latest = points.at(-1);
    if (!e.id || !latest || !validPoint(latest.coordinates)) return [];
    const category = eonetCategory(e.categories?.[0]?.id ?? "");
    const title = text(e.title) || "Evento natural";
    const sources = (e.sources ?? [])
      .filter((s) => typeof s.url === "string" && s.url.startsWith("https://"))
      .map((s) => ({ name: text(s.id) || "Fonte original", url: s.url!, sourceId: e.id! }));
    sources.unshift({
      name: "NASA EONET",
      url: `https://eonet.gsfc.nasa.gov/api/v3/events/${encodeURIComponent(e.id)}`,
      sourceId: e.id,
    });
    const magnitude = number(latest.magnitudeValue);
    return [
      {
        id: `eonet-${e.id}`,
        title,
        category,
        location: title,
        country: "",
        lng: latest.coordinates[0],
        lat: latest.coordinates[1],
        geoType: "regional" as const,
        radiusKm: category === "storm" ? 150 : category === "wildfire" ? 35 : 50,
        kind: "incident" as const,
        geoPrecision: "area" as const,
        impact:
          magnitude !== null && category === "storm"
            ? ((magnitude >= 95 ? "critical" : magnitude >= 65 ? "high" : "moderate") as Impact)
            : ("moderate" as Impact),
        status: e.closed ? ("closed" as const) : ("active" as const),
        startedAt: asDate(points[0]?.date),
        updatedAt: asDate(latest.date),
        summary:
          text(e.description) ||
          `${title}. Localização aproximada baseada na observação mais recente publicada pela NASA EONET.`,
        sources,
        updates: points
          .slice(-5)
          .reverse()
          .map((g) => ({ at: asDate(g.date), text: "Nova observação geográfica registrada." })),
        metrics: {
          ...(magnitude !== null
            ? {
                [text(latest.magnitudeUnit)
                  ? `Intensidade (${latest.magnitudeUnit})`
                  : "Intensidade"]: magnitude,
              }
            : {}),
          Observações: points.length,
        },
      },
    ];
  });
}

function gdacsCategory(raw: string): Category {
  return (
    (
      {
        EQ: "earthquake",
        TC: "storm",
        FL: "flood",
        VO: "volcano",
        WF: "wildfire",
        DR: "other",
      } as Record<string, Category>
    )[raw] ?? "other"
  );
}
async function gdacs(): Promise<EventRecord[]> {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86400000);
  const params = new URLSearchParams({
    eventlist: "EQ,TC,FL,VO,WF",
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  });
  const data = (await getJson(
    `https://www.gdacs.org/gdacsapi/api/Events/geteventlist/search?${params}`,
  )) as { features?: unknown[] };
  const seen = new Set<string>();
  return (data.features ?? []).flatMap((raw) => {
    const f = raw as { geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
    const p = f.properties ?? {};
    const coordinates = f.geometry?.coordinates;
    const id = `${text(p.eventtype)}-${p.eventid}`;
    if (!validPoint(coordinates) || !p.eventid || seen.has(id)) return [];
    seen.add(id);
    const title = text(p.name) || text(p.description) || "Evento natural";
    const country = text(p.country);
    const category = gdacsCategory(text(p.eventtype));
    const alert = text(p.alertlevel);
    const urls = p.url as { report?: string } | undefined;
    const report = urls?.report?.startsWith("https://www.gdacs.org/")
      ? urls.report
      : "https://www.gdacs.org/";
    const metrics: Record<string, string | number> = { "Alerta GDACS": alert || "Não informado" };
    const severity = p.severitydata as { severitytext?: string } | undefined;
    if (text(severity?.severitytext)) metrics.Severidade = text(severity?.severitytext);
    return [
      {
        id: `gdacs-${id}`,
        title,
        category,
        location: country || title,
        country,
        lng: coordinates[0],
        lat: coordinates[1],
        geoType: category === "earthquake" ? ("localized" as const) : ("regional" as const),
        radiusKm: category === "earthquake" ? null : category === "storm" ? 150 : 75,
        kind: "alert" as const,
        geoPrecision: category === "earthquake" ? ("point" as const) : ("area" as const),
        impact: impactFromAlert(alert),
        status: text(p.iscurrent) === "true" ? ("active" as const) : ("monitoring" as const),
        startedAt: asDate(text(p.fromdate) + "Z"),
        updatedAt: asDate(text(p.datemodified) + "Z"),
        summary: `${title}${country ? ` em ${country}` : ""}. O alerta é classificado como ${alert || "não informado"} pelo GDACS. A área exibida é uma aproximação visual, não um limite oficial.`,
        sources: [{ name: "GDACS", url: report, sourceId: id }],
        updates: [
          { at: asDate(text(p.datemodified) + "Z"), text: "Alerta atualizado pelo GDACS." },
        ],
        metrics,
      },
    ];
  });
}

async function fetchFeeds(): Promise<FeedResult> {
  const sources = [
    { name: "USGS", run: usgs },
    { name: "NASA EONET", run: eonet },
    { name: "GDACS", run: gdacs },
    { name: "NOAA/NWS", run: nwsAlerts },
    { name: "GeoMet Canadá", run: canadaAlerts },
    { name: "MeteoAlarm", run: meteoalarm },
    { name: "NOAA/NHC", run: nhcCyclones },
    { name: "NOAA Tsunami", run: tsunamiAlerts },
    { name: "JMA", run: jma },
    { name: "Copernicus EMS", run: copernicus },
    { name: "GeoNet", run: geonet },
    { name: "IFRC GO", run: ifrc },
    { name: "OMS", run: who },
    ...(firmsConfigured() ? [{ name: "NASA FIRMS", run: firms }] : []),
  ];
  const sourceFlags = db()
    ? ((await getSetting<Record<string, boolean>>("sources")) ?? {})
    : readLocalState().sources;
  const activeSources = sources.filter((s) => sourceFlags[s.name] !== false);
  const results = await Promise.allSettled(activeSources.map((s) => s.run()));
  const events: EventRecord[] = [],
    available: string[] = [],
    unavailable: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      events.push(...result.value);
      available.push(activeSources[index].name);
    } else {
      unavailable.push(activeSources[index].name);
      console.error(`${activeSources[index].name} indisponível:`, result.reason);
    }
  });
  return {
    events: mergeEvents(events).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    available,
    unavailable,
    fetchedAt: new Date().toISOString(),
  };
}
let cached: { until: number; value: FeedResult } | null = null;
let pending: Promise<FeedResult> | null = null;
export function resetFeedCache() {
  cached = null;
  pending = null;
}
export async function loadFeeds(): Promise<FeedResult> {
  if (cached && Date.now() < cached.until) return cached.value;
  pending ??= fetchFeeds();
  try {
    const value = await pending;
    if (value.available.length) cached = { until: Date.now() + 300000, value };
    return value;
  } finally {
    pending = null;
  }
}
export function allSourceNames() {
  return [
    "USGS",
    "NASA EONET",
    "GDACS",
    "NOAA/NWS",
    "GeoMet Canadá",
    "MeteoAlarm",
    "NOAA/NHC",
    "NOAA Tsunami",
    "JMA",
    "Copernicus EMS",
    "GeoNet",
    "IFRC GO",
    "OMS",
    ...(firmsConfigured() ? ["NASA FIRMS"] : []),
  ];
}
export async function sourceSettings() {
  const sourceFlags = db()
    ? ((await getSetting<Record<string, boolean>>("sources")) ?? {})
    : readLocalState().sources;
  return [
    ...allSourceNames(),
    "GDELT",
    ...newsChannels.map((channel) => channel.name),
    "Agência Brasil",
  ].map((name) => ({ name, enabled: sourceFlags[name] !== false }));
}
export async function setSourceEnabled(name: string, enabled: boolean) {
  if (
    ![
      ...allSourceNames(),
      "GDELT",
      ...newsChannels.map((channel) => channel.name),
      "Agência Brasil",
    ].includes(name)
  )
    return false;
  if (db()) {
    const saved = await patchSetting("sources", name, enabled);
    resetFeedCache();
    return saved;
  }
  if (process.env.NODE_ENV === "production") return false;
  const state = readLocalState();
  state.sources[name] = enabled;
  writeLocalState(state);
  resetFeedCache();
  return true;
}
