import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { readLocalState, updateLocalState } from "./local-state";
import { equalSecrets, matchesOrigin, passwordHash, signSession, validExpiry } from "./security";

const COOKIE_NAME = "gem_admin";
const SESSION_SECONDS = 12 * 60 * 60;

function credentials() {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  if (
    password.length >= 12 &&
    password.length <= 256 &&
    secret.length >= 32 &&
    process.env.DATABASE_URL
  )
    return { password, secret, hash: "", salt: "" };
  if (process.env.NODE_ENV === "production") return null;
  const local = readLocalState().admin;
  return local ? { ...local, password: "" } : null;
}

export function adminConfigured() {
  return Boolean(credentials());
}

export async function passwordMatches(candidate: string): Promise<boolean> {
  const auth = credentials();
  if (!auth || !candidate || candidate.length > 256) return false;
  // Compare the submitted password, including when the account is configured through env.
  if (auth.password) return equalSecrets(candidate, auth.password);
  return equalSecrets(await passwordHash(candidate, auth.salt), auth.hash);
}

export async function setupLocalAdmin(password: string) {
  if (
    process.env.NODE_ENV === "production" ||
    adminConfigured() ||
    password.length < 12 ||
    password.length > 256
  )
    return false;
  const salt = randomBytes(16).toString("hex");
  const hash = await passwordHash(password, salt);
  return updateLocalState((state) => {
    // Check again after hashing: simultaneous setup requests must not replace each other.
    if (state.admin) return false;
    state.admin = { salt, hash, secret: randomBytes(32).toString("hex") };
    return true;
  });
}

export async function setAdminCookie() {
  const auth = credentials();
  if (!auth) throw new Error("Administração não configurada");
  const payload = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  (await cookies()).set(
    COOKIE_NAME,
    `${payload}.${signSession(payload, auth.secret, auth.password || auth.hash)}`,
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_SECONDS,
    },
  );
}

export async function clearAdminCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function isAdmin() {
  const auth = credentials();
  if (!auth) return false;
  const parts = ((await cookies()).get(COOKIE_NAME)?.value ?? "").split(".");
  if (parts.length !== 2 || !validExpiry(parts[0], SESSION_SECONDS)) return false;
  return equalSecrets(parts[1], signSession(parts[0], auth.secret, auth.password || auth.hash));
}

export async function sameOrigin() {
  const h = await headers();
  const host = h.get("host");
  if (!host) return false;
  const protocol =
    h.get("x-forwarded-proto")?.split(",")[0] ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const expected =
    process.env.NODE_ENV === "production" && process.env.PUBLIC_APP_URL
      ? process.env.PUBLIC_APP_URL
      : `${protocol}://${host}`;
  return matchesOrigin(h.get("origin"), expected);
}
