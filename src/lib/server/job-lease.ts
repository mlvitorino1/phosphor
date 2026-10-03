import "server-only";
import { randomUUID } from "node:crypto";
import { db, ensureSchema } from "./database";

/** Short renewable-by-expiry lease; no network request runs inside a DB transaction. */
export async function acquireJobLease(key: string, durationMs = 300_000) {
  const sql = db();
  if (!sql) return { release: async () => {} };
  await ensureSchema();
  const owner = randomUUID();
  const rows = await sql`
    INSERT INTO ingestion_leases (key, owner, expires_at)
    VALUES (${key}, ${owner}, NOW() + ${durationMs} * INTERVAL '1 millisecond')
    ON CONFLICT (key) DO UPDATE SET owner = EXCLUDED.owner, expires_at = EXCLUDED.expires_at
    WHERE ingestion_leases.expires_at <= NOW()
    RETURNING key`;
  if (!rows.length) return null;
  return {
    release: async () => {
      await sql`DELETE FROM ingestion_leases WHERE key = ${key} AND owner = ${owner}`;
    },
  };
}
