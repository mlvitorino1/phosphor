"use client";
import { useState } from "react";
import type { PublicUser, AlertPrefs } from "@/lib/domain/accounts";

export function AlertSettings({
  initialUser,
  initialPrefs,
}: {
  initialUser: PublicUser;
  initialPrefs: AlertPrefs;
}) {
  const [user, setUser] = useState(initialUser),
    [prefs, setPrefs] = useState(initialPrefs),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao salvar");
      setPrefs(data.prefs);
      setMessage("Preferências salvas.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }
  async function requestVerification() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/verify/request", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha no envio");
      setMessage("Enviamos um link de confirmação para seu e-mail.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Falha no envio");
    } finally {
      setBusy(false);
    }
  }
  async function refreshStatus() {
    const response = await fetch("/api/account/session", { cache: "no-store" });
    const data = await response.json();
    if (data.user) {
      setUser(data.user);
      setMessage(
        data.user.emailVerified ? "E-mail confirmado." : "Ainda aguardando confirmação por e-mail.",
      );
    }
  }
  return (
    <section className="alerts-card">
      <div className="alerts-account">
        <strong>{user.email}</strong>
        <span>{user.emailVerified ? "E-mail confirmado" : "Confirmação pendente"}</span>
      </div>
      {!user.emailVerified && (
        <div className="alerts-verify">
          <p>Confirme o e-mail para ativar notificações. Você pode usar o mapa enquanto isso.</p>
          <button className="button button-secondary" disabled={busy} onClick={requestVerification}>
            Enviar confirmação
          </button>
          <button className="button button-secondary" onClick={refreshStatus}>
            Atualizar status
          </button>
        </div>
      )}
      <label className="alerts-switch">
        <input
          type="checkbox"
          checked={prefs.enabled}
          disabled={!user.emailVerified}
          onChange={(event) => setPrefs({ ...prefs, enabled: event.target.checked })}
        />
        <span>
          <strong>Alertas por e-mail</strong>
          <small>Notícias revisadas que atendem aos critérios abaixo.</small>
        </span>
      </label>
      <div className="alerts-grid">
        <label>
          Risco mínimo
          <select
            value={prefs.minRisk}
            onChange={(event) => setPrefs({ ...prefs, minRisk: Number(event.target.value) })}
          >
            <option value={45}>Moderado · 45</option>
            <option value={60}>Elevado · 60</option>
            <option value={75}>Crítico · 75</option>
          </select>
        </label>
        <label className="alerts-check">
          <input
            type="checkbox"
            checked={prefs.supplyChainOnly}
            onChange={(event) => setPrefs({ ...prefs, supplyChainOnly: event.target.checked })}
          />{" "}
          Apenas cadeia de suprimentos
        </label>
        <label className="alerts-check">
          <input
            type="checkbox"
            checked={prefs.latamOnly}
            onChange={(event) => setPrefs({ ...prefs, latamOnly: event.target.checked })}
          />{" "}
          Apenas América Latina
        </label>
      </div>
      <p className="alerts-explain">
        O score combina impacto revisado, relação com logística e localização confirmada. Não prevê
        ocorrências nem mede a verdade de uma notícia. Alertas são enviados após aprovação humana,
        com nova verificação a cada 15 minutos.
      </p>
      {message && (
        <p className="admin-success" role="status">
          {message}
        </p>
      )}
      <button className="button button-primary" disabled={busy} onClick={save}>
        Salvar preferências
      </button>
    </section>
  );
}
