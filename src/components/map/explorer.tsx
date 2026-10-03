"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Filter,
  Globe2,
  Layers,
  MapPin,
  Search,
  Settings2,
  X,
} from "lucide-react";
import type { EventRecord, Impact } from "@/lib/domain/types";
import { CATEGORY_LABEL, KIND_LABEL, STATUS_LABEL } from "@/lib/domain/types";
import { EventIcon, ImpactBadge, utcDate } from "@/components/map/event-card";
import { MapCanvas } from "@/components/map/map-canvas";
import { REGION_LABEL, REGION_VALUES, regionFromEvent } from "@/lib/domain/regions";
import {
  EntryExperience,
  type EntryLocation,
  type EntryStage,
} from "@/components/auth/entry-experience";
import type { PublicUser } from "@/lib/domain/accounts";
import { Brand } from "@/components/layout/brand";

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function Explorer({
  initial,
  available,
  unavailable,
  fetchedAt,
  initialUser = null,
  admin = false,
  entryRequested = false,
}: {
  initial: EventRecord[];
  available: string[];
  unavailable: string[];
  fetchedAt: string;
  initialUser?: PublicUser | null;
  admin?: boolean;
  entryRequested?: boolean;
}) {
  const [events, setEvents] = useState(initial);
  const [user, setUser] = useState(initialUser);
  const [entryStage, setEntryStage] = useState<EntryStage>(
    entryRequested ? (initialUser ? "location" : "auth") : "complete",
  );
  const [entryLocation, setEntryLocation] = useState<EntryLocation>(null);
  const [visibleCount, setVisibleCount] = useState(entryRequested ? 0 : Number.POSITIVE_INFINITY);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [kind, setKind] = useState("all");
  const [impact, setImpact] = useState("all");
  const [hours, setHours] = useState("168");
  const [country, setCountry] = useState("all");
  const [region, setRegion] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [globe, setGlobe] = useState(entryRequested);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sourceStatus, setSourceStatus] = useState({ available, unavailable, fetchedAt });
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/api/events");
        if (!response.ok) return;
        const data = await response.json();
        setEvents(data.events);
        setSourceStatus({
          available: data.available,
          unavailable: data.unavailable,
          fetchedAt: data.fetchedAt,
        });
      } catch {
        /* keep last valid view */
      }
    }, 300000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const countries = useMemo(
    () =>
      [...new Set(events.map((e) => e.country).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [events],
  );
  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (e.expiresAt && Date.parse(e.expiresAt) <= clock) return false;
        const q = normalize(query.trim());
        if (
          q &&
          !normalize(
            `${e.title} ${e.location} ${e.country} ${CATEGORY_LABEL[e.category]} ${e.metrics["Tipo original"] ?? ""} ${e.metrics.Tipo ?? ""}`,
          ).includes(q)
        )
          return false;
        if (type === "earthquake" && e.category !== "earthquake") return false;
        if (type === "weather" && !["storm", "flood"].includes(e.category)) return false;
        if (type === "wildfire" && e.category !== "wildfire") return false;
        if (
          ["volcano", "landslide", "tsunami", "health", "civil"].includes(type) &&
          e.category !== type
        )
          return false;
        if (type === "other" && e.category !== "other") return false;
        if (kind !== "all" && (e.kind ?? "incident") !== kind) return false;
        if (impact !== "all" && e.impact !== impact) return false;
        if (country !== "all" && e.country !== country) return false;
        if (
          region !== "all" &&
          (region === "unknown" ? Boolean(regionFromEvent(e)) : regionFromEvent(e) !== region)
        )
          return false;
        if (
          hours !== "all" &&
          Date.parse(e.updatedAt) < Date.parse(sourceStatus.fetchedAt) - Number(hours) * 3600000
        )
          return false;
        return true;
      }),
    [events, query, type, kind, impact, country, region, hours, sourceStatus.fetchedAt, clock],
  );
  useEffect(() => {
    if (entryStage !== "welcome") return;
    const timer = window.setTimeout(
      () => setEntryStage("reveal"),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 300 : 1300,
    );
    return () => window.clearTimeout(timer);
  }, [entryStage]);
  useEffect(() => {
    if (entryStage !== "reveal") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (visibleCount >= filtered.length) {
      const timer = window.setTimeout(
        () => {
          setEntryStage("complete");
          window.history.replaceState(null, "", "/mapa");
        },
        reduced ? 0 : 650,
      );
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(
      () =>
        setVisibleCount((count) =>
          Math.min(filtered.length, count + Math.max(1, Math.ceil(filtered.length / 30))),
        ),
      reduced ? 0 : 95,
    );
    return () => window.clearTimeout(timer);
  }, [entryStage, filtered.length, visibleCount]);
  const displayed = entryStage === "complete" ? filtered : filtered.slice(0, visibleCount);
  const entryModalOpen =
    entryStage === "auth" || entryStage === "location" || entryStage === "welcome";
  function openEntry() {
    setSelectedId(null);
    setVisibleCount(0);
    setEntryLocation(null);
    setGlobe(true);
    setEntryStage(user ? "location" : "auth");
    window.history.pushState(null, "", "/mapa?entrar=1");
  }
  async function logout() {
    await fetch("/api/account/logout", { method: "POST" });
    setUser(null);
    setVisibleCount(0);
    setEntryLocation(null);
    setGlobe(true);
    setEntryStage("auth");
    window.history.pushState(null, "", "/mapa?entrar=1");
  }
  const selected = filtered.find((e) => e.id === selectedId) ?? null;
  const clear = () => {
    setQuery("");
    setType("all");
    setKind("all");
    setImpact("all");
    setHours("168");
    setCountry("all");
    setRegion("all");
  };
  return (
    <div className={`map-experience entry-stage-${entryStage}`}>
      <header className="site-header map-site-header" inert={entryModalOpen}>
        <div className="wrap header-inner">
          <Link className="brand" href="/" aria-label="Phosphor — início">
            <Brand />
          </Link>
          <nav aria-label="Navegação principal">
            <Link href="/mapa">Mapa</Link>
            <Link href="/eventos">Eventos</Link>
            <Link href="/historico">Histórico</Link>
            {user && <Link href="/alertas">Alertas</Link>}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <span className="header-user">{user.name.split(" ")[0]}</span>
                <button type="button" className="header-user" onClick={logout}>
                  Sair
                </button>
              </>
            ) : (
              <button type="button" className="header-user" onClick={openEntry}>
                Entrar
              </button>
            )}
            {admin && (
              <Link href="/configuracoes" className="header-user">
                <Settings2 size={15} />
                Marcus
              </Link>
            )}
          </div>
        </div>
      </header>
      <div className="explorer explorer-integrated">
        <div className="map-stage" inert={entryModalOpen}>
          <MapCanvas
            events={displayed}
            selectedId={selectedId}
            onSelect={setSelectedId}
            globe={globe}
            focusLocation={entryLocation}
            intro={entryStage === "auth" || entryStage === "location"}
          />
          <div className="map-controls">
            <button onClick={() => setGlobe(!globe)}>
              <Globe2 size={16} /> {globe ? "Mapa plano" : "Ver globo"}
            </button>
          </div>
          <div className="map-legend">
            <span>
              <i className="legend-dot low" /> Baixo
            </span>
            <span>
              <i className="legend-dot moderate" /> Moderado
            </span>
            <span>
              <i className="legend-dot high" /> Alto
            </span>
            <span>
              <i className="legend-dot critical" /> Crítico
            </span>
          </div>
        </div>
        <div className="explorer-top" inert={entryModalOpen}>
          <div className="explorer-title">
            <span className="pulse-dot" /> PHOSPHOR <span className="explorer-separator">/</span>{" "}
            MAPA DE EVENTOS
          </div>
          <div className="explorer-top-right">
            <span>
              <Clock3 size={14} /> Atualização periódica · {sourceStatus.available.length} fontes
            </span>
            <Link href="/eventos">
              Ver lista <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="explorer-search" inert={entryModalOpen}>
          <Search size={19} />
          <input
            aria-label="Pesquisar eventos"
            placeholder="Busque por país, cidade, região ou evento..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>BUSCA GLOBAL</kbd>
          <button
            className="mobile-filter-button"
            onClick={() => setFilterOpen(!filterOpen)}
            aria-label="Abrir filtros"
          >
            <Filter size={18} />
          </button>
        </div>
        <div className="explorer-main" inert={entryModalOpen}>
          <aside className={`filter-panel ${filterOpen ? "open" : ""}`}>
            <div className="panel-title">
              <span>
                <Filter size={17} /> FILTROS
              </span>
              <button onClick={clear}>Limpar</button>
            </div>
            <label>
              TIPO DE EVENTO
              <div className="select-wrap">
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="all">Todos os tipos</option>
                  <option value="earthquake">Terremotos</option>
                  <option value="weather">Clima e inundações</option>
                  <option value="wildfire">Incêndios</option>
                  <option value="volcano">Vulcões</option>
                  <option value="landslide">Deslizamentos</option>
                  <option value="tsunami">Tsunamis</option>
                  <option value="health">Saúde pública</option>
                  <option value="civil">Emergências civis</option>
                  <option value="other">Outros</option>
                </select>
                <ChevronDown size={16} />
              </div>
            </label>
            <label>
              NATUREZA DO REGISTRO
              <div className="select-wrap">
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="all">Todos os registros</option>
                  <option value="incident">Ocorrências</option>
                  <option value="alert">Alertas</option>
                  <option value="observation">Observações</option>
                  <option value="report">Notícias</option>
                </select>
                <ChevronDown size={16} />
              </div>
            </label>
            <label>
              NÍVEL DE IMPACTO
              <div className="select-wrap">
                <select value={impact} onChange={(e) => setImpact(e.target.value)}>
                  <option value="all">Todos os níveis</option>
                  {(["low", "moderate", "high", "critical"] as Impact[]).map((i) => (
                    <option value={i} key={i}>
                      {{ low: "Baixo", moderate: "Moderado", high: "Alto", critical: "Crítico" }[i]}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
            </label>
            <label>
              ATUALIZAÇÃO
              <div className="select-wrap">
                <select value={hours} onChange={(e) => setHours(e.target.value)}>
                  <option value="1">Última hora</option>
                  <option value="6">Últimas 6 horas</option>
                  <option value="24">Últimas 24 horas</option>
                  <option value="168">Últimos 7 dias</option>
                  <option value="all">Todas disponíveis</option>
                </select>
                <ChevronDown size={16} />
              </div>
            </label>
            <label>
              REGIÃO
              <div className="select-wrap">
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  <option value="all">Todas as regiões</option>
                  {REGION_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {REGION_LABEL[value]}
                    </option>
                  ))}
                  <option value="unknown">Não definida</option>
                </select>
                <ChevronDown size={16} />
              </div>
            </label>
            <label>
              PAÍS INFORMADO
              <div className="select-wrap">
                <select value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="all">Todos os países</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
            </label>
            <div className="filter-note">
              <Layers size={16} />
              <span>
                Algumas posições indicam apenas o país ou a área do alerta. Confira a precisão nos
                detalhes.
              </span>
            </div>
            {sourceStatus.unavailable.length > 0 && (
              <div className="filter-warning">
                Fonte temporariamente indisponível: {sourceStatus.unavailable.join(", ")}.
              </div>
            )}
          </aside>
          <aside className="results-panel">
            <div className="panel-title">
              <span>EVENTOS NO MAPA</span>
              <b>{displayed.length}</b>
            </div>
            <div className="results-scroll">
              {displayed.length ? (
                displayed.map((e) => (
                  <button
                    className={`result-row ${selectedId === e.id ? "selected" : ""}`}
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                  >
                    <div className={`result-icon impact-${e.impact}`}>
                      <EventIcon event={e} size={18} />
                    </div>
                    <div>
                      <div className="result-title">{e.title}</div>
                      <div className="result-meta">
                        <MapPin size={12} /> {e.location}
                      </div>
                      <div className="result-bottom">
                        <ImpactBadge impact={e.impact} />
                        <span>{utcDate(e.updatedAt)}</span>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="results-empty">
                  {entryStage === "reveal"
                    ? "Conectando sinais ao mapa…"
                    : "Nenhum evento corresponde aos filtros. Ajuste a busca ou o período."}
                </div>
              )}
            </div>
          </aside>
        </div>
        {selected && (
          <div
            className={`selection-overlay impact-${selected.impact}`}
            role="dialog"
            aria-label={`Evento: ${selected.title}`}
          >
            <button
              className="selection-close"
              onClick={() => setSelectedId(null)}
              aria-label="Fechar detalhes"
            >
              <X size={18} />
            </button>
            <div className="selection-kicker">
              <EventIcon event={selected} size={16} /> {CATEGORY_LABEL[selected.category]} ·{" "}
              {KIND_LABEL[selected.kind ?? "incident"]} <ImpactBadge impact={selected.impact} />
            </div>
            <h2>{selected.title}</h2>
            <p>{selected.summary}</p>
            <div className="selection-facts">
              <div className="selection-location">
                <span className="selection-label">LOCAL DO EVENTO</span>
                <strong>
                  <MapPin size={17} /> {selected.location}
                </strong>
              </div>
              <div className="selection-date">
                <span className="selection-label">INÍCIO</span>
                <time dateTime={selected.startedAt}>{utcDate(selected.startedAt)}</time>
              </div>
              <div className="selection-date">
                <span className="selection-label">ATUALIZADO</span>
                <time dateTime={selected.updatedAt}>{utcDate(selected.updatedAt)}</time>
              </div>
              {selected.kind === "report" && selected.expiresAt && (
                <div className="selection-date selection-expiry">
                  <span className="selection-label">NO MAPA ATÉ</span>
                  <time dateTime={selected.expiresAt}>{utcDate(selected.expiresAt)}</time>
                </div>
              )}
            </div>
            <div className="selection-foot">
              <div>
                <span className="selection-label">FONTE</span>
                <strong className="selection-source">
                  {selected.sources.map((s) => s.name).join(", ")}
                </strong>
              </div>
              <span className="selection-status">{STATUS_LABEL[selected.status]}</span>
            </div>
            <Link
              href={`/evento/${encodeURIComponent(selected.id)}`}
              className="button button-primary"
            >
              Ver detalhes <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>
      <EntryExperience
        stage={entryStage}
        user={user}
        progress={displayed.length}
        total={filtered.length}
        onStage={setEntryStage}
        onUser={setUser}
        onLocation={setEntryLocation}
      />
    </div>
  );
}
