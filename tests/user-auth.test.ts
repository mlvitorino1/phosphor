import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LocalState } from "@/lib/domain/models";
import {
  authenticateUser,
  currentUser,
  registerUser,
  resetUserPassword,
  setUserCookie,
} from "@/lib/server/user-auth";

const local = vi.hoisted(() => ({ state: {} as LocalState, token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => ({ value: local.token }),
    set: (_name: string, value: string) => {
      local.token = value;
    },
    delete: () => {
      local.token = "";
    },
  }),
}));
vi.mock("@/lib/server/database", () => ({ db: () => null, ensureSchema: vi.fn() }));
vi.mock("@/lib/server/local-state", () => ({
  readLocalState: () => structuredClone(local.state),
  writeLocalState: (state: LocalState) => {
    local.state = state;
  },
}));
vi.mock("@/lib/server/email", () => ({ emailConfigured: () => false, sendEmail: vi.fn() }));
beforeEach(() => {
  local.state = { sources: {}, eventOverrides: {}, news: {}, users: {} };
  local.token = "";
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("USER_SESSION_SECRET", "");
});
afterEach(() => vi.unstubAllEnvs());

it("registers, authenticates and returns only the public account fields", async () => {
  const user = await registerUser("  TEST@example.org ", "strong-user-password", "Test User");
  expect(user.email).toBe("test@example.org");
  expect(user).not.toHaveProperty("hash");
  expect(user).not.toHaveProperty("salt");
  expect(await authenticateUser(user.email, "incorrect-password")).toBeNull();
  await setUserCookie(user);
  expect(await currentUser()).toEqual(user);
});

it("revokes an existing cookie when a one-use reset changes the password", async () => {
  const user = await registerUser("test@example.org", "original-password", "Test User");
  await setUserCookie(user);
  const token = "a".repeat(64);
  const account = local.state.users![user.email];
  account.resetHash = createHash("sha256").update(token).digest("hex");
  account.resetExpiresAt = new Date(Date.now() + 60_000).toISOString();
  expect(await resetUserPassword(token, "replacement-password")).toBe(true);
  expect(await currentUser()).toBeNull();
  expect(await resetUserPassword(token, "another-password")).toBe(false);
  expect(await authenticateUser(user.email, "original-password")).toBeNull();
  expect(await authenticateUser(user.email, "replacement-password")).toEqual(user);
});

it("fails closed when a session secret is shortened after login", async () => {
  const user = await registerUser("test@example.org", "strong-user-password", "Test User");
  await setUserCookie(user);
  vi.stubEnv("USER_SESSION_SECRET", "short");
  expect(await currentUser()).toBeNull();
});
