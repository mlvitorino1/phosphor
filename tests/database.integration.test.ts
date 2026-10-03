import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db, ensureSchema, getSetting, setSetting } from "@/lib/server/database";
import { acquireJobLease } from "@/lib/server/job-lease";
import { consumeRateLimit } from "@/lib/server/rate-limit";

const connection = process.env.TEST_DATABASE_URL;
const prefix = `test-${randomUUID()}`;

describe.skipIf(!connection)("PostgreSQL integration (isolated test database)", () => {
  beforeAll(async () => {
    // Never run destructive fixtures against an operator's development or production database.
    if (!new URL(connection!).pathname.endsWith("/phosphor_test"))
      throw new Error("Use a dedicated phosphor_test database");
    vi.stubEnv("DATABASE_URL", connection!);
    await ensureSchema();
  });
  afterAll(async () => {
    const sql = db();
    if (sql) {
      await sql`DELETE FROM admin_settings WHERE key LIKE ${prefix + "%"}`;
      await sql`DELETE FROM ingestion_leases WHERE key LIKE ${prefix + "%"}`;
      await sql.end({ timeout: 5 });
    }
    vi.unstubAllEnvs();
  });
  it("round-trips settings without interpolating request data into SQL", async () => {
    const key = `${prefix}-'setting`;
    await setSetting(key, { enabled: false });
    expect(await getSetting(key)).toEqual({ enabled: false });
  });
  it("allows only one owner of a shared job lease", async () => {
    const leases = await Promise.all(Array.from({ length: 6 }, () => acquireJobLease(prefix)));
    expect(leases.filter(Boolean)).toHaveLength(1);
    await leases.find(Boolean)!.release();
    const renewed = await acquireJobLease(prefix);
    expect(renewed).not.toBeNull();
    await renewed!.release();
  });
  it("atomically limits concurrent authentication attempts", async () => {
    const request = new Request("https://example.org", { headers: { "x-forwarded-for": prefix } });
    const attempts = await Promise.all(
      Array.from({ length: 12 }, () => consumeRateLimit(request, prefix, 5, 1000)),
    );
    expect(attempts.filter(Boolean)).toHaveLength(5);
  });
});
