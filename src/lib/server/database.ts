import "server-only";
import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;
let initialized: Promise<void> | null = null;

export function db() {
  if (!process.env.DATABASE_URL) return null;
  client ??= postgres(process.env.DATABASE_URL, { max: 4, idle_timeout: 20, connect_timeout: 10 });
  return client;
}

export async function ensureSchema() {
  const sql = db();
  if (!sql) return;
  initialized ??= (async () => {
    // Deploy-time migrations keep the application connection free of DDL privileges.
    const rows = await sql<
      { version: string }[]
    >`SELECT version FROM schema_migrations ORDER BY version`;
    if (!rows.some((row) => row.version === "002_request_controls.sql"))
      throw new Error("Banco desatualizado. Execute npm run db:migrate antes de iniciar.");
  })().catch((error) => {
    initialized = null;
    throw error;
  });
  await initialized;
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const sql = db();
  if (!sql) return null;
  await ensureSchema();
  const rows = await sql<{ value: T }[]>`SELECT value FROM admin_settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: unknown) {
  const sql = db();
  if (!sql) return false;
  await ensureSchema();
  await sql`INSERT INTO admin_settings (key, value) VALUES (${key}, ${sql.json(value as never)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  return true;
}

/** Merge one settings field atomically so concurrent source toggles cannot overwrite each other. */
export async function patchSetting(key: string, field: string, value: boolean) {
  const sql = db();
  if (!sql) return false;
  await ensureSchema();
  await sql`INSERT INTO admin_settings (key, value) VALUES (${key}, ${sql.json({ [field]: value })})
    ON CONFLICT (key) DO UPDATE SET value = admin_settings.value || EXCLUDED.value`;
  return true;
}
