import { describe, expect, it } from "vitest";
import { mergeEvents, sameEvent } from "@/lib/domain/event-deduplication";
import { isEventCurrent } from "@/lib/domain/event-visibility";
import { event } from "./fixtures";

describe("event identity and visibility", () => {
  it("merges nearby earthquake records from separate agencies", () => {
    const first = event();
    const second = event({
      id: "other",
      sources: [{ name: "GeoNet", url: "https://example.net/event/2", sourceId: "2" }],
      startedAt: "2026-10-01T10:10:00Z",
      lat: -15.81,
    });
    expect(sameEvent(first, second)).toBe(true);
    expect(mergeEvents([first, second])[0].sources).toHaveLength(2);
  });
  it("never equates country reference points with verified events", () => {
    expect(sameEvent(event(), event({ id: "other", geoPrecision: "country" }))).toBe(false);
  });
  it("does not merge separate magnitudes or distant earthquakes", () => {
    const sources = [{ name: "Other", url: "https://example.net/2", sourceId: "2" }];
    expect(sameEvent(event(), event({ id: "other", sources, metrics: { Magnitude: 7.5 } }))).toBe(
      false,
    );
    expect(sameEvent(event(), event({ id: "other", sources, lat: 30 }))).toBe(false);
  });
  it("does not mutate cached feed objects while merging", () => {
    const first = event();
    const snapshot = structuredClone(first);
    const merged = mergeEvents([
      first,
      event({
        id: "second",
        sources: [{ name: "Other", url: "https://example.net/2", sourceId: "2" }],
      }),
    ]);
    expect(merged[0].sources).toHaveLength(2);
    expect(first).toEqual(snapshot);
  });
  it("recognizes named hurricanes across languages", () => {
    expect(
      sameEvent(
        event({ title: "Hurricane HELENE", category: "storm" }),
        event({ title: "Furacão Helene", category: "storm", kind: "alert", id: "nhc" }),
      ),
    ).toBe(true);
  });
  it("hides closed and expired records at their exact deadline", () => {
    expect(
      isEventCurrent(
        event({ expiresAt: "2026-10-01T12:00:00Z" }),
        Date.parse("2026-10-01T12:00:00Z"),
      ),
    ).toBe(false);
    expect(isEventCurrent(event({ status: "closed" }))).toBe(false);
    expect(isEventCurrent(event({ expiresAt: "invalid" }))).toBe(false);
    expect(isEventCurrent(event())).toBe(true);
  });
});
