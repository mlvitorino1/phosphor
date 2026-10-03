import type { EventRecord } from "@/lib/domain/types";
import type { NewsCandidate } from "@/lib/domain/models";

export function event(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "event-1",
    title: "Earthquake Brazil",
    category: "earthquake",
    location: "Brazil",
    country: "Brazil",
    region: "South America",
    lat: -15.8,
    lng: -47.9,
    geoType: "localized",
    radiusKm: null,
    kind: "incident",
    geoPrecision: "point",
    impact: "high",
    status: "active",
    startedAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T11:00:00Z",
    summary: "Synthetic earthquake fixture for isolated tests.",
    sources: [{ name: "USGS", url: "https://example.org/event/1", sourceId: "1" }],
    updates: [{ at: "2026-10-01T11:00:00Z", text: "Updated" }],
    metrics: { Magnitude: 6 },
    ...overrides,
  };
}

export function news(overrides: Partial<NewsCandidate> = {}): NewsCandidate {
  return {
    id: "news-1",
    url: "https://example.org/news/1",
    title: "Enchente interrompe rodovias no Brasil",
    domain: "example.org",
    language: "pt",
    sourceCountry: "United States",
    publishedAt: "2026-10-01T10:00:00Z",
    capturedAt: "2026-10-01T11:00:00Z",
    status: "pending",
    ...overrides,
  };
}
