export type HistoricalRecord = {
  id: string;
  date: string;
  rootCode: string;
  type: string;
  eventCode: string;
  actor1: string;
  actor2: string;
  location: string;
  countryCode: string;
  geoLevel?: string;
  lat: number;
  lng: number;
  mentions: number;
  sources: number;
  sourceUrl: string | null;
};
export type HistoricalArchive = {
  period: string;
  country: string | null;
  archiveUrl: string;
  importedAt: string;
  scanned: number;
  eligible: number;
  selection: string;
  records: HistoricalRecord[];
};
export type HistoricalIndex = {
  key: string;
  period: string;
  country: string | null;
  count: number;
  importedAt: string;
};
