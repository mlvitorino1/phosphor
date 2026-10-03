import type { NewsCandidate, NewsStatus } from "@/lib/domain/models";
import { suggestNews } from "@/lib/domain/news-suggestions";
const statusLabel: Record<NewsStatus, string> = {
  pending: "A revisar",
  approved: "No mapa",
  rejected: "Descartada",
  blocked: "Bloqueada",
  deleted: "Na lixeira",
};
export const publicationLabel = (item: NewsCandidate) =>
  item.status === "approved" && item.publicationMode === "automatic"
    ? "No mapa · automática"
    : statusLabel[item.status];
export const shortDate = (value: string) =>
  new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function tone(item: NewsCandidate) {
  const category = item.category ?? suggestNews(item, []).category;
  return category === "storm" || category === "flood" || category === "tsunami"
    ? "water"
    : category === "wildfire" || category === "volcano"
      ? "fire"
      : category === "health"
        ? "health"
        : category === "earthquake" || category === "landslide"
          ? "earth"
          : category === "civil"
            ? "civil"
            : "other";
}
