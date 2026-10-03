import "server-only";
import { readResponseText } from "./http";
import country from "country-list-js";
import type { EventRecord } from "@/lib/domain/types";
import {
  activeUntil,
  categoryFromText,
  cleanText,
  countryPoint,
  date,
  fetchJson,
  fetchXml,
  finite,
  impactFromSeverity,
  list,
  point,
  record,
  words,
} from "@/lib/server/source-utils";

type AtomLink = { "@_href"?: string; "@_type"?: string };
type MeteoEntry = {
  identifier?: string;
  id?: string;
  title?: string;
  event?: string;
  severity?: string;
  expires?: string;
  updated?: string;
};
const meteoCountries: [string, string][] = [
  ["andorra", "AD"],
  ["austria", "AT"],
  ["belgium", "BE"],
  ["bosnia-herzegovina", "BA"],
  ["bulgaria", "BG"],
  ["croatia", "HR"],
  ["cyprus", "CY"],
  ["czechia", "CZ"],
  ["denmark", "DK"],
  ["estonia", "EE"],
  ["finland", "FI"],
  ["france", "FR"],
  ["germany", "DE"],
  ["greece", "GR"],
  ["hungary", "HU"],
  ["iceland", "IS"],
  ["ireland", "IE"],
  ["israel", "IL"],
  ["italy", "IT"],
  ["latvia", "LV"],
  ["lithuania", "LT"],
  ["luxembourg", "LU"],
  ["malta", "MT"],
  ["moldova", "MD"],
  ["montenegro", "ME"],
  ["netherlands", "NL"],
  ["republic-of-north-macedonia", "MK"],
  ["norway", "NO"],
  ["poland", "PL"],
  ["portugal", "PT"],
  ["romania", "RO"],
  ["serbia", "RS"],
  ["slovakia", "SK"],
  ["slovenia", "SI"],
  ["spain", "ES"],
  ["sweden", "SE"],
  ["switzerland", "CH"],
  ["ukraine", "UA"],
  ["united-kingdom", "GB"],
];

export async function meteoalarm(): Promise<EventRecord[]> {
  const results = await Promise.allSettled(
    meteoCountries.map(([slug]) =>
      fetchXml<{ feed?: { entry?: MeteoEntry | MeteoEntry[] } }>(
        `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${slug}`,
        600,
      ),
    ),
  );
  if (results.every((r) => r.status === "rejected"))
    throw new Error("Feeds Atom do MeteoAlarm indisponíveis");
  const events: EventRecord[] = [];
  results.forEach((result, index) => {
    if (result.status !== "fulfilled") return;
    const [slug, iso] = meteoCountries[index],
      countryLocation = countryPoint(iso);
    if (!countryLocation) return;
    const unique = new Set<string>();
    const byCategory = new Map<
      string,
      { count: number; impact: EventRecord["impact"]; updated: string }
    >();
    for (const entry of list(result.value.feed?.entry)) {
      const key = words(entry.identifier) || words(entry.id);
      if (!key || unique.has(key) || !activeUntil(entry.expires)) continue;
      unique.add(key);
      const severity = words(entry.severity),
        hazard = words(entry.event) || words(entry.title);
      if (!["Moderate", "Severe", "Extreme"].includes(severity)) continue;
      const detected = categoryFromText(hazard);
      const category = detected === "other" ? "storm" : detected;
      const updated = date(entry.updated) || new Date().toISOString();
      const group = byCategory.get(category) ?? { count: 0, impact: "low", updated };
      group.count++;
      if (
        ["low", "moderate", "high", "critical"].indexOf(impactFromSeverity(severity)) >
        ["low", "moderate", "high", "critical"].indexOf(group.impact)
      )
        group.impact = impactFromSeverity(severity);
      if (updated > group.updated) group.updated = updated;
      byCategory.set(category, group);
    }
    for (const [category, group] of byCategory) {
      events.push(
        record({
          id: `meteoalarm-${iso}-${category}`,
          title: `${group.count} alerta${group.count === 1 ? "" : "s"} de ${category === "storm" ? "tempo severo" : category === "flood" ? "inundação" : category === "wildfire" ? "risco de incêndio" : "risco ambiental"} — ${countryLocation.country}`,
          category: category as EventRecord["category"],
          kind: "alert",
          location: countryLocation.country,
          country: countryLocation.country,
          lat: countryLocation.lat,
          lng: countryLocation.lng,
          precision: "country",
          impact: group.impact,
          startedAt: group.updated,
          summary: `${group.count} alerta(s) ativos do MeteoAlarm em diferentes áreas de ${countryLocation.country}. O marcador indica apenas o país; consulte a fonte para identificar as regiões sob aviso.`,
          sourceName: "MeteoAlarm",
          sourceUrl: `https://meteoalarm.org?region=${iso}`,
          sourceId: `${slug}-${category}`,
          metrics: {
            "Alertas ativos": group.count,
            Precisão: "País; áreas individuais disponíveis na fonte",
          },
        }),
      );
    }
  });
  return events;
}

function jmaCoordinate(value: unknown): [number, number] | null {
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(obj)) {
      if (key === "Coordinate") {
        const raw =
          typeof child === "string"
            ? child
            : typeof child === "object" && child
              ? words((child as Record<string, unknown>)["#text"])
              : "";
        const match = raw.match(/\+(-?\d+(?:\.\d+)?)\+(-?\d+(?:\.\d+)?)/);
        if (match) {
          const result = point([match[2], match[1]]);
          if (result) return result;
        }
      }
      const found = jmaCoordinate(child);
      if (found) return found;
    }
  }
  return null;
}
export async function jma(): Promise<EventRecord[]> {
  type Entry = { id?: string; title?: string; updated?: string; link?: AtomLink | AtomLink[] };
  const feeds = [
    "https://www.data.jma.go.jp/developer/xml/feed/eqvol.xml",
    "https://www.data.jma.go.jp/developer/xml/feed/extra.xml",
  ];
  const feedResults = await Promise.allSettled(
    feeds.map((url) => fetchXml<{ feed?: { entry?: Entry | Entry[] } }>(url, 120)),
  );
  if (feedResults.every((r) => r.status === "rejected"))
    throw new Error("Feeds XML da JMA indisponíveis");
  const entries = feedResults
    .flatMap((r) => (r.status === "fulfilled" ? list(r.value.feed?.entry) : []))
    .filter(
      (e) =>
        /地震|津波|火山|噴火/.test(words(e.title)) &&
        date(e.updated) &&
        Date.parse(date(e.updated)!) > Date.now() - 48 * 3600000,
    )
    .slice(0, 35);
  const documents = await Promise.allSettled(
    entries.map(async (entry) => {
      const url = list(entry.link).find((l) => l["@_type"] === "application/xml")?.["@_href"];
      if (!url?.startsWith("https://www.data.jma.go.jp/developer/xml/data/")) return null;
      const doc = await fetchXml<{
        Report?: {
          Head?: {
            EventID?: string | number;
            Title?: string;
            ReportDateTime?: string;
            InfoKind?: string;
            Headline?: { Text?: string };
          };
          Body?: Record<string, unknown>;
        };
      }>(url, 300);
      const head = doc.Report?.Head,
        body = doc.Report?.Body;
      const rawTitle = words(head?.Title) || words(entry.title),
        category = /津波/.test(rawTitle)
          ? "tsunami"
          : /火山|噴火/.test(rawTitle)
            ? "volcano"
            : "earthquake";
      const center = jmaCoordinate(body),
        fallback = countryPoint("JP"),
        issued = date(head?.ReportDateTime) || date(entry.updated);
      if (!issued || (!center && !fallback)) return null;
      if (category === "earthquake" && !center) return null;
      const quake = body?.Earthquake as
        | { Hypocenter?: { Area?: { Name?: string }; Magnitude?: { "#text"?: string | number } } }
        | undefined;
      const magnitude = finite(quake?.Hypocenter?.Magnitude?.["#text"]);
      if (category === "earthquake" && (magnitude === null || magnitude < 4.5)) return null;
      const id = String(head?.EventID || entry.id || url);
      const title =
        category === "earthquake"
          ? `Terremoto M${magnitude!.toFixed(1)} — ${words(quake?.Hypocenter?.Area?.Name) || "Japão"}`
          : category === "tsunami"
            ? "Boletim de tsunami — Japão"
            : "Boletim vulcânico — Japão";
      return record({
        id: `jma-${category}-${encodeURIComponent(id)}`,
        title,
        category,
        kind: category === "earthquake" ? "incident" : "alert",
        location: words(quake?.Hypocenter?.Area?.Name) || "Japão",
        country: "Japan",
        lng: center?.[0] ?? fallback!.lng,
        lat: center?.[1] ?? fallback!.lat,
        precision: center ? "point" : "country",
        impact:
          magnitude !== null && magnitude >= 7
            ? "critical"
            : magnitude !== null && magnitude >= 6
              ? "high"
              : "moderate",
        startedAt: issued,
        summary:
          cleanText(head?.Headline?.Text, 450) ||
          `Boletim oficial da Agência Meteorológica do Japão. ${center ? "" : "A posição indicada representa apenas o Japão."}`,
        sourceName: "JMA",
        sourceUrl: url,
        sourceId: id,
        metrics: {
          ...(magnitude !== null ? { Magnitude: magnitude } : {}),
          "Tipo de boletim": words(head?.InfoKind) || rawTitle,
        },
      });
    }),
  );
  return documents.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}

export async function ifrc(): Promise<EventRecord[]> {
  type Item = {
    id?: number;
    name?: string;
    summary?: string;
    dtype?: { name?: string };
    countries?: { iso?: string; name?: string }[];
    disaster_start_date?: string;
    updated_at?: string;
    created_at?: string;
    num_affected?: number;
    ifrc_severity_level_display?: string;
  };
  const data = await fetchJson<{ results?: Item[] }>(
    "https://goadmin.ifrc.org/api/v2/event/?limit=30&ordering=-created_at",
    900,
  );
  return (data.results ?? [])
    .flatMap((item) => {
      const started = date(item.disaster_start_date) || date(item.created_at),
        updated = date(item.updated_at) || started;
      if (!item.id || !started || !updated || Date.parse(updated) < Date.now() - 21 * 86400000)
        return [];
      return (item.countries ?? []).slice(0, 4).flatMap((c) => {
        const location = countryPoint(words(c.iso) || words(c.name));
        if (!location) return [];
        const hazard = words(item.dtype?.name) || "Emergência";
        return [
          record({
            id: `ifrc-${item.id}-${words(c.iso)}`,
            title: words(item.name) || `${hazard} — ${location.country}`,
            category: categoryFromText(hazard),
            kind: "incident",
            location: location.country,
            country: location.country,
            lng: location.lng,
            lat: location.lat,
            precision: "country",
            impact: impactFromSeverity(words(item.ifrc_severity_level_display)),
            startedAt: started,
            updatedAt: updated,
            summary: `${cleanText(item.summary, 400) || `${hazard} registrado pela Federação Internacional da Cruz Vermelha.`} A posição no mapa representa apenas o país afetado.`,
            sourceName: "IFRC GO",
            sourceUrl: `https://goadmin.ifrc.org/api/v2/event/${item.id}/`,
            sourceId: String(item.id),
            metrics: {
              ...(finite(item.num_affected) !== null
                ? { "Pessoas afetadas": finite(item.num_affected)! }
                : {}),
              Precisão: "País",
            },
          }),
        ];
      });
    })
    .slice(0, 80);
}

function whoCountry(title: string) {
  const aliases: [RegExp, string][] = [
    [/democratic republic of (the )?congo|dr congo|drc/i, "CD"],
    [/republic of (the )?congo/i, "CG"],
    [/united states|\busa\b/i, "US"],
    [/united kingdom|\buk\b/i, "GB"],
  ];
  for (const [pattern, iso] of aliases) if (pattern.test(title)) return countryPoint(iso);
  const entries = Object.entries(country.all)
    .filter(([, c]) => c.name.length >= 5)
    .sort((a, b) => b[1].name.length - a[1].name.length);
  const match = entries.find(([, c]) =>
    new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(title),
  );
  return match ? countryPoint(match[0]) : null;
}
export async function who(): Promise<EventRecord[]> {
  type Item = {
    Id?: string;
    Title?: string;
    PublicationDate?: string;
    LastModified?: string;
    UrlName?: string;
  };
  const url =
    "https://www.who.int/api/hubs/diseaseoutbreaknews?$top=35&$orderby=PublicationDate%20desc&$select=Id,Title,PublicationDate,LastModified,UrlName";
  const data = await fetchJson<{ value?: Item[] }>(url, 1800);
  return (data.value ?? []).flatMap((item) => {
    const title = words(item.Title),
      location = whoCountry(title),
      issued = date(item.PublicationDate);
    if (
      !item.Id ||
      !title ||
      !location ||
      !issued ||
      Date.parse(issued) < Date.now() - 45 * 86400000
    )
      return [];
    return [
      record({
        id: `who-${item.Id}`,
        title,
        category: "health",
        kind: "incident",
        location: location.country,
        country: location.country,
        lng: location.lng,
        lat: location.lat,
        precision: "country",
        impact: "moderate",
        startedAt: issued,
        updatedAt: date(item.LastModified) || issued,
        summary: `Comunicado da Organização Mundial da Saúde sobre evento de saúde pública. A posição no mapa representa o país citado no título, sem indicar a área exata do surto.`,
        sourceName: "OMS",
        sourceUrl: `https://www.who.int/emergencies/disease-outbreak-news/item/${encodeURIComponent(words(item.UrlName))}`,
        sourceId: item.Id,
        metrics: { Precisão: "País citado no comunicado" },
      }),
    ];
  });
}

export function firmsConfigured() {
  return Boolean(process.env.FIRMS_MAP_KEY);
}
export async function firms(): Promise<EventRecord[]> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) return [];
  // This provider puts its key in the URL: refuse redirects and persistent fetch caching.
  const response = await fetch(
    `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_NOAA21_NRT/world/1`,
    {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "text/csv" },
    },
  );
  if (!response.ok) throw new Error(`NASA FIRMS: HTTP ${response.status}`);
  const csv = await readResponseText(response);
  const lines = csv.trim().split(/\r?\n/),
    header = lines.shift()?.split(",") ?? [];
  const indexes = Object.fromEntries(header.map((name, i) => [name, i]));
  const groups = new Map<string, { lat: number; lng: number; count: number; latest: string }>();
  for (const line of lines) {
    const cols = line.split(","),
      lat = finite(cols[indexes.latitude]),
      lng = finite(cols[indexes.longitude]);
    if (lat === null || lng === null || !point([lng, lat])) continue;
    if (indexes.type !== undefined && cols[indexes.type] !== "0") continue;
    if (indexes.confidence !== undefined && cols[indexes.confidence]?.toLowerCase() === "l")
      continue;
    const day = words(cols[indexes.acq_date]),
      time = words(cols[indexes.acq_time]).padStart(4, "0");
    const observed = date(`${day}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`);
    if (!observed) continue;
    const cell = `${Math.floor(lat * 4) / 4},${Math.floor(lng * 4) / 4}`;
    const group = groups.get(cell) ?? { lat: 0, lng: 0, count: 0, latest: observed };
    group.lat += lat;
    group.lng += lng;
    group.count++;
    if (observed > group.latest) group.latest = observed;
    groups.set(cell, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.count >= 3)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 120)
    .map(([cell, group]) =>
      record({
        id: `firms-${group.latest.slice(0, 10)}-${cell}`,
        title: `Focos de calor detectados por satélite`,
        category: "wildfire",
        kind: "observation",
        location: `Região de ${cell}`,
        lng: group.lng / group.count,
        lat: group.lat / group.count,
        precision: "area",
        impact: group.count >= 50 ? "high" : "moderate",
        startedAt: group.latest,
        summary: `${group.count} detecções térmicas próximas registradas pelo satélite NOAA-21. Detecção de calor não confirma, por si só, um incêndio florestal.`,
        sourceName: "NASA FIRMS",
        sourceUrl: "https://firms.modaps.eosdis.nasa.gov/map/",
        sourceId: cell,
        metrics: {
          "Detecções térmicas": group.count,
          Sensor: "VIIRS NOAA-21",
          Precisão: "Grupo de observações em grade de 0,25°",
        },
      }),
    );
}
