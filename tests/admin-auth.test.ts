import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminConfigured, isAdmin, passwordMatches } from "@/lib/server/auth";

const mocks = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: mocks.token }) }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/server/local-state", () => ({
  readLocalState: () => ({ sources: {}, news: {}, eventOverrides: {} }),
  updateLocalState: vi.fn(),
}));

describe("administrator regression", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_PASSWORD", "strong-admin-password");
    vi.stubEnv("ADMIN_SESSION_SECRET", "s".repeat(32));
    vi.stubEnv("DATABASE_URL", "postgresql://unused:test@localhost/unused");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.token = "";
  });
  it("accepts only the configured password (previously any password matched)", async () => {
    expect(adminConfigured()).toBe(true);
    expect(await passwordMatches("strong-admin-password")).toBe(true);
    expect(await passwordMatches("incorrect-password")).toBe(false);
    expect(await passwordMatches("")).toBe(false);
  });
  it("fails closed when production configuration is incomplete", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_SESSION_SECRET", "short");
    expect(adminConfigured()).toBe(false);
    expect(await passwordMatches("strong-admin-password")).toBe(false);
    expect(await isAdmin()).toBe(false);
  });
  it("rejects appended token segments", async () => {
    mocks.token = `${Math.floor(Date.now() / 1000) + 100}.signature.extra`;
    expect(await isAdmin()).toBe(false);
  });
});
