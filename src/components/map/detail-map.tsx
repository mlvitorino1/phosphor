"use client";
import type { EventRecord } from "@/lib/domain/types";
import { MapCanvas } from "@/components/map/map-canvas";
export function DetailMap({ event }: { event: EventRecord }) {
  return <MapCanvas events={[event]} selectedId={event.id} compact />;
}
