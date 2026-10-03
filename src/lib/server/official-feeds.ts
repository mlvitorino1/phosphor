import "server-only";
import type { EventRecord } from "@/lib/domain/types";
import {
  activeUntil,
  categoryFromText,
  cleanText,
  date,
  fetchJson,
  fetchXml,
  finite,
  geometryCenter,
  impactFromSeverity,
  list,
  point,
  record,
  validGeometry,
  words,
} from "@/lib/server/source-utils";

type Feature = { id?: string; geometry?: unknown; properties?: Record<string, unknown> };
type Collection = { features?: Feature[] };
type Link = { "@_href"?: string; "@_type"?: string; "@_rel"?: string };
type AtomEntry = {
  id?: string;
  title?: string;
  updated?: string;
  lat?: string;
  long?: string;
  link?: Link | Link[];
};

export async function nwsAlerts(): Promise<EventRecord[]> {
  const data = await fetchJson<Collection>(
    "https://api.weather.gov/alerts/active?status=actual&severity=Severe,Extreme",
  );
  return (data.features ?? [])
    .flatMap((f) => {
      const p = f.properties ?? {},
        geometry = validGeometry(f.geometry);
      const center = geometry && geometryCenter(geometry);
      const event = words(p.event),
        severity = words(p.severity);
      const issued = date(p.sent),
        expires = p.ends || p.expires;
      if (!center || !issued || !activeUntil(expires) || !["Severe", "Extreme"].includes(severity))
        return [];
      const id = words(p.id) || words(f.id);
      if (!id) return [];
      const category = categoryFromText(event);
      const label = /tornado/i.test(event)
        ? "Alerta de tornado"
        : (
            {
              flood: "Alerta de inundação",
              storm: "Alerta meteorológico",
              wildfire: "Alerta de incêndio",
              civil: "Alerta de emergência civil",
            } as Record<string, string>
          )[category] || `Alerta: ${event}`;
      const title = `${label} — ${cleanText(p.areaDesc, 85) || "Estados Unidos"}`;
      return [
        record({
          id: `nws-${encodeURIComponent(id)}`,
          title,
          category,
          kind: "alert",
          location: cleanText(p.areaDesc, 160) || "Estados Unidos",
          country: "United States",
          lng: center[0],
          lat: center[1],
          precision: "area",
          geometry,
          impact: impactFromSeverity(severity),
          startedAt: issued,
          updatedAt: date(p.sent) ?? issued,
          summary:
            cleanText(p.description, 500) ||
            `Alerta oficial ${event} publicado pelo National Weather Service.`,
          sourceName: "NOAA/NWS",
          sourceUrl: words(p["@id"]) || words(f.id) || "https://api.weather.gov/alerts/active",
          sourceId: id,
          metrics: {
            "Tipo original": event,
            Severidade: severity,
            Certeza: words(p.certainty) || "Não informada",
            Expira: date(expires) ?? "Não informado",
          },
        }),
      ];
    })
    .slice(0, 350);
}

export async function canadaAlerts(): Promise<EventRecord[]> {
  const data = await fetchJson<Collection>(
    "https://api.weather.gc.ca/collections/weather-alerts/items?limit=500&f=json",
  );
  return (data.features ?? []).flatMap((f) => {
    const p = f.properties ?? {},
      geometry = validGeometry(f.geometry),
      center = geometry && geometryCenter(geometry);
    const issued = date(p.publication_datetime),
      id = words(f.id) || words(p.id);
    if (!center || !issued || !id || !activeUntil(p.expiration_datetime)) return [];
    const hazard = words(p.alert_name_en) || "Weather alert";
    const location = words(p.feature_name_en) || words(p.province) || "Canadá";
    return [
      record({
        id: `eccc-${id}`,
        title: `${hazard} — ${location}`,
        category: categoryFromText(hazard),
        kind: "alert",
        location,
        country: "Canada",
        lng: center[0],
        lat: center[1],
        precision: "area",
        geometry,
        impact: impactFromSeverity(words(p.risk_colour_en) || words(p.impact_en)),
        startedAt: issued,
        summary:
          cleanText(p.alert_text_en, 500) || `Alerta meteorológico publicado para ${location}.`,
        sourceName: "GeoMet Canadá",
        sourceUrl: `https://api.weather.gc.ca/collections/weather-alerts/items/${encodeURIComponent(id)}?f=html`,
        sourceId: id,
        metrics: {
          Tipo: words(p.alert_type) || hazard,
          Expira: date(p.expiration_datetime) ?? "Não informado",
        },
      }),
    ];
  });
}

export async function nhcCyclones(): Promise<EventRecord[]> {
  const data = await fetchJson<{ activeStorms?: Record<string, unknown>[] }>(
    "https://www.nhc.noaa.gov/CurrentStorms.json",
  );
  return (data.activeStorms ?? []).flatMap((s) => {
    const center = point([s.longitudeNumeric, s.latitudeNumeric]);
    const id = words(s.id),
      updated = date(s.lastUpdate),
      name = words(s.name);
    if (!center || !id || !updated) return [];
    const wind = finite(s.intensity);
    const advisory = s.publicAdvisory as { url?: string } | undefined;
    return [
      record({
        id: `nhc-${id}`,
        title: `${words(s.classification) === "HU" ? "Furacão" : "Ciclone tropical"} ${name || id}`,
        category: "storm",
        kind: "incident",
        location: name || "Oceano",
        lng: center[0],
        lat: center[1],
        precision: "point",
        impact:
          wind !== null && wind >= 96
            ? "critical"
            : wind !== null && wind >= 64
              ? "high"
              : "moderate",
        startedAt: updated,
        updatedAt: updated,
        summary: `Posição do centro do ciclone tropical publicada pelo National Hurricane Center. A trajetória e a área de ventos exigem produtos geográficos próprios.`,
        sourceName: "NOAA/NHC",
        sourceUrl: advisory?.url?.startsWith("https://www.nhc.noaa.gov/")
          ? advisory.url
          : "https://www.nhc.noaa.gov/",
        sourceId: id,
        metrics: {
          ...(wind !== null ? { "Vento (nós)": wind } : {}),
          ...(finite(s.pressure) !== null ? { "Pressão (hPa)": finite(s.pressure)! } : {}),
        },
      }),
    ];
  });
}

export async function tsunamiAlerts(): Promise<EventRecord[]> {
  const feeds = [
    "https://www.tsunami.gov/events/xml/PAAQAtom.xml",
    "https://www.tsunami.gov/events/xml/PHEBAtom.xml",
  ];
  const results = await Promise.allSettled(
    feeds.map((url) => fetchXml<{ feed?: { entry?: AtomEntry | AtomEntry[] } }>(url)),
  );
  const entries = results.flatMap((r) =>
    r.status === "fulfilled" ? list(r.value.feed?.entry) : [],
  );
  if (results.every((r) => r.status === "rejected"))
    throw new Error("Feeds de tsunami indisponíveis");
  const candidates = entries
    .filter(
      (e) =>
        /tsunami (warning|advisory|watch)/i.test(words(e.title)) &&
        date(e.updated) &&
        Date.parse(date(e.updated)!) > Date.now() - 48 * 3600000,
    )
    .slice(0, 12);
  const docs = await Promise.allSettled(
    candidates.map(async (entry) => {
      const cap = list(entry.link).find((l) => l["@_type"] === "application/cap+xml")?.["@_href"];
      if (!cap?.startsWith("https://www.tsunami.gov/")) return null;
      const document = await fetchXml<{
        alert?: {
          identifier?: string;
          sent?: string;
          info?: {
            event?: string;
            severity?: string;
            expires?: string;
            headline?: string;
            description?: string;
            area?:
              | { areaDesc?: string; polygon?: string; circle?: string }
              | { areaDesc?: string; polygon?: string; circle?: string }[];
          };
        };
      }>(cap);
      const alert = document.alert,
        info = alert?.info;
      if (!alert || !info || !activeUntil(info.expires)) return null;
      const area = list(info.area)[0];
      const polygon = words(area?.polygon)
        .split(/\s+/)
        .map((pair) => {
          const [lat, lng] = pair.split(",").map(Number);
          return [lng, lat];
        });
      const geometry =
        polygon.length >= 4 && polygon.every(point)
          ? validGeometry({ type: "Polygon", coordinates: [polygon] })
          : null;
      const center = geometry ? geometryCenter(geometry) : point([entry.long, entry.lat]);
      const issued = date(alert.sent) || date(entry.updated);
      if (!center || !issued) return null;
      return record({
        id: `tsunami-${alert.identifier || encodeURIComponent(words(entry.id))}`,
        title: cleanText(info.headline, 180) || words(entry.title),
        category: "tsunami",
        kind: "alert",
        location: words(area?.areaDesc) || words(entry.title) || "Região sob aviso",
        lng: center[0],
        lat: center[1],
        precision: geometry ? "area" : "point",
        ...(geometry ? { geometry } : {}),
        impact: impactFromSeverity(words(info.severity)),
        startedAt: issued,
        summary: cleanText(info.description, 500) || "Alerta oficial de tsunami.",
        sourceName: "NOAA Tsunami",
        sourceUrl: cap,
        sourceId: alert.identifier || words(entry.id),
        metrics: {
          Expira: date(info.expires) ?? "Não informado",
          ...(geometry ? {} : { Localização: "Ponto de referência; área do aviso não delimitada" }),
        },
      });
    }),
  );
  return docs.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
}

export async function geonet(): Promise<EventRecord[]> {
  const [quakeData, volcanoData] = await Promise.all([
    fetchJson<Collection>("https://api.geonet.org.nz/quake?MMI=4"),
    fetchJson<Collection>("https://api.geonet.org.nz/volcano/val"),
  ]);
  const quakes = (quakeData.features ?? []).flatMap((f) => {
    const p = f.properties ?? {},
      center = point((f.geometry as { coordinates?: unknown } | undefined)?.coordinates);
    const magnitude = finite(p.magnitude),
      issued = date(p.time),
      id = words(p.publicID);
    if (
      !center ||
      !issued ||
      !id ||
      magnitude === null ||
      magnitude < 4.5 ||
      words(p.quality) === "deleted" ||
      Date.parse(issued) < Date.now() - 7 * 86400000
    )
      return [];
    return [
      record({
        id: `geonet-${id}`,
        title: `Terremoto M${magnitude.toFixed(1)} — ${words(p.locality) || "Nova Zelândia"}`,
        category: "earthquake",
        kind: "incident",
        location: words(p.locality) || "Nova Zelândia",
        country: "New Zealand",
        lng: center[0],
        lat: center[1],
        precision: "point",
        impact: magnitude >= 7 ? "critical" : magnitude >= 6 ? "high" : "moderate",
        startedAt: issued,
        summary: `Terremoto registrado pela GeoNet na Nova Zelândia. Magnitude ${magnitude.toFixed(1)}.`,
        sourceName: "GeoNet",
        sourceUrl: `https://www.geonet.org.nz/earthquake/${encodeURIComponent(id)}`,
        sourceId: id,
        metrics: {
          Magnitude: magnitude,
          ...(finite(p.depth) !== null
            ? { "Profundidade (km)": Math.round(finite(p.depth)!) }
            : {}),
        },
      }),
    ];
  });
  const volcanoes = (volcanoData.features ?? []).flatMap((f) => {
    const p = f.properties ?? {},
      center = point((f.geometry as { coordinates?: unknown } | undefined)?.coordinates);
    const level = finite(p.level),
      id = words(p.volcanoID);
    if (!center || !id || level === null || level <= 0) return [];
    const timestamp = new Date().toISOString();
    return [
      record({
        id: `geonet-volcano-${id}`,
        title: `Nível vulcânico atual — ${words(p.volcanoTitle) || id}`,
        category: "volcano",
        kind: "observation",
        location: words(p.volcanoTitle) || id,
        country: "New Zealand",
        lng: center[0],
        lat: center[1],
        precision: "point",
        impact: level >= 4 ? "critical" : level >= 3 ? "high" : "moderate",
        startedAt: timestamp,
        summary: `${cleanText(p.activity, 350) || `Nível vulcânico ${level} informado pela GeoNet.`} A fonte não informa quando esse nível começou; o horário exibido representa a consulta.`,
        sourceName: "GeoNet",
        sourceUrl: `https://www.geonet.org.nz/volcano/${encodeURIComponent(id)}`,
        sourceId: id,
        metrics: {
          "Nível vulcânico": level,
          "Código de aviação": words(p.acc) || "Não informado",
          Horário: "Consulta; início do nível não informado",
        },
      }),
    ];
  });
  return [...quakes, ...volcanoes];
}

export async function copernicus(): Promise<EventRecord[]> {
  type Activation = {
    code?: string;
    name?: string;
    category?: string;
    eventTime?: string;
    activationTime?: string;
    lastUpdate?: string;
    centroid?: string;
    countries?: string[];
    closed?: boolean;
    sensitive?: boolean;
    gdacsId?: string | null;
  };
  const data = await fetchJson<{ results?: Activation[] }>(
    "https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=100",
    900,
  );
  return (data.results ?? [])
    .flatMap((a) => {
      const id = words(a.code),
        updated = date(a.lastUpdate) || date(a.activationTime),
        started = date(a.eventTime) || updated;
      const match = words(a.centroid).match(/^POINT\s*\((-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)$/i);
      const center = match ? point([match[1], match[2]]) : null;
      if (
        !id ||
        !center ||
        !started ||
        !updated ||
        a.sensitive ||
        (a.closed && Date.parse(updated) < Date.now() - 21 * 86400000)
      )
        return [];
      const category = categoryFromText(words(a.category) || words(a.name));
      return [
        record({
          id: `copernicus-${id}`,
          title: words(a.name) || `Mapeamento ${id}`,
          category,
          kind: "incident",
          location: (a.countries ?? []).join(", ") || words(a.name),
          country: a.countries?.[0] || "",
          lng: center[0],
          lat: center[1],
          precision: "area",
          impact: "moderate",
          status: a.closed ? "closed" : "active",
          startedAt: started,
          updatedAt: updated,
          summary: `Ativação de mapeamento de emergência do Copernicus. O marcador representa o centro das áreas analisadas, não o limite do perigo.`,
          sourceName: "Copernicus EMS",
          sourceUrl: `https://mapping.emergency.copernicus.eu/activations/${encodeURIComponent(id)}`,
          sourceId: id,
          metrics: {
            "Tipo de ativação": words(a.category) || "Não informado",
            ...(a.gdacsId ? { "ID GDACS": a.gdacsId } : {}),
          },
        }),
      ];
    })
    .slice(0, 60);
}
