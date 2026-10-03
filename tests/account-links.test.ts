import { expect, it } from "vitest";
import { accountLinkPath, legacyAccountPath, readAccountTokens } from "@/lib/domain/account-links";

it("keeps account tokens out of the HTTP path and query", () => {
  const token = "a".repeat(64);
  for (const action of ["redefinir", "verificar"] as const) {
    const url = new URL(accountLinkPath(action, token), "https://example.org");
    expect(`${url.pathname}${url.search}`).toBe("/mapa?entrar=1");
    expect(`${url.pathname}${url.search}`).not.toContain(token);
    expect(readAccountTokens(url.hash)).toEqual({
      resetToken: action === "redefinir" ? token : "",
      verifyToken: action === "verificar" ? token : "",
    });
  }
});

it("rejects malformed or duplicate tokens and migrates old links", () => {
  const token = "a".repeat(64);
  expect(readAccountTokens(`#redefinir=${token}&redefinir=${token}`).resetToken).toBe("");
  expect(readAccountTokens("#verificar=invalid").verifyToken).toBe("");
  expect(() => accountLinkPath("redefinir", "invalid")).toThrow();
  expect(legacyAccountPath({ redefinir: token })).toBe(accountLinkPath("redefinir", token));
  expect(legacyAccountPath({ redefinir: "invalid" })).toBe("/mapa?entrar=1");
});
