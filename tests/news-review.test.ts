import { expect, it } from "vitest";
import { nextNewsStatus, newsReady } from "@/lib/domain/news-review";
import { news } from "./fixtures";

const reviewed = news({
  category: "flood",
  impact: "high",
  location: "Brasília",
  region: "South America",
  lat: -15.8,
  lng: -47.9,
  summary: "A synthetic reviewed summary with context.",
  verificationUrl: "https://example.net/verification",
  reviewedAt: "2026-10-01T12:00:00Z",
});
it("requires a separate publisher for manual review readiness", () => {
  expect(newsReady(reviewed)).toBe(true);
  expect(newsReady({ ...reviewed, verificationUrl: "https://sub.example.org/same" })).toBe(false);
  expect(newsReady({ ...reviewed, lat: NaN })).toBe(false);
});
it("protects blocked and deleted records from bulk approval", () => {
  expect(nextNewsStatus(reviewed, "approve")).toBe("approved");
  expect(nextNewsStatus({ ...reviewed, status: "blocked" }, "approve")).toBeNull();
  expect(nextNewsStatus({ ...reviewed, status: "deleted" }, "approve")).toBeNull();
  expect(nextNewsStatus({ ...reviewed, reviewedAt: undefined }, "approve")).toBeNull();
});
it("restores only compatible states to the queue", () => {
  expect(nextNewsStatus({ ...reviewed, status: "deleted" }, "restore")).toBe("pending");
  expect(nextNewsStatus(reviewed, "restore")).toBeNull();
  expect(nextNewsStatus({ ...reviewed, status: "blocked" }, "unblock")).toBe("pending");
  expect(nextNewsStatus({ ...reviewed, status: "approved" }, "unapprove")).toBe("pending");
});
