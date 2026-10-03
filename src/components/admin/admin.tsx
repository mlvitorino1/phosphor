"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EventRecord, EventStatus, Impact } from "@/lib/domain/types";
import { IMPACT_LABEL, STATUS_LABEL } from "@/lib/domain/types";
import { utcDate } from "@/components/map/event-card";
import { specialMarker } from "@/lib/domain/marker-utils";

type AdminEvent = EventRecord & { hidden?: boolean };
export function Admin({
  configured,
  canSetup,
  authorized,
  initial,
}: {
  configured: boolean;
  canSetup: boolean;
  authorized: boolean;
  initial: AdminEvent[];
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");
  const [saved, setSaved] = useState("");
  const selected = events.find((e) => e.id === selectedId);
  const nearby = selected
    ? events
        .filter((e) => {
          if (e.id === selected.id || e.category !== selected.category) return false;
          const dLat = ((e.lat - selected.lat) * Math.PI) / 180,
            dLng = ((e.lng - selected.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((selected.lat * Math.PI) / 180) *
              Math.cos((e.lat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return (
            km <= (selected.category === "earthquake" ? 80 : 500) &&
            Math.abs(Date.parse(e.startedAt) - Date.parse(selected.startedAt)) <
              (selected.category === "earthquake" ? 3 : 168) * 3600000
          );
        })
        .slice(0, 5)
    : [];
  const [draft, setDraft] = useState<{
    impact: Impact;
    status: EventStatus;
    hidden: boolean;
    lat: string;
    lng: string;
    location: string;
    verifiedLevel: string;
  } | null>(null);
  const editing =
    draft ??
    (selected
      ? {
          impact: selected.impact,
          status: selected.status,
          hidden: Boolean(selected.hidden),
          lat: String(selected.lat),
          lng: String(selected.lng),
          location: selected.location,
          verifiedLevel:
            selected.verifiedLevel === null || selected.verifiedLevel === undefined
              ? ""
              : String(selected.verifiedLevel),
        }
      : null);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(configured ? "/api/admin/login" : "/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "marcus", password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Acesso não autorizado");
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!selected || !editing) return;
    setBusy(true);
    setError("");
    setSaved("");
    const lat = Number(editing.lat),
      lng = Number(editing.lng);
    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      setError("Coordenadas inválidas");
      setBusy(false);
      return;
    }
    try {
      const verifiedLevel = editing.verifiedLevel === "" ? null : Number(editing.verifiedLevel);
      if (
        specialMarker(selected) === "tornado" &&
        verifiedLevel !== null &&
        (!Number.isInteger(verifiedLevel) || verifiedLevel < 0 || verifiedLevel > 5)
      ) {
        setError("O nível EF deve ser de 0 a 5.");
        setBusy(false);
        return;
      }
      const res = await fetch(`/api/admin/event/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          impact: editing.impact,
          status: editing.status,
          hidden: editing.hidden,
          lat,
          lng,
          location: editing.location,
          ...(specialMarker(selected) === "tornado" ? { verifiedLevel } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Não foi possível salvar");
      setEvents(
        events.map((e) =>
          e.id === selected.id
            ? {
                ...e,
                impact: editing.impact,
                status: editing.status,
                hidden: editing.hidden,
                location: editing.location,
                lat,
                lng,
                verifiedLevel:
                  specialMarker(selected) === "tornado" ? verifiedLevel : e.verifiedLevel,
              }
            : e,
        ),
      );
      setDraft(null);
      setSaved("Alterações salvas.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }
  if (!configured && !canSetup)
    return (
      <div className="admin-login">
        <p className="admin-note">
          A área interna em produção requer PostgreSQL, ADMIN_PASSWORD e ADMIN_SESSION_SECRET.
          Consulte o README.
        </p>
      </div>
    );
  if (!authorized)
    return (
      <form className="admin-login" onSubmit={login}>
        <p className="admin-note">
          {configured
            ? "Acesso reservado ao administrador."
            : "Primeiro acesso local: crie a senha de Marcus. Ela ficará guardada com hash no computador."}
        </p>
        <label>Conta</label>
        <input value="marcus" readOnly aria-label="Conta de administrador" />
        <label htmlFor="admin-password">
          {configured ? "Senha" : "Crie uma senha de 12 caracteres ou mais"}
        </label>
        <input
          id="admin-password"
          type="password"
          minLength={configured ? 1 : 12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={configured ? "current-password" : "new-password"}
          required
        />
        {error && <p className="admin-error">{error}</p>}
        <button className="button button-primary" disabled={busy}>
          {configured ? "Entrar" : "Criar acesso de Marcus"}
        </button>
      </form>
    );
  return (
    <>
      <div className="admin-toolbar">
        <p className="admin-note">
          {events.length} eventos registrados · selecione um para revisar.
        </p>
        <button
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            router.refresh();
          }}
        >
          Sair
        </button>
      </div>
      <div className="admin-grid">
        <div className="admin-rows">
          {events.map((e) => (
            <button
              key={e.id}
              className={`admin-row ${selectedId === e.id ? "active" : ""}`}
              onClick={() => {
                setSelectedId(e.id);
                setDraft(null);
                setSaved("");
              }}
            >
              <span>
                {e.title}
                <br />
                <small>
                  {e.location} · {utcDate(e.updatedAt)}
                  {e.hidden ? " · OCULTO" : ""}
                </small>
              </span>
              <small>{IMPACT_LABEL[e.impact]}</small>
            </button>
          ))}
        </div>
        {selected && editing && (
          <div className="admin-editor">
            <div className="kicker">REVISÃO MANUAL</div>
            <h2>{selected.title}</h2>
            <p className="admin-note">Fontes: {selected.sources.map((s) => s.name).join(", ")}</p>
            <label>Impacto</label>
            <select
              value={editing.impact}
              onChange={(e) => setDraft({ ...editing, impact: e.target.value as Impact })}
            >
              {(Object.keys(IMPACT_LABEL) as Impact[]).map((i) => (
                <option key={i} value={i}>
                  {IMPACT_LABEL[i]}
                </option>
              ))}
            </select>
            <label>Status</label>
            <select
              value={editing.status}
              onChange={(e) => setDraft({ ...editing, status: e.target.value as EventStatus })}
            >
              {(Object.keys(STATUS_LABEL) as EventStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <label>Localização</label>
            <input
              value={editing.location}
              onChange={(e) => setDraft({ ...editing, location: e.target.value })}
            />
            <label>Latitude</label>
            <input
              inputMode="decimal"
              value={editing.lat}
              onChange={(e) => setDraft({ ...editing, lat: e.target.value })}
            />
            <label>Longitude</label>
            <input
              inputMode="decimal"
              value={editing.lng}
              onChange={(e) => setDraft({ ...editing, lng: e.target.value })}
            />
            {specialMarker(selected) === "tornado" && (
              <>
                <label>Nível EF verificado</label>
                <select
                  value={editing.verifiedLevel}
                  onChange={(e) => setDraft({ ...editing, verifiedLevel: e.target.value })}
                >
                  <option value="">Ainda não verificado</option>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
                <p className="admin-note">
                  O número aparece no ícone somente após confirmação do nível.
                </p>
              </>
            )}
            <label className="admin-checkbox">
              <input
                type="checkbox"
                checked={editing.hidden}
                onChange={(e) => setDraft({ ...editing, hidden: e.target.checked })}
              />{" "}
              Ocultar do público
            </label>
            {nearby.length > 0 && (
              <div className="admin-duplicates">
                <strong>Possíveis duplicidades próximas</strong>
                <p>Confira título, horário e fontes antes de ocultar um registro.</p>
                {nearby.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      setSelectedId(e.id);
                      setDraft(null);
                    }}
                  >
                    {e.title}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="admin-error">{error}</p>}
            {saved && <p className="admin-success">{saved}</p>}
            <button className="button button-primary" onClick={save} disabled={busy}>
              Salvar revisão
            </button>
          </div>
        )}
      </div>
    </>
  );
}
