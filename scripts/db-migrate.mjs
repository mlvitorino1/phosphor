import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

async function migrate() {
  const connection = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
  if (!connection) throw new Error("Configure DATABASE_URL ou DATABASE_MIGRATION_URL");
  const sql = postgres(connection, { max: 1, connect_timeout: 10 });

  try {
    const directory = join(process.cwd(), "database", "migrations");
    const versions = (await readdir(directory)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    await sql.begin(async (tx) => {
      // Serialize deploys. The lock is released automatically at transaction end.
      await tx`SELECT pg_advisory_xact_lock(314159265)`;
      await tx`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
      for (const version of versions) {
        const body = await readFile(join(directory, version), "utf8");
        const checksum = createHash("sha256").update(body).digest("hex");
        const existing =
          await tx`SELECT checksum FROM schema_migrations WHERE version = ${version}`;
        if (existing.length) {
          if (existing[0].checksum !== checksum)
            throw new Error(`Migração já aplicada foi alterada: ${version}`);
          continue;
        }
        // Only trusted, versioned repository SQL is executed here; never request input.
        await tx.unsafe(body);
        await tx`INSERT INTO schema_migrations (version, checksum) VALUES (${version}, ${checksum})`;
        console.info(`Applied ${version}`);
      }
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Database errors can include a connection URL, SQL parameters or private account data.
void migrate().catch(() => {
  console.error(
    "Falha na migração. Verifique a conexão, TLS, permissões e checksums em docs/setup.md.",
  );
  process.exitCode = 1;
});
