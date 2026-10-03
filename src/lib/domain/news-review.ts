import type { NewsCandidate, NewsStatus } from "./models";
import { distinctPublishers } from "./publisher";
import { safeArticleUrl } from "./news-publication";

export type BatchNewsAction =
  "approve" | "reject" | "unapprove" | "block" | "unblock" | "delete" | "restore";

export function newsLocated(item: NewsCandidate) {
  return Boolean(
    item.category &&
    item.impact &&
    item.region &&
    (item.location?.trim().length ?? 0) >= 2 &&
    typeof item.lat === "number" &&
    Number.isFinite(item.lat) &&
    Math.abs(item.lat) <= 90 &&
    typeof item.lng === "number" &&
    Number.isFinite(item.lng) &&
    Math.abs(item.lng) <= 180 &&
    (item.summary?.trim().length ?? 0) >= 20,
  );
}

export function newsReady(item: NewsCandidate) {
  return (
    newsLocated(item) &&
    Boolean(
      item.verificationUrl &&
      safeArticleUrl(item.verificationUrl)?.startsWith("https://") &&
      distinctPublishers(item.url, item.verificationUrl),
    )
  );
}

/** Explicit state transitions keep blocked/deleted records out of bulk approval. */
export function nextNewsStatus(item: NewsCandidate, action: BatchNewsAction): NewsStatus | null {
  switch (action) {
    case "approve":
      return item.status !== "blocked" &&
        item.status !== "deleted" &&
        newsReady(item) &&
        item.reviewedAt
        ? "approved"
        : null;
    case "reject":
      return item.status === "pending" ? "rejected" : null;
    case "unapprove":
      return item.status === "approved" ? "pending" : null;
    case "block":
      return item.status !== "blocked" && item.status !== "deleted" ? "blocked" : null;
    case "unblock":
      return item.status === "blocked" ? "pending" : null;
    case "delete":
      return item.status !== "deleted" ? "deleted" : null;
    case "restore":
      return item.status === "deleted" ? "pending" : null;
  }
}
