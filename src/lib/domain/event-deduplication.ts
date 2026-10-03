import type { EventRecord } from "./types";

function distanceKm(a: EventRecord, b: EventRecord): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const v =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v)));
}
export function sameEvent(a: EventRecord, b: EventRecord): boolean {
  if (a.category !== b.category) return false;
  if (a.category === "storm") {
    const left = cycloneName(a.title),
      right = cycloneName(b.title);
    if (left && left === right && a.geoPrecision !== "country" && b.geoPrecision !== "country") {
      return (
        Math.abs(Date.parse(a.startedAt) - Date.parse(b.startedAt)) <= 21 * 86400000 &&
        distanceKm(a, b) <= 500
      );
    }
  }
  if ((a.kind ?? "incident") !== (b.kind ?? "incident")) return false;
  if (a.geoPrecision === "country" || b.geoPrecision === "country") return false;
  const hours = Math.abs(Date.parse(a.startedAt) - Date.parse(b.startedAt)) / 3600000;
  if (a.sources[0]?.name === b.sources[0]?.name) {
    const normalized = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    return (
      normalized(a.title) === normalized(b.title) &&
      normalized(a.location) === normalized(b.location) &&
      hours <= 0.1 &&
      distanceKm(a, b) <= 15 &&
      JSON.stringify(a.geometry ?? null) === JSON.stringify(b.geometry ?? null)
    );
  }
  if (a.category === "earthquake") {
    const am = Number(a.metrics.Magnitude),
      bm = Number(b.metrics.Magnitude);
    return (
      hours <= 0.5 &&
      distanceKm(a, b) <= 35 &&
      (!Number.isFinite(am) || !Number.isFinite(bm) || Math.abs(am - bm) <= 0.4)
    );
  }
  const name = (s: string) =>
    s
      .toLowerCase()
      .replace(
        /\b(tropical|storm|cyclone|hurricane|typhoon|incêndio|wildfire|flood|in|em|no|na)\b/g,
        "",
      )
      .replace(/-\d{2}\b/g, "")
      .replace(/[^a-z0-9]/g, "");
  const x = name(a.title),
    y = name(b.title);
  return x.length >= 4 && y.length >= 4 && x === y && hours <= 168 && distanceKm(a, b) <= 500;
}
function cycloneName(title: string): string | null {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  const match = normalized.match(
    /^(?:(?:super|severe)\s+)?(?:tropical\s+(?:cyclone|storm)|ciclone\s+tropical|tempestade\s+tropical|hurricane|furacao|cyclone|ciclone|typhoon|tufao)\s+(.+)$/,
  );
  if (!match) return null;
  const name = match[1].replace(/-\d{2,4}\b/g, "").replace(/[^a-z]/g, "");
  return name.length >= 4 ? name : null;
}
export function mergeEvents(events: EventRecord[]): EventRecord[] {
  const merged: EventRecord[] = [];
  for (const event of events) {
    const existing = merged.find((e) => e.id === event.id || sameEvent(e, event));
    if (!existing) {
      merged.push({
        ...event,
        sources: [...event.sources],
        updates: [...event.updates],
        metrics: { ...event.metrics },
      });
      continue;
    }
    existing.sources.push(
      ...event.sources.filter((s) => !existing.sources.some((current) => current.url === s.url)),
    );
    existing.updates.push(
      ...event.updates.filter(
        (update) =>
          !existing.updates.some(
            (current) => current.at === update.at && current.text === update.text,
          ),
      ),
    );
    if (Date.parse(event.updatedAt) > Date.parse(existing.updatedAt))
      existing.updatedAt = event.updatedAt;
    if (
      existing.kind === "report" &&
      event.kind === "report" &&
      event.expiresAt &&
      (!existing.expiresAt || event.expiresAt > existing.expiresAt)
    )
      existing.expiresAt = event.expiresAt;
    if (
      ["low", "moderate", "high", "critical"].indexOf(event.impact) >
      ["low", "moderate", "high", "critical"].indexOf(existing.impact)
    )
      existing.impact = event.impact;
  }
  return merged;
}
