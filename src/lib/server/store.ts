import { isEventCurrent } from "@/lib/domain/event-visibility";
import { acquireJobLease } from "./job-lease";
import "server-only";
import { mergeEvents, sameEvent } from "@/lib/domain/event-deduplication";
import { loadFeeds, sourceSettings } from "@/lib/server/feeds";
import type { EventRecord, EventStatus, Impact } from "@/lib/domain/types";
import { readLocalState, updateLocalState } from "@/lib/server/local-state";
import { approvedNewsEvents } from "@/lib/server/news";
import { db, ensureSchema } from "@/lib/server/database";

type Row = {
  data: EventRecord;
  impact_override: Impact | null;
  status_override: EventStatus | null;
  location_override: string | null;
  lat_override: number | null;
  lng_override: number | null;
  verified_level_override: number | null;
  hidden: boolean;
};
function applyOverrides(row: Row): EventRecord {
  return {
    ...row.data,
    impact: row.impact_override ?? row.data.impact,
    status: row.status_override ?? row.data.status,
    location: row.location_override ?? row.data.location,
    lat: row.lat_override ?? row.data.lat,
    lng: row.lng_override ?? row.data.lng,
    verifiedLevel: row.verified_level_override ?? row.data.verifiedLevel,
  };
}
export async function getEvents(includeHidden = false) {
  const sql = db();
  if (!sql) {
    const feed = await loadFeeds();
    const state = readLocalState();
    const approved = await approvedNewsEvents();
    const events = mergeEvents(
      [...feed.events, ...approved]
        .map((event) => ({ ...event, ...state.eventOverrides[event.id] }))
        .filter((event) => includeHidden || (!event.hidden && isEventCurrent(event))),
    ).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return {
      ...feed,
      events,
      available: approved.length ? [...feed.available, "Notícias"] : feed.available,
    };
  }
  await ensureSchema();
  const rows = await sql<
    Row[]
  >`SELECT data, impact_override, status_override, location_override, lat_override, lng_override, verified_level_override, hidden FROM events ORDER BY updated_at DESC LIMIT 1000`;
  const approved = await approvedNewsEvents();
  const official = rows.length
    ? rows
        .filter((row) => includeHidden || !row.hidden)
        .map((row) =>
          includeHidden ? { ...applyOverrides(row), hidden: row.hidden } : applyOverrides(row),
        )
    : (await loadFeeds()).events;
  const enabled = await sourceSettings();
  const events = mergeEvents(
    [...official, ...approved].filter((event) => includeHidden || isEventCurrent(event)),
  ).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return {
    events,
    available: [
      ...enabled.filter((s) => s.enabled).map((s) => s.name),
      ...(approved.length ? ["Notícias"] : []),
    ],
    unavailable: [],
    fetchedAt: new Date().toISOString(),
  };
}
export async function getEvent(id: string) {
  const result = await getEvents();
  return result.events.find((e) => e.id === id) ?? null;
}
export async function ingest() {
  const lease = await acquireJobLease("official_events");
  if (!lease)
    return { skipped: true, created: 0, updated: 0, total: 0, available: [], unavailable: [] };
  try {
    return await performIngest();
  } finally {
    await lease.release();
  }
}
async function performIngest() {
  const sql = db();
  if (!sql) throw new Error("DATABASE_URL não configurada");
  await ensureSchema();
  const feed = await loadFeeds();
  if (!feed.available.length) throw new Error("Nenhuma fonte disponível");
  let created = 0,
    updated = 0;
  const existingRows = await sql<
    { id: string; data: EventRecord }[]
  >`SELECT id, data FROM events ORDER BY updated_at DESC LIMIT 2000`;
  for (const event of feed.events) {
    const previousRow = existingRows.find(
      (row) =>
        row.id === event.id || (row.data.category === event.category && sameEvent(row.data, event)),
    );
    const id = previousRow?.id ?? event.id;
    const previous = previousRow?.data;
    const combined = previous ? mergeEvents([event, previous])[0] : event;
    const newest =
      previous && Date.parse(previous.updatedAt) > Date.parse(event.updatedAt) ? previous : event;
    const data: EventRecord = {
      ...newest,
      id,
      sources: combined.sources,
      updates: combined.updates.slice(0, 20),
    };
    const changed = !previous || JSON.stringify(previous) !== JSON.stringify(data);
    if (!changed) continue;
    await sql.begin(async (tx) => {
      await tx`INSERT INTO events (id, data, updated_at) VALUES (${id}, ${tx.json(data)}, ${data.updatedAt})
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`;
      await tx`INSERT INTO event_updates (event_id, at, note) VALUES (${id}, ${data.updatedAt}, ${previous ? "Informações atualizadas pela fonte." : "Evento incorporado à plataforma."})`;
    });
    if (!previous) {
      created++;
      existingRows.push({ id, data });
    } else {
      updated++;
      previousRow!.data = data;
    }
  }
  return {
    created,
    updated,
    total: feed.events.length,
    available: feed.available,
    unavailable: feed.unavailable,
  };
}
export async function updateEvent(
  id: string,
  patch: {
    hidden?: boolean;
    impact?: Impact | null;
    status?: EventStatus | null;
    lat?: number;
    lng?: number;
    location?: string;
    verifiedLevel?: number | null;
  },
) {
  const sql = db();
  if (!sql) {
    updateLocalState((state) => {
      const current = { ...state.eventOverrides[id] };
      for (const [field, value] of Object.entries(patch)) {
        if (value === null) delete current[field as keyof typeof current];
      }
      const updates = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== null && value !== undefined),
      );
      state.eventOverrides[id] = { ...current, ...updates };
    });
    return true;
  }
  await ensureSchema();
  const rows = await sql<{ id: string }[]>`SELECT id FROM events WHERE id = ${id}`;
  if (!rows.length) return false;
  await sql.begin(async (tx) => {
    await tx`UPDATE events SET
    hidden = COALESCE(${patch.hidden ?? null}, hidden),
    impact_override = CASE WHEN ${patch.impact === null} THEN NULL ELSE COALESCE(${patch.impact ?? null}, impact_override) END,
    status_override = CASE WHEN ${patch.status === null} THEN NULL ELSE COALESCE(${patch.status ?? null}, status_override) END,
    location_override = COALESCE(${patch.location ?? null}, location_override),
    lat_override = COALESCE(${patch.lat ?? null}, lat_override),
    lng_override = COALESCE(${patch.lng ?? null}, lng_override),
    verified_level_override = CASE WHEN ${patch.verifiedLevel === null} THEN NULL ELSE COALESCE(${patch.verifiedLevel ?? null}, verified_level_override) END
    WHERE id = ${id}`;
    await tx`INSERT INTO event_updates (event_id, note) VALUES (${id}, 'Revisão manual da equipe.')`;
  });
  return true;
}
export async function getTimeline(id: string) {
  const sql = db();
  if (!sql) return [];
  await ensureSchema();
  const rows = await sql<
    { at: Date; note: string }[]
  >`SELECT at, note FROM event_updates WHERE event_id = ${id} ORDER BY at DESC LIMIT 30`;
  return rows.map((row) => ({ at: row.at.toISOString(), text: row.note }));
}
export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
