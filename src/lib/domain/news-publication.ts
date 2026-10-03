import type { NewsCandidate } from "./models";
import type { Region } from "./types";
import { suggestNews } from "./news-suggestions";
import { newsDeadlinePolicy } from "./news-deadlines";

export function safeArticleUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.hostname.startsWith("[") ||
      /^\d+(\.\d+){3}$/.test(url.hostname) ||
      /(^|\.)(localhost|local|internal)$/.test(url.hostname)
    )
      return null;
    return ["https:", "http:"].includes(url.protocol) &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function canonicalArticleUrl(value: string) {
  const safe = safeArticleUrl(value);
  if (!safe) return null;
  const url = new URL(safe);
  url.hash = "";
  for (const key of [...url.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.href;
}
export const normalizedTitle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export const headlineSignal =
  /\b(tornado|hurricane|huracan|furacao|cyclone|ciclon\w*|storm|tempestade|tormenta|flood\w*|inund\w*|enchente|cheia|wildfire|incendio|forest fire|earthquake|terremoto|sismo|quake|tsunami|eruption|erupcion|erupcao|volcano|volcan\w*|landslide|deslizamento|evacua\w*|explos\w*|outbreak|surto|epidemia|epidemic|cholera|colera|blackout|apagao|power outage|port closure|portos|puertos|logistica|logistics|supply chain|abastecimento|abastecimiento|bloqueio|bloqueo|blockade|greve|huelga|strike|rodovia|carretera|ferrovia|ferrocarril|refinaria|refineria|refinery|petroleo|oil spill|defesa civil|proteccion civil|protecao civil|protest\w*|conflit\w*|conflict\w*|attack|ataque|sancao|sancion|sanction\w*|drought|sequia|seca|estiagem|harvest|cosecha|safra|pollution|poluicao|contaminacion|desmatamento|deforestation|border closure|fronteira|frontera)\b/i;
export function automaticSuggestion(item: NewsCandidate, all: NewsCandidate[]) {
  if (!headlineSignal.test(normalizedTitle(item.title))) return null;
  const suggestion = suggestNews(item, all);
  const lat = Number(suggestion.lat),
    lng = Number(suggestion.lng);
  if (
    suggestion.locationAmbiguous ||
    !suggestion.country ||
    !suggestion.region ||
    !suggestion.location ||
    !suggestion.lat ||
    !suggestion.lng ||
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90 ||
    !Number.isFinite(lng) ||
    Math.abs(lng) > 180
  )
    return null;
  return { suggestion, lat, lng };
}
export function automaticNews(
  item: NewsCandidate,
  all: NewsCandidate[],
  now: string,
): NewsCandidate | null {
  if (
    item.status !== "pending" ||
    item.reviewedAt ||
    item.autoPublicationDisabled ||
    !Number.isFinite(Date.parse(item.publishedAt)) ||
    Date.parse(item.publishedAt) > Date.parse(now) + 3600000 ||
    Date.parse(item.publishedAt) < Date.parse(now) - 72 * 3600000
  )
    return null;
  const location = automaticSuggestion(item, all);
  if (!location) return null;
  const { suggestion, lat, lng } = location;
  const published: NewsCandidate = {
    ...item,
    status: "approved",
    publicationMode: "automatic",
    approvedAt: now,
    country: suggestion.country,
    geoPrecision: suggestion.geoPrecision ?? "country",
    region: suggestion.region as Region,
    category: suggestion.category,
    impact: suggestion.impact,
    location: suggestion.location,
    lat,
    lng,
    summary: suggestion.summary,
  };
  published.expiresAt = newsDeadlinePolicy(published, now).expiresAt;
  return published;
}
