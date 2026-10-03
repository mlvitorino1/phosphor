import type { NewsCandidate } from "@/lib/domain/models";
import type { Category, Impact } from "@/lib/domain/types";

const hour = 60 * 60 * 1000;
const baseHours: Record<Category, number> = {
  earthquake: 96,
  storm: 96,
  flood: 96,
  wildfire: 96,
  volcano: 96,
  landslide: 96,
  tsunami: 96,
  health: 120,
  civil: 72,
  other: 48,
};
const impactHours: Record<Impact, number> = { low: 0, moderate: 0, high: 24, critical: 48 };
const aftermathCategories = new Set<Category>([
  "earthquake",
  "storm",
  "flood",
  "wildfire",
  "volcano",
  "landslide",
  "tsunami",
  "health",
  "civil",
]);

function timestamp(value: string | undefined, fallback: number) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function reviewDeadline(item: Pick<NewsCandidate, "capturedAt" | "impact">) {
  const hours = item.impact === "critical" ? 2 : item.impact === "high" ? 8 : 24;
  return new Date(timestamp(item.capturedAt, Date.now()) + hours * hour).toISOString();
}

export function newsDeadlinePolicy(
  item: Pick<NewsCandidate, "category" | "impact">,
  approvedAt: string,
) {
  const category = item.category ?? "other";
  const impact = item.impact ?? "moderate";
  const extensionHours =
    aftermathCategories.has(category) && (impact === "high" || impact === "critical")
      ? impact === "critical"
        ? 96
        : 48
      : 0;
  const durationHours = baseHours[category] + impactHours[impact] + extensionHours;
  return {
    expiresAt: new Date(timestamp(approvedAt, Date.now()) + durationHours * hour).toISOString(),
    durationHours,
    extensionHours,
  };
}

export function newsVisibilityDeadline(item: NewsCandidate) {
  const stored = Date.parse(item.expiresAt ?? "");
  if (Number.isFinite(stored)) return new Date(stored).toISOString();
  // Older approvals did not save a deadline. Apply the same policy to them.
  return newsDeadlinePolicy(item, item.approvedAt ?? item.reviewedAt ?? item.publishedAt).expiresAt;
}

export function isNewsVisible(item: NewsCandidate, now = Date.now()) {
  return item.status === "approved" && Date.parse(newsVisibilityDeadline(item)) > now;
}
