import { distinctPublishers, publisherIdentity } from "./publisher";
import type { NewsCandidate } from "@/lib/domain/models";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const stop = new Set(
  "the and for with from after this that para como sobre entre mais uma uns las los del por con tras ante que das dos com nao nos nas tem seu sua sera foram news noticia noticias evento alerta brasil brazil mexico colombia peru argentina chile".split(
    " ",
  ),
);
function terms(text: string) {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((word) => word.length > 3 && !stop.has(word)),
  );
}
const themes = {
  "Cadeia de suprimentos":
    /\b(portos|puertos|port|harbor|aeroporto|aeropuerto|airport|logistica|logistics|supply|abastecimento|abastecimiento|cadeia|cadena|corredor|rodovia|carretera|highway|ferrovia|ferrocarril|railway|bloqueio|bloqueo|blockade|greve|huelga|strike|transporte|transport|energia|energy|electricidade|electricidad|power|apagao|carga|cargo|exportacao|exportacion|export|importacao|importacion|import|combustivel|combustible|fuel|refinaria|refineria|refinery|petroleo|oil)\b|\b(?:porto|puerto)\s+(?:de|maritimo|comercial|principal|internacional)\b/i,
  Agro: /\b(agro|agricultura|agriculture|safra|cosecha|harvest|soja|soy|milho|maiz|corn|trigo|wheat|gado|ganado|cattle|seca|sequia|drought)\b/i,
  ESG: /\b(ambiental|environment|sustent|sostenib|poluicao|contaminacion|pollution|desmatamento|deforest|emissoes|emisiones|emissions)\b/i,
  "Mercado financeiro":
    /\b(bolsa|stock|market|mercado|cambio|exchange|dolar|dollar|juros|interes|interest|banco|bank|inflacao|inflacion|inflation)\b/i,
  Seguros: /\b(seguro|seguros|insurance|sinistro|indemniz|claim|resseguro|reinsurance)\b/i,
  "Risco político":
    /\b(eleicao|eleccion|election|protesto|protesta|protest|conflito|conflicto|conflict|golpe|coup|sancao|sancion|sanction|fronteira|frontera|border)\b/i,
};
export type NewsTheme = keyof typeof themes;
export const NEWS_THEMES = Object.keys(themes) as NewsTheme[];
export function newsThemes(item: NewsCandidate): NewsTheme[] {
  const text = normalize(`${item.title} ${item.summary ?? ""}`);
  return NEWS_THEMES.filter((theme) => themes[theme].test(text));
}
export function likelySameStory(a: NewsCandidate, b: NewsCandidate) {
  if (
    a.id === b.id ||
    Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) > 24 * 3600000
  )
    return false;
  if (a.url === b.url) return true;
  const left = terms(a.title),
    right = terms(b.title);
  const shared = [...left].filter((word) => right.has(word)).length;
  return shared >= 4 && shared / Math.min(left.size, right.size) >= 0.72;
}
const officialDomain = /\.(gov|mil|int)$|\.(gov|gob|mil)\.[a-z]{2,3}$|(^|\.)ebc\.com\.br$/i;
export function assessNews(item: NewsCandidate, all: NewsCandidate[]) {
  const matched = all.filter((other) => likelySameStory(item, other));
  const independent = [
    ...new Set(
      matched
        .filter((other) => distinctPublishers(other.url, item.url))
        .map((other) => publisherIdentity(other.url) ?? other.domain),
    ),
  ];
  const verificationDomain = (() => {
    try {
      return new URL(item.verificationUrl ?? "").hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const sourceSignals: string[] = [];
  let sourceScore = 35;
  if (officialDomain.test(item.domain)) {
    sourceScore += 20;
    sourceSignals.push("Fonte institucional identificada");
  }
  if (verificationDomain && distinctPublishers(item.verificationUrl ?? "", item.url)) {
    sourceScore += 25;
    sourceSignals.push("Confirmação em domínio distinto");
  }
  if (independent.length) {
    sourceScore += Math.min(20, independent.length * 10);
    sourceSignals.push(`${independent.length} veículo(s) com manchete semelhante`);
  }
  if (item.reviewedAt) {
    sourceScore += 10;
    sourceSignals.push("Revisão humana registrada");
  }
  const matchedThemes = newsThemes(item);
  const supplyChain = matchedThemes.includes("Cadeia de suprimentos");
  const latam =
    item.region === "South America" ||
    (item.region === "North America" &&
      /\b(mexico|guatemala|belize|honduras|elsalvador|el salvador|nicaragua|costa rica|panama|cuba|haiti|dominican|republica dominicana|porto rico|puerto rico|caribe|caribbean|central america|centroamerica)\b/i.test(
        normalize(item.location ?? ""),
      ));
  const impactPoints = { low: 12, moderate: 27, high: 45, critical: 60 }[item.impact ?? "moderate"];
  const riskScore = Math.min(
    100,
    impactPoints + (supplyChain ? 20 : 0) + (latam ? 12 : 0) + (item.status === "approved" ? 8 : 0),
  );
  return {
    themes: matchedThemes,
    supplyChain,
    latam,
    riskScore,
    sourceScore: Math.min(100, sourceScore),
    sourceSignals,
    corroboratingDomains: independent,
    similarCount: matched.length,
    riskLabel: riskScore >= 75 ? "Alto" : riskScore >= 45 ? "Moderado" : "Baixo",
  };
}
