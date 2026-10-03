"use client";
import { useMemo, useState } from "react";
import { MapPin, Search, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import type { EventRecord } from "@/lib/domain/types";
import type {
  HistoricalArchive,
  HistoricalIndex,
  HistoricalRecord,
} from "@/lib/domain/history-models";
import { MapCanvas } from "@/components/map/map-canvas";

function formatPeriod(period: string) {
  return period.length === 8
    ? `${period.slice(6, 8)}/${period.slice(4, 6)}/${period.slice(0, 4)}`
    : period.length === 6
      ? `${period.slice(4, 6)}/${period.slice(0, 4)}`
      : period;
}
function mapRecord(record: HistoricalRecord, archive: HistoricalArchive): EventRecord {
  const title = `${record.type}${record.actor1 ? `: ${record.actor1}` : ""}${record.actor2 ? ` / ${record.actor2}` : ""}`;
  return {
    id: record.id,
    title,
    category: "civil",
    location: record.location,
    country: record.countryCode,
    lat: record.lat,
    lng: record.lng,
    geoType: record.geoLevel === "1" ? "regional" : "localized",
    radiusKm: null,
    kind: "observation",
    geoPrecision: record.geoLevel === "1" ? "country" : record.geoLevel === "2" ? "area" : "point",
    impact: "low",
    status: "closed",
    startedAt: `${record.date}T12:00:00.000Z`,
    updatedAt: `${record.date}T12:00:00.000Z`,
    summary: `Registro histórico codificado pelo GDELT. Código CAMEO ${record.eventCode}; ${record.mentions} menções e ${record.sources} fontes no conjunto original. Não representa confirmação independente.`,
    sources: [
      {
        name: "GDELT Historical Event Database",
        url: record.sourceUrl ?? archive.archiveUrl,
        sourceId: record.id,
      },
    ],
    updates: [],
    metrics: { "Código CAMEO": record.eventCode, Menções: record.mentions, Fontes: record.sources },
  };
}

export function HistoryExplorer({
  archive,
  index,
  selectedKey,
}: {
  archive: HistoricalArchive;
  index: HistoricalIndex[];
  selectedKey: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const themes = useMemo(
    () =>
      [...new Map(archive.records.map((item) => [item.rootCode, item.type])).entries()].sort(
        (a, b) => a[0].localeCompare(b[0]),
      ),
    [archive.records],
  );
  const visible = useMemo(
    () =>
      archive.records.filter(
        (item) =>
          (theme === "all" || item.rootCode === theme) &&
          `${item.type} ${item.actor1} ${item.actor2} ${item.location} ${item.countryCode}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase().trim()),
      ),
    [archive.records, theme, query],
  );
  const events = useMemo(() => visible.map((item) => mapRecord(item, archive)), [visible, archive]);
  const selected = visible.find((item) => item.id === selectedId);
  return (
    <>
      <div className="history-notice">
        <strong>Amostra histórica · {formatPeriod(archive.period)}</strong>
        <span>
          {archive.selection} Localizações e classificações são extraídas automaticamente e podem
          ser imprecisas. Esses registros não entram no mapa de alertas.
        </span>
      </div>
      <div className="history-tools">
        <label>
          Período
          <select
            value={selectedKey}
            onChange={(event) =>
              router.push(`/historico?periodo=${encodeURIComponent(event.target.value)}`)
            }
          >
            {index.map((item) => (
              <option value={item.key} key={item.key}>
                {formatPeriod(item.period)}
                {item.country ? ` · ${item.country}` : " · mundo"} ({item.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          Tema
          <select
            value={theme}
            onChange={(event) => {
              setTheme(event.target.value);
              setSelectedId(null);
            }}
          >
            <option value="all">Todos os temas</option>
            {themes.map(([code, name]) => (
              <option value={code} key={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="history-search">
          Buscar local ou agente
          <div>
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedId(null);
              }}
              placeholder="Cidade, país, pessoa..."
            />
          </div>
        </label>
      </div>
      <div className="history-summary">
        <span>
          <strong>{visible.length}</strong> registros nesta amostra
        </span>
        <span>{archive.eligible.toLocaleString("pt-BR")} elegíveis no arquivo de origem</span>
        <a href={archive.archiveUrl} target="_blank" rel="noopener noreferrer">
          Arquivo GDELT <ExternalLink size={13} />
        </a>
      </div>
      <div className="history-layout">
        <div className="history-map">
          <MapCanvas events={events} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="history-list" aria-label="Registros históricos">
          {visible.length === 0 ? (
            <p className="history-empty">Nenhum registro para esse filtro.</p>
          ) : (
            visible.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`history-item${selectedId === item.id ? " active" : ""}`}
              >
                <span className="history-item-top">
                  <time dateTime={item.date}>
                    {new Date(`${item.date}T12:00:00Z`).toLocaleDateString("pt-BR", {
                      timeZone: "UTC",
                    })}
                  </time>
                  <span>{item.type}</span>
                </span>
                <strong>
                  {item.actor1 || item.actor2
                    ? [item.actor1, item.actor2].filter(Boolean).join(" / ")
                    : item.type}
                </strong>
                <span className="history-item-place">
                  <MapPin size={13} />
                  {item.location}
                </span>
                <small>
                  {item.mentions} menções · {item.sources} {item.sources === 1 ? "fonte" : "fontes"}{" "}
                  · CAMEO {item.eventCode}
                </small>
              </button>
            ))
          )}
        </div>
      </div>
      {selected && (
        <aside className="history-detail">
          <div>
            <span>REGISTRO HISTÓRICO · {selected.date}</span>
            <h2>{selected.type}</h2>
            <p>
              {[selected.actor1, selected.actor2].filter(Boolean).join(" / ") ||
                "Atores não identificados"}
            </p>
            <strong>{selected.location}</strong>
            <p>
              Código CAMEO {selected.eventCode} · {selected.mentions} menções · {selected.sources}{" "}
              {selected.sources === 1 ? "fonte" : "fontes"}
            </p>
            <small>
              {selected.geoLevel === "1" ? "Localização aproximada no centro do país. " : ""}
              {selected.sourceUrl
                ? "O registro inclui URL de origem."
                : "Este período não contém URL do artigo original na base GDELT."}
            </small>
          </div>
          <a
            href={selected.sourceUrl ?? archive.archiveUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {selected.sourceUrl ? "Ver fonte original" : "Ver arquivo GDELT"}{" "}
            <ExternalLink size={14} />
          </a>
        </aside>
      )}
    </>
  );
}
