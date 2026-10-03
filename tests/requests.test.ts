import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/lib/server/rate-limit";
import { readJsonBody } from "@/lib/server/request-body";
import { loginSchema } from "@/lib/domain/account-validation";

describe("request boundaries", () => {
  const request = (body: string, type = "application/json") =>
    new Request("http://localhost:3000", {
      method: "POST",
      body,
      headers: { "Content-Type": type },
    });
  it("validates credentials without coercing arrays or objects into strings", async () => {
    const valid = await readJsonBody(
      request(JSON.stringify({ email: "test@example.org", password: "secret" })),
      loginSchema,
    );
    expect(valid.ok).toBe(true);
    const invalid = await readJsonBody(
      request(JSON.stringify({ email: {}, password: [] })),
      loginSchema,
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.response.status).toBe(400);
  });
  it("returns predictable errors for malformed, oversized and non-JSON bodies", async () => {
    for (const [body, type, size, status] of [
      ["{", "application/json", 16384, 400],
      ["x".repeat(100), "application/json", 10, 413],
      ["{}", "text/plain", 16384, 415],
    ] as const) {
      const result = await readJsonBody(request(body, type), loginSchema, size);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.response.status).toBe(status);
    }
  });
  it("does not extend the rate-limit window on every rejected request", () => {
    const limiter = new MemoryRateLimiter();
    expect(limiter.consume("login", 2, 1000, 100)).toBe(true);
    expect(limiter.consume("login", 2, 1000, 200)).toBe(true);
    expect(limiter.consume("login", 2, 1000, 300)).toBe(false);
    expect(limiter.consume("login", 2, 1000, 1100)).toBe(true);
  });
  it("bounds memory without evicting live limits", () => {
    const limiter = new MemoryRateLimiter(1);
    expect(limiter.consume("a", 1, 1000, 100)).toBe(true);
    expect(limiter.consume("b", 1, 1000, 200)).toBe(false);
    expect(limiter.consume("a", 1, 1000, 300)).toBe(false);
    expect(limiter.consume("b", 1, 1000, 1100)).toBe(true);
  });
});
