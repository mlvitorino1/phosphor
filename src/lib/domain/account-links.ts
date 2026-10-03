const tokenPattern = /^[a-f0-9]{64}$/;
export type AccountAction = "redefinir" | "verificar";

/** URL fragments stay in the browser; recovery tokens must not enter HTTP URLs. */
export function accountLinkPath(action: AccountAction, token: string): string {
  if (!tokenPattern.test(token)) throw new Error("Token de conta inválido");
  return `/mapa?entrar=1#${action}=${token}`;
}

export function readAccountTokens(fragment: string) {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const read = (key: AccountAction) => {
    const values = params.getAll(key);
    return values.length === 1 && tokenPattern.test(values[0]) ? values[0] : "";
  };
  return { resetToken: read("redefinir"), verifyToken: read("verificar") };
}

/** Migrate old links without serializing their tokens into page props. */
export function legacyAccountPath(params: { redefinir?: string; verificar?: string }) {
  for (const action of ["redefinir", "verificar"] as const) {
    const token = params[action];
    if (typeof token === "string" && tokenPattern.test(token))
      return accountLinkPath(action, token);
  }
  return "/mapa?entrar=1";
}
