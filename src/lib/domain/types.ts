export type Impact = "low" | "moderate" | "high" | "critical";
export type EventStatus = "detected" | "active" | "monitoring" | "stabilizing" | "closed";
export type Category =
  | "earthquake"
  | "storm"
  | "flood"
  | "wildfire"
  | "volcano"
  | "landslide"
  | "tsunami"
  | "health"
  | "civil"
  | "other";
export type RecordKind = "incident" | "alert" | "observation" | "report";
export type Region =
  "North America" | "South America" | "Europe" | "Asia" | "Africa" | "Oceania" | "Antarctica";
export type AreaGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export type EventSource = { name: string; url: string; sourceId: string };
export type EventUpdate = { at: string; text: string };

export type EventRecord = {
  id: string;
  title: string;
  category: Category;
  location: string;
  country: string;
  region?: Region;
  lat: number;
  lng: number;
  geoType: "localized" | "regional";
  radiusKm: number | null;
  kind?: RecordKind;
  geoPrecision?: "point" | "area" | "country";
  geometry?: AreaGeometry;
  verifiedLevel?: number | null;
  impact: Impact;
  status: EventStatus;
  startedAt: string;
  updatedAt: string;
  expiresAt?: string;
  summary: string;
  sources: EventSource[];
  updates: EventUpdate[];
  metrics: Record<string, string | number>;
};

export const CATEGORY_LABEL: Record<Category, string> = {
  earthquake: "Terremoto",
  storm: "Tempestade",
  flood: "Inundação",
  wildfire: "Incêndio florestal",
  volcano: "Vulcão",
  landslide: "Deslizamento",
  other: "Outro",
  tsunami: "Tsunami",
  health: "Saúde pública",
  civil: "Emergência civil",
};
export const KIND_LABEL: Record<RecordKind, string> = {
  incident: "Ocorrência",
  alert: "Alerta",
  observation: "Observação",
  report: "Notícia",
};
export const IMPACT_LABEL: Record<Impact, string> = {
  low: "Baixo",
  moderate: "Moderado",
  high: "Alto",
  critical: "Crítico",
};
export const STATUS_LABEL: Record<EventStatus, string> = {
  detected: "Detectado",
  active: "Ativo",
  monitoring: "Monitoramento",
  stabilizing: "Estabilizando",
  closed: "Encerrado",
};
