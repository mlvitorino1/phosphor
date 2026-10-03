import { describe, expect, it } from "vitest";
import { automaticNews, canonicalArticleUrl, safeArticleUrl } from "@/lib/domain/news-publication";
import { isNewsVisible, newsDeadlinePolicy } from "@/lib/domain/news-deadlines";
import { news } from "./fixtures";

const now = "2026-10-01T12:00:00Z";
describe("news publication policy", () => {
  it("places a country-only headline at its capital with approximate precision", () => {
    const item = news();
    const published = automaticNews(item, [item], now);
    expect(published?.status).toBe("approved");
    expect(published?.country).toBe("Brazil");
    expect(published?.geoPrecision).toBe("country");
    expect(published?.lat).toBeCloseTo(-15.79, 1);
    expect(published?.publicationMode).toBe("automatic");
  });
  it("never infers event location from the publisher's country", () => {
    const item = news({ title: "Enchente interrompe rodovias", sourceCountry: "Brazil" });
    expect(automaticNews(item, [item], now)).toBeNull();
  });
  it("does not republish blocked, deleted, manually unapproved or old articles", () => {
    for (const patch of [
      { status: "blocked" as const },
      { status: "deleted" as const },
      { autoPublicationDisabled: true },
      { reviewedAt: now },
      { publishedAt: "2020-01-01" },
      { publishedAt: "invalid" },
      { publishedAt: "2099-01-01" },
    ]) {
      const item = news(patch);
      expect(automaticNews(item, [item], now)).toBeNull();
    }
  });
  it("adds an aftermath extension for high-impact events", () => {
    const low = newsDeadlinePolicy({ category: "earthquake", impact: "low" }, now);
    const high = newsDeadlinePolicy({ category: "earthquake", impact: "high" }, now);
    const critical = newsDeadlinePolicy({ category: "earthquake", impact: "critical" }, now);
    expect(high.extensionHours).toBe(48);
    expect(critical.extensionHours).toBe(96);
    expect(low.durationHours).toBeLessThan(high.durationHours);
    expect(high.durationHours).toBeLessThan(critical.durationHours);
  });
  it("removes approved news exactly at expiration", () => {
    expect(isNewsVisible(news({ status: "approved", expiresAt: now }), Date.parse(now))).toBe(
      false,
    );
  });
  it("removes tracking parameters but preserves meaningful query parameters", () => {
    expect(
      canonicalArticleUrl("https://example.org/story?utm_source=x&b=2&a=1&fbclid=x#section"),
    ).toBe("https://example.org/story?a=1&b=2");
  });
  it("rejects unsafe links and embedded credentials", () => {
    for (const value of [
      "javascript:alert(1)",
      "http://127.0.0.1/story",
      "http://[::1]/story",
      "https://user:pass@example.org/story",
      "https://service.internal/story",
    ])
      expect(safeArticleUrl(value)).toBeNull();
  });
});
