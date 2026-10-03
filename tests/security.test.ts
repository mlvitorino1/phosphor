import { describe, expect, it } from "vitest";
import {
  equalSecrets,
  matchesOrigin,
  passwordHash,
  signSession,
  validExpiry,
} from "@/lib/server/security";

describe("credentials and sessions", () => {
  it("derives a verifiable password hash with a unique salt", async () => {
    const hash = await passwordHash("correct-password", "test-salt");
    expect(hash).toHaveLength(128);
    expect(equalSecrets(await passwordHash("correct-password", "test-salt"), hash)).toBe(true);
    expect(equalSecrets(await passwordHash("wrong-password", "test-salt"), hash)).toBe(false);
    expect(await passwordHash("correct-password", "other-salt")).not.toBe(hash);
  });
  it("does not treat missing credentials as a match", () => {
    expect(equalSecrets("", "")).toBe(false);
    expect(equalSecrets("a", "ab")).toBe(false);
  });
  it("binds sessions to the current password credential", () => {
    const key = "s".repeat(32);
    expect(signSession("user.123", key, "old-hash")).not.toBe(
      signSession("user.123", key, "new-hash"),
    );
    expect(() => signSession("user.123", "", "hash")).toThrow();
  });
  it("rejects expired, malformed and unexpectedly long sessions", () => {
    const now = 1_000_000;
    expect(validExpiry("1010", 20, now)).toBe(true);
    for (const value of ["1000", "999", "1021", "Infinity", "1010x", "", "1e3"])
      expect(validExpiry(value, 20, now)).toBe(false);
  });
  it("compares the complete origin, including protocol and port", () => {
    expect(matchesOrigin("http://localhost:3000", "http://localhost:3000")).toBe(true);
    for (const origin of [
      null,
      "null",
      "https://localhost:3000",
      "http://localhost:3001",
      "https://evil.example",
      "https://user@localhost:3000",
    ])
      expect(matchesOrigin(origin, "http://localhost:3000")).toBe(false);
  });
});
