"use client";
import { NewsReviewCard } from "./news-review-card";
import { publicationLabel, shortDate, tone } from "./news-presentation";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Globe2,
  MapPin,
  Newspaper,
  RefreshCw,
  ShieldBan,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import type { NewsCandidate, NewsStatus } from "@/lib/domain/models";
import type { Category, EventRecord, Impact, Region } from "@/lib/domain/types";
import { CATEGORY_LABEL, IMPACT_LABEL } from "@/lib/domain/types";
import { REGION_LABEL, REGION_VALUES } from "@/lib/domain/regions";
import { MapCanvas } from "@/components/map/map-canvas";
import { newsVisibilityDeadline, reviewDeadline } from "@/lib/domain/news-deadlines";
import { utcDate } from "@/components/map/event-card";
import { newsThemes } from "@/lib/domain/news-intelligence";
import { suggestNews } from "@/lib/domain/news-suggestions";

type Initial = { items: NewsCandidate[]; lastAttempt: string | null; error: string | null };
type Draft = ReturnType<typeof suggestNews>;
type BatchAction = import("@/lib/domain/news-review").BatchNewsAction;
function priority(item: NewsCandidate) {
  const suggestion = suggestNews(item, []);
  const impact = { low: 0, moderate: 12, high: 35, critical: 55 }[suggestion.impact];
  return (
    impact +
    (suggestion.category !== "other" ? 18 : 0) +
    (newsThemes(item).includes("Cadeia de suprimentos") ? 20 : 0) +
    (suggestion.location ? 8 : 0) +
    (item.discoveryMethod === "rss" || item.discoveryMethod === "section" ? 5 : 0)
  );
}
const validCoords = (draft: Draft) =>
  draft.lat.trim() !== "" &&
  draft.lng.trim() !== "" &&
  Number.isFinite(Number(draft.lat)) &&
  Number.isFinite(Number(draft.lng)) &&
  Math.abs(Number(draft.lat)) <= 90 &&
  Math.abs(Number(draft.lng)) <= 180;
function required(draft: Draft, allowWithoutConfirmation = false) {
  const missing: string[] = [];
  if (!draft.region) missing.push("região");
  if (draft.location.trim().length < 2) missing.push("local");
  if (!validCoords(draft)) missing.push("ponto no mapa");
  if (draft.summary.trim().length < 20) missing.push("contexto");
  if (!allowWithoutConfirmation && !draft.verificationUrl.startsWith("https://"))
    missing.push("segunda fonte");
  return missing;
}
export function NewsPanel({ initial }: { initial: Initial }) {
  const [items, setItems] = useState(initial.items);
  const [lastAttempt, setLastAttempt] = useState(initial.lastAttempt);
  const [captureError, setCaptureError] = useState(initial.error);
  const [selectedId, setSelectedId] = useState(
    initial.items
      .filter((item) => item.status === "pending")
      .sort((a, b) => priority(b) - priority(a) || b.publishedAt.localeCompare(a.publishedAt))[0]
      ?.id ??
      initial.items[0]?.id ??
      "",
  );
  const [checked, setChecked] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft>(() =>
    suggestNews(
      initial.items.find((item) => item.id === selectedId) ??
        initial.items[0] ?? {
          title: "",
          domain: "",
          url: "",
          id: "",
          publishedAt: "",
          capturedAt: "",
          status: "pending",
          language: "",
          sourceCountry: "",
        },
      initial.items,
    ),
  );
  const [excerpt, setExcerpt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [shown, setShown] = useState({ pending: 32, approved: 8, archive: 8 });
  const [mapOpen, setMapOpen] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const selected = items.find((item) => item.id === selectedId);
  const expired = (item: NewsCandidate) =>
    item.status === "approved" && Date.parse(newsVisibilityDeadline(item)) <= clock;
  const pending = useMemo(
    () =>
      items
        .filter((item) => item.status === "pending")
        .sort((a, b) => priority(b) - priority(a) || b.publishedAt.localeCompare(a.publishedAt)),
    [items],
  );
  const approved = useMemo(
    () =>
      items
        .filter((item) => item.status === "approved")
        .sort((a, b) =>
          (b.approvedAt ?? b.publishedAt).localeCompare(a.approvedAt ?? a.publishedAt),
        ),
    [items],
  );
  const archive = useMemo(
    () =>
      items
        .filter((item) => item.status !== "pending" && item.status !== "approved")
        .sort((a, b) =>
          (b.reviewedAt ?? b.publishedAt).localeCompare(a.reviewedAt ?? a.publishedAt),
        ),
    [items],
  );
  const allPendingChecked =
    pending.length > 0 && pending.every((item) => checked.includes(item.id));
  const preview = useMemo<EventRecord[]>(
    () =>
      selected && validCoords(draft)
        ? [
            {
              id: "news-preview",
              title: selected.title,
              category: draft.category,
              kind: "report",
              location: draft.location || "Local em revisão",
              country: draft.country,
              region: draft.region ? (draft.region as Region) : undefined,
              lat: Number(draft.lat),
              lng: Number(draft.lng),
              geoType: draft.geoPrecision === "country" ? "regional" : "localized",
              geoPrecision: draft.geoPrecision ?? "point",
              radiusKm: null,
              impact: draft.impact,
              status: "monitoring",
              startedAt: selected.publishedAt,
              updatedAt: selected.publishedAt,
              summary: "",
              sources: [],
              updates: [],
              metrics: {},
            },
          ]
        : [],
    [selected, draft],
  );

  function choose(item: NewsCandidate, all = items) {
    const suggestion = suggestNews(item, all);
    setSelectedId(item.id);
    setDraft(suggestion);
    setExcerpt("");
    setMessage("");
    setMapOpen(!suggestion.lat || !suggestion.lng);
  }
  function toggle(id: string) {
    setChecked((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }
  function toggleAllPending() {
    const ids = new Set(pending.map((item) => item.id));
    setChecked((current) =>
      allPendingChecked ? current.filter((id) => !ids.has(id)) : [...new Set([...current, ...ids])],
    );
  }
  function nextPending(excludeId: string, updated: NewsCandidate[]) {
    const next = updated
      .filter((item) => item.status === "pending" && item.id !== excludeId)
      .sort((a, b) => priority(b) - priority(a) || b.publishedAt.localeCompare(a.publishedAt))[0];
    if (next) choose(next, updated);
  }
  async function sync() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/news/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha na captura");
      const before = new Set(items.map((item) => item.id));
      const added = (data.items as NewsCandidate[]).filter((item) => !before.has(item.id)).length;
      setItems(data.items);
      setLastAttempt(data.lastAttempt);
      setCaptureError(data.error);
      const automatic = (data.items as NewsCandidate[]).filter(
        (item) => !before.has(item.id) && item.publicationMode === "automatic",
      ).length;
      setMessage(
        data.skipped
          ? "Consulta recente. A próxima captura manual estará disponível em até um minuto."
          : data.error
            ? `Captura parcial: ${data.error}`
            : added
              ? `${added} notícias capturadas; ${automatic} já posicionadas no mapa.`
              : "Captura concluída. Nenhuma manchete nova desde a última consulta.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na captura");
    } finally {
      setBusy(false);
    }
  }
  async function analyze() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/news/${selected.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excerpt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha na análise");
      const item = data.item as NewsCandidate;
      setItems((current) => current.map((value) => (value.id === item.id ? item : value)));
      const result = item.aiAnalysis!;
      setDraft((current) => ({
        ...current,
        category: result.category,
        impact: result.impact,
        location: result.location || current.location,
        summary: result.summary,
      }));
      setMessage("Sugestões da IA carregadas. Confira a fonte e o ponto no mapa.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na análise");
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(status: NewsStatus, includeDraft = false) {
    if (!selected) return;
    const missing = required(draft, selected.publicationMode === "automatic");
    if (status === "approved" && missing.length) {
      setMessage(`Para publicar, confirme: ${missing.join(", ")}.`);
      return;
    }
    if (
      status === "deleted" &&
      !window.confirm("Mover esta notícia para a lixeira? Ela poderá ser restaurada.")
    )
      return;
    const body = includeDraft
      ? {
          status,
          category: draft.category,
          impact: draft.impact,
          ...(draft.region ? { region: draft.region } : {}),
          ...(draft.location.trim().length >= 2 ? { location: draft.location.trim() } : {}),
          ...(validCoords(draft) ? { lat: Number(draft.lat), lng: Number(draft.lng) } : {}),
          ...(draft.geoPrecision ? { geoPrecision: draft.geoPrecision } : {}),
          ...(draft.summary.trim().length >= 20 ? { summary: draft.summary.trim() } : {}),
          ...(draft.verificationUrl.startsWith("https://")
            ? { verificationUrl: draft.verificationUrl.trim() }
            : {}),
          verifiedLevel: draft.verifiedLevel === "" ? null : Number(draft.verifiedLevel),
        }
      : { status };
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/news/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error(data.error || "Não foi possível alterar a notícia");
      const updated = items.map((item) =>
        item.id === selected.id ? (data.item as NewsCandidate) : item,
      );
      setItems(updated);
      if (status !== "pending" && selected.status === "pending") nextPending(selected.id, updated);
      setMessage(
        status === "approved"
          ? "Aprovada e enviada ao mapa."
          : status === "pending" && includeDraft
            ? "Revisão salva. Você pode continuar depois."
            : "Situação atualizada.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na alteração");
    } finally {
      setBusy(false);
    }
  }
  async function bulk(action: BatchAction) {
    if (!checked.length) return;
    if (action === "delete" && !window.confirm(`Mover ${checked.length} notícias para a lixeira?`))
      return;
    if (
      action === "approve" &&
      !window.confirm("Aprovar as notícias selecionadas que já têm revisão completa?")
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/news/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: checked, action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha na ação em lote");
      const changed = new Map<string, NewsCandidate>(
        (data.changed as NewsCandidate[]).map((item) => [item.id, item]),
      );
      const updated = items.map((item) => changed.get(item.id) ?? item);
      setItems(updated);
      setChecked((current) => current.filter((id) => !changed.has(id)));
      if (selected && changed.has(selected.id) && selected.status === "pending")
        nextPending(selected.id, updated);
      setMessage(
        `${changed.size} notícia(s) atualizada(s).${data.skipped ? ` ${data.skipped} sem revisão completa ou com situação incompatível.` : ""}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha na ação em lote");
    } finally {
      setBusy(false);
    }
  }

  function group(
    title: string,
    caption: string,
    rows: NewsCandidate[],
    key: "pending" | "approved" | "archive",
  ) {
    return (
      <section className="news-v2-group" key={key}>
        <div className="news-v2-group-heading">
          <div>
            <h2>
              {title} <span>{rows.length}</span>
            </h2>
            <p>{caption}</p>
          </div>
        </div>
        <div className="news-v2-group-cards">
          {rows.slice(0, shown[key]).map((item) => (
            <NewsReviewCard
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              checked={checked.includes(item.id)}
              clock={clock}
              onChoose={choose}
              onToggle={toggle}
            />
          ))}
          {!rows.length && <div className="news-v2-empty">Nenhuma notícia aqui.</div>}
        </div>
        {rows.length > shown[key] && (
          <button
            type="button"
            className="news-v2-more"
            onClick={() => setShown((current) => ({ ...current, [key]: current[key] + 32 }))}
          >
            Mostrar mais {Math.min(32, rows.length - shown[key])} <ChevronDown size={15} />
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="news-v2">
      <div className="news-v2-overview">
        <div className="news-v2-overview-copy">
          <span className="news-v2-overline">CENTRAL DE NOTÍCIAS</span>
          <h2>Notícias no mapa.</h2>
          <p>
            Manchetes recentes com local identificável entram automaticamente; a capital cadastrada
            serve como referência quando não há cidade precisa.{" "}
            {pending.length
              ? `${pending.length} aguardam localização ou decisão manual.`
              : "Nenhuma pendência agora."}
          </p>
        </div>
        <div className="news-v2-metrics">
          <div>
            <strong>{pending.length}</strong>
            <span>A revisar</span>
          </div>
          <div>
            <strong>{approved.filter((item) => !expired(item)).length}</strong>
            <span>No mapa</span>
          </div>
          <div>
            <strong>{items.length}</strong>
            <span>Capturadas</span>
          </div>
        </div>
      </div>
      <div className="news-v2-tools">
        <span>
          <Globe2 size={15} /> Última captura:{" "}
          {lastAttempt ? new Date(lastAttempt).toLocaleString("pt-BR") : "ainda não realizada"}
        </span>
        <button className="button button-secondary" onClick={sync} disabled={busy}>
          <RefreshCw size={15} className={busy ? "news-v2-spinning" : ""} />{" "}
          {busy ? "Capturando…" : "Capturar agora"}
        </button>
      </div>
      {captureError && (
        <p className="news-v2-warning" role="alert">
          Algumas fontes falharam nesta captura: {captureError}
        </p>
      )}
      {message && (
        <p className="news-v2-message" role="status">
          {message}
        </p>
      )}
      <div className="news-v2-selection">
        <label>
          <input
            type="checkbox"
            checked={allPendingChecked}
            onChange={toggleAllPending}
            disabled={!pending.length}
          />{" "}
          Selecionar todas as pendentes
        </label>
        <span>{checked.length} selecionadas</span>
      </div>
      {checked.length > 0 && (
        <div className="news-v2-bulk">
          <strong>{checked.length} selecionadas</strong>
          <button onClick={() => bulk("approve")} disabled={busy}>
            Aprovar revisadas
          </button>
          <button onClick={() => bulk("reject")} disabled={busy}>
            Descartar
          </button>
          <button onClick={() => bulk("block")} disabled={busy}>
            Bloquear
          </button>
          <button onClick={() => bulk("unapprove")} disabled={busy}>
            Remover aprovação
          </button>
          <button onClick={() => bulk("unblock")} disabled={busy}>
            Desbloquear
          </button>
          <button onClick={() => bulk("restore")} disabled={busy}>
            Restaurar
          </button>
          <button onClick={() => bulk("delete")} disabled={busy}>
            Excluir
          </button>
          <button onClick={() => setChecked([])} disabled={busy}>
            Limpar
          </button>
        </div>
      )}
      <div className="news-v2-layout">
        <div className="news-v2-feed">
          {group("Para revisar", "Mais urgentes primeiro", pending, "pending")}
          {group("No mapa", "Publicações automáticas e revisadas", approved, "approved")}
          {group("Arquivo", "Descartadas, bloqueadas e excluídas", archive, "archive")}
        </div>
        {selected && (
          <section className={`news-v2-review news-v2-${tone(selected)}`} key={selected.id}>
            <div className="news-v2-review-head">
              <span className="news-v2-review-kicker">
                <Newspaper size={15} /> DETALHES DA NOTÍCIA
              </span>
              <span className={`news-v2-state news-v2-state-${selected.status}`}>
                {expired(selected) ? "Prazo encerrado" : publicationLabel(selected)}
              </span>
            </div>
            <h2>{selected.title}</h2>
            <div className="news-v2-source">
              <strong>{selected.discoverySource || selected.domain}</strong>
              <span>{selected.domain}</span>
              <span>{shortDate(selected.publishedAt)}</span>
              <span>{selected.language || "Idioma não informado"}</span>
              <a href={selected.url} target="_blank" rel="noopener noreferrer">
                Abrir original <ArrowUpRight size={14} />
              </a>
            </div>
            {(selected.status === "pending" || selected.status === "approved") && (
              <div className="news-v2-deadline">
                <Clock3 size={15} />
                <span>{selected.status === "pending" ? "Revisar até" : "No mapa até"}</span>
                <strong>
                  {utcDate(
                    selected.status === "pending"
                      ? reviewDeadline({ ...selected, impact: draft.impact })
                      : newsVisibilityDeadline(selected),
                  )}
                </strong>
              </div>
            )}
            <div className="news-v2-auto">
              <span className="news-v2-auto-icon">✦</span>
              <span>
                {selected.publicationMode === "automatic"
                  ? "Publicada automaticamente. O ponto na capital é uma referência do país; você pode corrigir, remover ou bloquear."
                  : "Dados sugeridos automaticamente. A revisão manual continua disponível."}
              </span>
            </div>
            <div className="news-v2-form">
              <div className="news-v2-field-row">
                <label>
                  Tema
                  <select
                    value={draft.category}
                    onChange={(event) =>
                      setDraft({ ...draft, category: event.target.value as Category })
                    }
                  >
                    {(Object.keys(CATEGORY_LABEL) as Category[]).map((category) => (
                      <option key={category} value={category}>
                        {CATEGORY_LABEL[category]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Impacto
                  <select
                    value={draft.impact}
                    onChange={(event) =>
                      setDraft({ ...draft, impact: event.target.value as Impact })
                    }
                  >
                    {(Object.keys(IMPACT_LABEL) as Impact[]).map((impact) => (
                      <option key={impact} value={impact}>
                        {IMPACT_LABEL[impact]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="news-v2-field-row">
                <label>
                  Local do evento <small>{draft.locationSuggested ? "sugerido" : ""}</small>
                  <input
                    value={draft.location}
                    onChange={(event) =>
                      setDraft({ ...draft, location: event.target.value, locationSuggested: false })
                    }
                    placeholder="Cidade ou região confirmada"
                  />
                </label>
                <label>
                  Região
                  <select
                    value={draft.region}
                    onChange={(event) =>
                      setDraft({ ...draft, region: event.target.value as Region })
                    }
                  >
                    <option value="">Escolha a região</option>
                    {REGION_VALUES.map((region) => (
                      <option key={region} value={region}>
                        {REGION_LABEL[region]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="news-v2-coordinates">
                <span>
                  <MapPin size={14} /> Ponto no mapa{" "}
                  {draft.coordinatesSuggested && <em>sugerido</em>}
                </span>
                <button type="button" onClick={() => setMapOpen((current) => !current)}>
                  {mapOpen ? "Ocultar mapa" : "Marcar no mapa"}
                </button>
              </div>
              {mapOpen && (
                <div className="news-v2-map">
                  <MapCanvas
                    events={preview}
                    selectedId={preview.length ? "news-preview" : null}
                    onPickLocation={(lng, lat) =>
                      setDraft((current) => ({
                        ...current,
                        lng: lng.toFixed(4),
                        lat: lat.toFixed(4),
                        geoPrecision: "point",
                        coordinatesSuggested: false,
                      }))
                    }
                  />
                </div>
              )}
              <div className="news-v2-field-row news-v2-coord-row">
                <label>
                  Latitude
                  <input
                    inputMode="decimal"
                    value={draft.lat}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        lat: event.target.value,
                        geoPrecision: "point",
                        coordinatesSuggested: false,
                      })
                    }
                  />
                </label>
                <label>
                  Longitude
                  <input
                    inputMode="decimal"
                    value={draft.lng}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        lng: event.target.value,
                        geoPrecision: "point",
                        coordinatesSuggested: false,
                      })
                    }
                  />
                </label>
              </div>
              <label>
                Contexto
                <textarea
                  value={draft.summary}
                  onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  placeholder="O que aconteceu?"
                />
              </label>
              <label>
                Segunda fonte{" "}
                <small>
                  {selected.publicationMode === "automatic"
                    ? "opcional para corrigir; exigida para marcar como revisada"
                    : draft.corroborationSuggested
                      ? "encontrada por manchete semelhante; confira"
                      : "independente"}
                </small>
                <input
                  type="url"
                  value={draft.verificationUrl}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      verificationUrl: event.target.value,
                      corroborationSuggested: false,
                    })
                  }
                  placeholder="https://..."
                />
              </label>
              {draft.verificationUrl && (
                <a
                  className="news-v2-check-link"
                  href={draft.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Conferir segunda fonte <ExternalLink size={13} />
                </a>
              )}
              {draft.category === "storm" && /tornado/i.test(selected.title) && (
                <label>
                  Nível EF confirmado
                  <select
                    value={draft.verifiedLevel}
                    onChange={(event) => setDraft({ ...draft, verifiedLevel: event.target.value })}
                  >
                    <option value="">Sem nível verificado</option>
                    {[0, 1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {required(draft, selected.publicationMode === "automatic").length > 0 && (
              <div className="news-v2-missing">
                Falta confirmar:{" "}
                <strong>
                  {required(draft, selected.publicationMode === "automatic").join(" · ")}
                </strong>
              </div>
            )}
            <div className="news-v2-primary-actions">
              {selected.status === "pending" && (
                <button
                  onClick={() => changeStatus("pending", true)}
                  disabled={busy}
                  className="button button-secondary"
                >
                  Salvar rascunho
                </button>
              )}
              {selected.status !== "blocked" && selected.status !== "deleted" && (
                <button
                  onClick={() => changeStatus("approved", true)}
                  disabled={busy}
                  className="button button-primary"
                >
                  <Check size={16} />{" "}
                  {selected.status === "approved" ? "Atualizar no mapa" : "Aprovar no mapa"}
                </button>
              )}
            </div>
            <div className="news-v2-secondary-actions">
              {selected.status === "approved" && (
                <button onClick={() => changeStatus("pending")} disabled={busy}>
                  <Undo2 size={14} /> Remover aprovação
                </button>
              )}
              {selected.status === "pending" && (
                <button onClick={() => changeStatus("rejected")} disabled={busy}>
                  <X size={14} /> Descartar
                </button>
              )}
              {selected.status === "rejected" && (
                <button onClick={() => changeStatus("pending")} disabled={busy}>
                  Reabrir
                </button>
              )}
              {selected.status === "blocked" ? (
                <button onClick={() => changeStatus("pending")} disabled={busy}>
                  Desbloquear
                </button>
              ) : (
                selected.status !== "deleted" && (
                  <button onClick={() => changeStatus("blocked")} disabled={busy}>
                    <ShieldBan size={14} /> Bloquear
                  </button>
                )
              )}
              {selected.status === "deleted" ? (
                <button onClick={() => changeStatus("pending")} disabled={busy}>
                  Restaurar
                </button>
              ) : (
                <button onClick={() => changeStatus("deleted")} disabled={busy}>
                  <Trash2 size={14} /> Excluir
                </button>
              )}
            </div>
            <details className="news-v2-ai">
              <summary>
                Extração assistida por IA <ChevronDown size={15} />
              </summary>
              <p>Cole um trecho da notícia para sugerir entidades e relações com citações.</p>
              <textarea
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                placeholder="Trecho da publicação original"
                maxLength={12000}
              />
              <button
                className="button button-secondary"
                disabled={busy || excerpt.trim().length < 100}
                onClick={analyze}
              >
                Analisar trecho
              </button>
              {selected.aiAnalysis && (
                <div className="news-v2-ai-result">
                  <p>{selected.aiAnalysis.summary}</p>
                  {selected.aiAnalysis.entities.map((entry, index) => (
                    <blockquote key={index}>
                      {entry.name}: “{entry.quote}”
                    </blockquote>
                  ))}
                </div>
              )}
            </details>
            <p className="news-v2-disclaimer">
              País do veículo: {selected.sourceCountry || "não informado"}. Ele não determina o
              local do evento.
            </p>
          </section>
        )}
      </div>
      <p className="news-v2-credit">
        Descoberta:{" "}
        <a href="https://www.gdeltproject.org/" target="_blank" rel="noopener noreferrer">
          GDELT
        </a>{" "}
        e{" "}
        <a href="https://agenciabrasil.ebc.com.br/feed/" target="_blank" rel="noopener noreferrer">
          Agência Brasil
        </a>
        . Canais acompanhados via GDELT:{" "}
        <a href="https://www.cnn.com/" target="_blank" rel="noopener noreferrer">
          CNN
        </a>
        ,{" "}
        <a href="https://www.bbc.com/news" target="_blank" rel="noopener noreferrer">
          BBC News
        </a>{" "}
        e{" "}
        <a href="https://g1.globo.com/" target="_blank" rel="noopener noreferrer">
          g1/Globo
        </a>
        . Cada notícia abre a publicação original; publicações automáticas podem ser corrigidas ou
        bloqueadas aqui.
      </p>
    </div>
  );
}
