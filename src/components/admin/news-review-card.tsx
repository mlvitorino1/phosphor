"use client";
import { publicationLabel, shortDate, tone } from "./news-presentation";
import { Clock3, Newspaper } from "lucide-react";
import type { NewsCandidate } from "@/lib/domain/models";
import { CATEGORY_LABEL, IMPACT_LABEL } from "@/lib/domain/types";
import { suggestNews } from "@/lib/domain/news-suggestions";
import { newsThemes } from "@/lib/domain/news-intelligence";
import { newsVisibilityDeadline, reviewDeadline } from "@/lib/domain/news-deadlines";
export function NewsReviewCard({
  item,
  selected,
  checked,
  clock,
  onChoose,
  onToggle,
}: {
  item: NewsCandidate;
  selected: boolean;
  checked: boolean;
  clock: number;
  onChoose: (item: NewsCandidate) => void;
  onToggle: (id: string) => void;
}) {
  const due =
    item.status === "pending"
      ? reviewDeadline(item)
      : item.status === "approved"
        ? newsVisibilityDeadline(item)
        : null;
  const themes = newsThemes(item);
  const suggestion = suggestNews(item, []);
  return (
    <div
      className={`news-v2-card news-v2-${tone(item)} ${selected ? "is-selected" : ""}`}
      key={item.id}
    >
      <label className="news-v2-checkbox">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(item.id)}
          aria-label={`Selecionar ${item.title}`}
        />
      </label>
      <button type="button" className="news-v2-card-main" onClick={() => onChoose(item)}>
        <span className="news-v2-card-top">
          <span className="news-v2-topic">
            <Newspaper size={13} />{" "}
            {suggestion.category === "other" && themes.length
              ? themes[0]
              : CATEGORY_LABEL[item.category ?? suggestion.category]}
          </span>
          <span className={`news-v2-state news-v2-state-${item.status}`}>
            {item.status === "approved" && Date.parse(newsVisibilityDeadline(item)) <= clock
              ? "Prazo encerrado"
              : publicationLabel(item)}
          </span>
        </span>
        <strong className="news-v2-card-title">{item.title}</strong>
        <span className="news-v2-card-meta">
          <b>{item.domain}</b>
          <span>{shortDate(item.publishedAt)}</span>
        </span>
        <span className="news-v2-card-foot">
          <span>{item.location || suggestion.location || "Local a confirmar"}</span>
          <span>{themes[0] || `Impacto ${IMPACT_LABEL[suggestion.impact].toLowerCase()}`}</span>
          {due && (
            <span className={Date.parse(due) <= clock ? "late" : ""}>
              <Clock3 size={12} /> {shortDate(due)}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}
