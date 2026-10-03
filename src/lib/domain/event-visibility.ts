import type { EventRecord } from "./types";

export function isEventCurrent(event: EventRecord, now = Date.now()) {
  if (event.status === "closed") return false;
  if (!event.expiresAt) return true;
  const expiresAt = Date.parse(event.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
