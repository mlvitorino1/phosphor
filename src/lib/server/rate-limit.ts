import "server-only";
import { createHash } from "node:crypto";
import { db, ensureSchema } from "./database";

/** Bounded development fallback. Production counters are shared in PostgreSQL. */
export class MemoryRateLimiter {
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();
  constructor(private readonly capacity = 10_000) {}
  consume(key: string, limit: number, windowMs: number, now = Date.now()) {
    for (const [id, counter] of this.counters)
      if (counter.expiresAt <= now) this.counters.delete(id);
    const current = this.counters.get(key);
    if (!current && this.counters.size >= this.capacity) return false;
    const next = current ?? { count: 0, expiresAt: now + windowMs };
    next.count++;
    this.counters.set(key, next);
    return next.count <= limit;
  }
}

const memory = new MemoryRateLimiter();
export async function consumeRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
) {
  // Configure the reverse proxy to replace x-forwarded-for rather than trust client input.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = createHash("sha256").update(`${scope}:${ip}`).digest("hex");
  const sql = db();
  if (!sql) return memory.consume(key, limit, windowMs);
  await ensureSchema();
  const rows = await sql<{ count: number }[]>`
    INSERT INTO rate_limits (key, count, expires_at)
    VALUES (${key}, 1, NOW() + ${windowMs} * INTERVAL '1 millisecond')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.expires_at <= NOW() THEN 1 ELSE LEAST(rate_limits.count + 1, ${limit + 1}) END,
      expires_at = CASE WHEN rate_limits.expires_at <= NOW() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END
    RETURNING count`;
  return rows[0].count <= limit;
}
