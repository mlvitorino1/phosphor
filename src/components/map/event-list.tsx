"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { EventRecord } from "@/lib/domain/types";
import { CATEGORY_LABEL } from "@/lib/domain/types";
import { REGION_LABEL, REGION_VALUES, regionFromEvent } from "@/lib/domain/regions";
import { EventCard } from "@/components/map/event-card";

export function EventList({ events }: { events: EventRecord[] }) {
  const [query, setQuery] = useState("");
  const [impact, setImpact] = useState("all");
  const [region, setRegion] = useState("all");
  const [theme, setTheme] = useState("all");
  const filtered = useMemo(
    () =>
      events.filter((e) => {
        const q = query
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
        const haystack = `${e.title} ${e.location} ${e.country} ${CATEGORY_LABEL[e.category]}`
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return (
          (!q || haystack.includes(q)) &&
          (impact === "all" || e.impact === impact) &&
          (region === "all" ||
            (region === "unknown" ? !regionFromEvent(e) : regionFromEvent(e) === region)) &&
          (theme === "all" || e.category === theme)
        );
      }),
    [events, query, impact, region, theme],
  );
  return (
    <>
      <div className="list-tools">
        <div className="list-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar eventos ou lugares"
            aria-label="Pesquisar eventos"
          />
        </div>
        <select
          aria-label="Filtrar região"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          <option value="all">Todas as regiões</option>
          {REGION_VALUES.map((value) => (
            <option key={value} value={value}>
              {REGION_LABEL[value]}
            </option>
          ))}
          <option value="unknown">Região não definida</option>
        </select>
        <select aria-label="Filtrar tema" value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="all">Todos os temas</option>
          {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar impacto"
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
        >
          <option value="all">Todos os impactos</option>
          <option value="critical">Crítico</option>
          <option value="high">Alto</option>
          <option value="moderate">Moderado</option>
          <option value="low">Baixo</option>
        </select>
      </div>
      <p className="list-count">{filtered.length} eventos · ordenados pela última atualização</p>
      {filtered.length ? (
        <div className="event-list-grid">
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <div className="empty-state">Nenhum evento encontrado.</div>
      )}
    </>
  );
}
