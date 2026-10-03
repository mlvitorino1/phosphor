export type RecruiterLevel = "medium" | "advanced";

const reports = [
  { id: "A", category: "earthquake", lat: -15.8, lng: -47.9, at: "2026-10-02T10:00:00Z" },
  { id: "B", category: "earthquake", lat: -15.82, lng: -47.915, at: "2026-10-02T10:20:00Z" },
  { id: "C", category: "earthquake", lat: -15.84, lng: -47.93, at: "2026-10-02T10:40:00Z" },
  { id: "D", category: "earthquake", lat: -15.8, lng: -47.9, at: "2026-10-02T17:00:00Z" },
  { id: "E", category: "flood", lat: -15.8, lng: -47.9, at: "2026-10-02T10:10:00Z" },
  { id: "F", category: "flood", lat: -15.81, lng: -47.905, at: "2026-10-02T10:35:00Z" },
];

/** Fictitious, browser-only puzzle data. This module grants no application permissions. */
export function recruiterChallenge() {
  return {
    name: "Sinal 15 · Conexões sob ruído",
    rules: [
      "Relatos se conectam quando têm a mesma categoria, distância geodésica <= 3 km e diferença de tempo <= 60 minutos.",
      "Forme componentes conexos: a relação é transitiva, mesmo que dois extremos não sejam vizinhos diretos.",
      "Use o raio terrestre de 6371 km. Inclua cada ID exatamente uma vez; ordem de grupos e IDs é irrelevante.",
    ],
    reports: structuredClone(reports),
    submit: "window.phosphor.submit([[/* IDs do primeiro grupo */], /* demais grupos */])",
  };
}

export function solvesRecruiterChallenge(groups: unknown): boolean {
  if (!Array.isArray(groups) || groups.length !== 3) return false;
  if (groups.some((group) => !Array.isArray(group) || group.some((id) => typeof id !== "string")))
    return false;
  const ids = groups.flat();
  if (ids.length !== reports.length || new Set(ids).size !== reports.length) return false;
  return (
    groups
      .map((group: string[]) => [...group].sort().join(","))
      .sort()
      .join("|") === "A,B,C|D|E,F"
  );
}
