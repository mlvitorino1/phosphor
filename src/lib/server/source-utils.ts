import { readResponseText } from "./http";
import "server-only";
import country from "country-list-js";
import { XMLParser } from "fast-xml-parser";
import type { AreaGeometry, Category, EventRecord, Impact, RecordKind } from "@/lib/domain/types";

export const words = (value: unknown) => (typeof value === "string" ? value.trim() : "");
export const finite = (value: unknown): number | null => {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  return Number.isFinite(n) ? n : null;
};
export const date = (value: unknown): string | null => {
  const d = new Date(typeof value === "string" || typeof value === "number" ? value : 0);
  return Number.isFinite(d.valueOf()) && d.valueOf() > 0 ? d.toISOString() : null;
};
export const list = <T>(value: T | T[] | undefined | null): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
export const point = (value: unknown): [number, number] | null => {
  if (!Array.isArray(value)) return null;
  const lng = finite(value[0]),
    lat = finite(value[1]);
  return lng !== null && lat !== null && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
    ? [lng, lat]
    : null;
};
export const cleanText = (value: unknown, max = 500) =>
  words(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, max);
export const activeUntil = (value: unknown) => {
  const d = date(value);
  return !d || Date.parse(d) > Date.now();
};

export async function fetchText(
  url: string,
  revalidate = 300,
  accept = "application/json",
): Promise<string> {
  const response = await fetch(url, {
    next: { revalidate },
    signal: AbortSignal.timeout(12000),
    headers: { Accept: accept, "User-Agent": "Phosphor/0.2 (public event monitor)" },
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname}: HTTP ${response.status}`);
  return readResponseText(response);
}
export async function fetchJson<T>(url: string, revalidate = 300): Promise<T> {
  return JSON.parse(await fetchText(url, revalidate)) as T;
}
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
});
export async function fetchXml<T>(url: string, revalidate = 300): Promise<T> {
  return parser.parse(
    await fetchText(url, revalidate, "application/xml, application/atom+xml, text/xml, */*"),
  ) as T;
}

export function countryPoint(
  codeOrName: string,
): { lat: number; lng: number; country: string } | null {
  const entry =
    country.findByIso2(codeOrName.toUpperCase()) ||
    country.findByIso3(codeOrName.toUpperCase()) ||
    country.findByName(codeOrName);
  if (!entry?.latlng || entry.latlng.length < 2) return null;
  const [lat, lng] = entry.latlng;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, country: entry.name } : null;
}
export function validGeometry(value: unknown): AreaGeometry | null {
  if (!value || typeof value !== "object") return null;
  const geometry = value as { type?: string; coordinates?: unknown };
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return null;
  const rings =
    geometry.type === "Polygon"
      ? geometry.coordinates
      : Array.isArray(geometry.coordinates)
        ? geometry.coordinates[0]
        : null;
  if (
    !Array.isArray(rings) ||
    !Array.isArray(rings[0]) ||
    rings[0].length < 4 ||
    !rings[0].every((p: unknown) => point(p))
  )
    return null;
  return value as AreaGeometry;
}
export function geometryCenter(geometry: AreaGeometry): [number, number] | null {
  const ring =
    geometry.type === "Polygon"
      ? (geometry.coordinates as number[][][])[0]
      : (geometry.coordinates as number[][][][])[0]?.[0];
  if (!ring?.length) return null;
  const points = ring.map(point).filter((p): p is [number, number] => Boolean(p));
  if (!points.length) return null;
  const lngs = points.map((p) => p[0]),
    lats = points.map((p) => p[1]);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}
export function categoryFromText(value: string): Category {
  const s = value.toLowerCase();
  if (/tsunami/.test(s)) return "tsunami";
  if (/earthquake|quake|s[eí]ism/.test(s)) return "earthquake";
  if (/volcan|eruption/.test(s)) return "volcano";
  if (/wildfire|forest fire|bushfire|fire weather/.test(s)) return "wildfire";
  if (/flood|inund|storm surge|coastal water|high water/.test(s)) return "flood";
  if (/landslide|mudslide|avalanche/.test(s)) return "landslide";
  if (/epidem|outbreak|disease|cholera|ebola/.test(s)) return "health";
  if (/civil|evacuation|hazardous material|industrial|nuclear|radiolog|chemical/.test(s))
    return "civil";
  if (
    /storm|hurricane|cyclone|tornado|wind|rain|snow|blizzard|heat|cold|thunder|hail|weather|tempest/.test(
      s,
    )
  )
    return "storm";
  return "other";
}
export function impactFromSeverity(value: string): Impact {
  const s = value.toLowerCase();
  if (/extreme|critical|red|niveau 4/.test(s)) return "critical";
  if (/severe|high|orange|niveau 3/.test(s)) return "high";
  if (/moderate|yellow|amber|niveau 2/.test(s)) return "moderate";
  return "low";
}
type RecordInput = {
  id: string;
  title: string;
  category: Category;
  kind: RecordKind;
  location: string;
  country?: string;
  lat: number;
  lng: number;
  precision?: "point" | "area" | "country";
  geometry?: AreaGeometry;
  impact?: Impact;
  status?: EventRecord["status"];
  startedAt: string;
  updatedAt?: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sourceId?: string;
  metrics?: EventRecord["metrics"];
};
export function record(input: RecordInput): EventRecord {
  return {
    id: input.id,
    title: input.title,
    category: input.category,
    kind: input.kind,
    location: input.location,
    country: input.country ?? "",
    lat: input.lat,
    lng: input.lng,
    geoType: input.precision === "point" ? "localized" : "regional",
    geoPrecision: input.precision ?? "area",
    radiusKm: null,
    ...(input.geometry ? { geometry: input.geometry } : {}),
    impact: input.impact ?? "moderate",
    status: input.status ?? "active",
    startedAt: input.startedAt,
    updatedAt: input.updatedAt ?? input.startedAt,
    summary: input.summary,
    sources: [
      { name: input.sourceName, url: input.sourceUrl, sourceId: input.sourceId ?? input.id },
    ],
    updates: [
      {
        at: input.updatedAt ?? input.startedAt,
        text: `Registro atualizado por ${input.sourceName}.`,
      },
    ],
    metrics: input.metrics ?? {},
  };
}
