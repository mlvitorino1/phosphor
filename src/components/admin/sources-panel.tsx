"use client";
import { useState } from "react";

const descriptions: Record<string, string> = {
  USGS: "Terremotos",
  "NASA EONET": "Fenômenos naturais",
  GDACS: "Alertas globais de desastres",
  "NOAA/NWS": "Alertas meteorológicos dos EUA",
  "GeoMet Canadá": "Alertas meteorológicos do Canadá",
  MeteoAlarm: "Alertas meteorológicos europeus",
  "NOAA/NHC": "Ciclones tropicais",
  "NOAA Tsunami": "Avisos de tsunami",
  JMA: "Terremotos, tsunamis e vulcões do Japão",
  "Copernicus EMS": "Mapeamento de emergência",
  GeoNet: "Terremotos e vulcões da Nova Zelândia",
  "IFRC GO": "Ocorrências humanitárias",
  OMS: "Comunicados de surtos",
  "NASA FIRMS": "Observações térmicas por satélite",
  GDELT: "Busca geral de notícias multilíngues sobre eventos",
  "Agência Brasil": "RSS e seções do site para notícias brasileiras no mapa",
  CNN: "Manchetes da CNN descobertas pelo GDELT, com link para a matéria",
  "BBC News": "Manchetes da BBC descobertas pelo GDELT, com link para a matéria",
  "Globo / g1": "Manchetes do g1/Globo descobertas pelo GDELT, com link para a matéria",
};
export function SourcesPanel({ initial }: { initial: { name: string; enabled: boolean }[] }) {
  const [sources, setSources] = useState(initial);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function toggle(name: string, enabled: boolean) {
    setBusy(name);
    setError("");
    try {
      const response = await fetch("/api/admin/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, enabled }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok)
        throw new Error(data.error || "Não foi possível alterar a fonte");
      setSources(data.sources);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao alterar a fonte");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="source-summary">
        {sources.filter((s) => s.enabled).length} de {sources.length} fontes ativadas
      </div>
      {error && <p className="admin-error">{error}</p>}
      <div className="source-grid">
        {sources.map((source) => (
          <div className="source-setting" key={source.name}>
            <div>
              <strong>{source.name}</strong>
              <p>{descriptions[source.name] ?? "Fonte de eventos"}</p>
            </div>
            <button
              type="button"
              className={`source-toggle ${source.enabled ? "enabled" : ""}`}
              aria-label={`${source.enabled ? "Pausar" : "Ativar"} ${source.name}`}
              aria-pressed={source.enabled}
              disabled={busy === source.name}
              onClick={() => toggle(source.name, !source.enabled)}
            >
              <span />
              {source.enabled ? "Ativa" : "Pausada"}
            </button>
          </div>
        ))}
      </div>
      <p className="admin-note">
        CNN, BBC News e Globo/g1 usam consultas próprias ao GDELT e podem continuar ativos quando a
        busca geral estiver pausada. A NASA FIRMS aparece após configurar a chave MAP_KEY. Em
        produção, as preferências são guardadas no banco de dados.
      </p>
    </>
  );
}
