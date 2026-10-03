import country from "country-list-js";
import type { Category, EventRecord, Region } from "@/lib/domain/types";

export const REGION_LABEL: Record<Region, string> = {
  "North America": "América do Norte",
  "South America": "América do Sul",
  Europe: "Europa",
  Asia: "Ásia",
  Africa: "África",
  Oceania: "Oceania",
  Antarctica: "Antártida",
};
export const REGION_VALUES = Object.keys(REGION_LABEL) as Region[];

const aliases: Record<string, string> = {
  brasil: "Brazil",
  "estados unidos": "United States",
  eua: "United States",
  "reino unido": "United Kingdom",
  japao: "Japan",
  "nova zelandia": "New Zealand",
  mexico: "Mexico",
  alemanha: "Germany",
  franca: "France",
  espanha: "Spain",
  italia: "Italy",
  india: "India",
  china: "China",
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export function regionFromCountry(value: string): Region | null {
  if (!value.trim()) return null;
  const resolved = aliases[normalize(value)] ?? value.trim();
  const entry =
    country.findByName(resolved) ||
    country.findByIso2(resolved.toUpperCase()) ||
    country.findByIso3(resolved.toUpperCase());
  return entry?.continent && entry.continent in REGION_LABEL ? (entry.continent as Region) : null;
}
export function regionFromEvent(event: EventRecord): Region | null {
  if (event.region) return event.region;
  const direct = regionFromCountry(event.country);
  if (direct) return direct;
  return regionFromCountry(event.location.split(",").at(-1) ?? "");
}
export function suggestedCategory(title: string): Category {
  const value = normalize(title);
  if (/tsunami/.test(value)) return "tsunami";
  if (/terremoto|earthquake|quake|sismo|seismo/.test(value)) return "earthquake";
  if (/vulca|volcan|eruption|erupcao/.test(value)) return "volcano";
  if (/enchente|inund|alagamento|flood/.test(value)) return "flood";
  if (/incendio florestal|incendio forestal|queimada|wildfire|forest fire|bushfire/.test(value))
    return "wildfire";
  if (/deslizamento|landslide|mudslide|avalanche/.test(value)) return "landslide";
  if (/surto|brote|epidem|outbreak|pandem|cholera|colera/.test(value)) return "health";
  if (
    /tornado|furacao|huracan|hurricane|cyclon|ciclon|typhoon|tufao|tifon|tempestade|tormenta|storm/.test(
      value,
    )
  )
    return "storm";
  if (/evacu|explos|conflito|conflicto|clashes|protest|ataque|bloqueo|bloqueio/.test(value))
    return "civil";
  return "other";
}
