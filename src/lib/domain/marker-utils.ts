import type { EventRecord } from "@/lib/domain/types";

export type SpecialMarker =
  "tornado" | "hurricane" | "earthquake" | "volcano" | "flood" | "wildfire" | "storm" | "news";
export function specialMarker(event: EventRecord): SpecialMarker | null {
  if (event.kind === "report") return "news";
  const clue = `${event.title} ${event.metrics["Tipo original"] ?? ""} ${event.metrics.Tipo ?? ""}`;
  if (event.category === "storm" && /tornado|twister/i.test(clue)) return "tornado";
  if (
    event.category === "storm" &&
    /hurric|furac|cyclon|ciclone|typhoon|tuf[aã]o|tropical storm/i.test(clue)
  )
    return "hurricane";
  if (event.category === "storm") return "storm";
  if (event.category === "earthquake") return "earthquake";
  if (event.category === "volcano") return "volcano";
  if (event.category === "flood") return "flood";
  if (event.category === "wildfire") return "wildfire";
  return null;
}
export function priorityMarker(event: EventRecord) {
  const marker = specialMarker(event);
  return marker === "tornado" || marker === "hurricane" || marker === "news";
}
export function markerLevel(event: EventRecord): string {
  const marker = specialMarker(event);
  if (marker === "tornado") {
    const level = event.verifiedLevel ?? event.metrics["Nível verificado"];
    return typeof level === "number" && Number.isInteger(level) && level >= 0 && level <= 5
      ? String(level)
      : "";
  }
  if (marker === "earthquake") {
    const magnitude = Number(event.metrics.Magnitude);
    return Number.isFinite(magnitude) && magnitude >= 0 && magnitude <= 10
      ? magnitude.toFixed(1)
      : "";
  }
  if (marker === "volcano") {
    const level = Number(event.metrics["Nível vulcânico"]);
    return Number.isInteger(level) && level > 0 && level <= 5 ? String(level) : "";
  }
  return "";
}
