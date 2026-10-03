import "server-only";
import { createHash, createHmac, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);

/** Async scrypt keeps password derivation off the request event loop. */
export async function passwordHash(password: string, salt: string): Promise<string> {
  return ((await deriveKey(password, salt, 64)) as Buffer).toString("hex");
}

export function equalSecrets(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

export function validBearer(header: string | null, secret: string | undefined): boolean {
  return Boolean(
    secret && secret.length >= 32 && header && equalSecrets(header, `Bearer ${secret}`),
  );
}

/** Binding a session to the password hash revokes it after a password reset. */
export function signSession(payload: string, secret: string, credential: string): string {
  if (secret.length < 32) throw new Error("O segredo de sessão deve ter pelo menos 32 caracteres");
  return createHmac("sha256", secret).update(`${credential}:${payload}`).digest("hex");
}

export function validExpiry(value: string, lifetimeSeconds: number, now = Date.now()): boolean {
  if (!/^\d{1,12}$/.test(value)) return false;
  const expires = Number(value),
    current = Math.floor(now / 1000);
  return expires > current && expires <= current + lifetimeSeconds;
}

export function matchesOrigin(origin: string | null, expected: string): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return !parsed.username && !parsed.password && parsed.origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
