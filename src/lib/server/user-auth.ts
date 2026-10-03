import { UserInputError } from "@/lib/domain/errors";
import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { equalSecrets, passwordHash, signSession, validExpiry } from "./security";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/lib/server/database";
import { readLocalState, writeLocalState, type UserAccount } from "@/lib/server/local-state";
import { emailConfigured, sendEmail } from "@/lib/server/email";
import { accountLinkPath } from "@/lib/domain/account-links";

const COOKIE = "gem_user";
const SESSION_SECONDS = 14 * 86400;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
import { defaultAlertPrefs, type PublicUser, type AlertPrefs } from "@/lib/domain/accounts";
export type { PublicUser, AlertPrefs } from "@/lib/domain/accounts";
export function emailLinkOrigin(requestOrigin: string) {
  if (process.env.NODE_ENV !== "production") return requestOrigin;
  const value = process.env.PUBLIC_APP_URL;
  if (!value) throw new Error("Configure PUBLIC_APP_URL para links de e-mail");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("PUBLIC_APP_URL deve ser uma origem HTTPS");
  return url.origin;
}
const publicUser = (user: UserAccount): PublicUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  emailVerified: Boolean(user.emailVerified),
});
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizedEmail = (value: string) => value.trim().toLowerCase();
const configured = () =>
  process.env.NODE_ENV !== "production" ||
  Boolean(db() && (process.env.USER_SESSION_SECRET?.length ?? 0) >= 32);
function secret() {
  return (
    process.env.USER_SESSION_SECRET ||
    (process.env.NODE_ENV !== "production" ? readLocalState().userSecret : "") ||
    ""
  );
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  email_verified: boolean;
  reset_hash: string | null;
  reset_expires_at: Date | null;
  verify_hash: string | null;
  verify_expires_at: Date | null;
  alert_prefs: AlertPrefs | null;
  created_at: Date;
};
function userFromRow(row: UserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    salt: row.salt,
    hash: row.hash,
    createdAt: row.created_at.toISOString(),
    emailVerified: row.email_verified,
    resetHash: row.reset_hash ?? undefined,
    resetExpiresAt: row.reset_expires_at?.toISOString(),
    verifyHash: row.verify_hash ?? undefined,
    verifyExpiresAt: row.verify_expires_at?.toISOString(),
    alertPrefs: row.alert_prefs ?? undefined,
  };
}

async function findUser(email: string): Promise<UserAccount | null> {
  const sql = db();
  if (!sql) return readLocalState().users?.[email] ?? null;
  await ensureSchema();
  const rows = await sql<UserRow[]>`
    SELECT * FROM app_users WHERE email = ${email} LIMIT 1`;
  return rows[0] ? userFromRow(rows[0]) : null;
}
async function findById(id: string): Promise<UserAccount | null> {
  const sql = db();
  if (!sql)
    return Object.values(readLocalState().users ?? {}).find((user) => user.id === id) ?? null;
  await ensureSchema();
  const rows = await sql<UserRow[]>`SELECT * FROM app_users WHERE id = ${id} LIMIT 1`;
  return rows[0] ? userFromRow(rows[0]) : null;
}
export async function registerUser(rawEmail: string, password: string, rawName: string) {
  const email = normalizedEmail(rawEmail),
    name = rawName.trim().replace(/\s+/g, " ");
  if (!configured()) throw new Error("Contas indisponíveis: configure banco e segredo de sessão");
  if (
    email.length > 254 ||
    !emailPattern.test(email) ||
    name.length < 2 ||
    name.length > 80 ||
    password.length < 12 ||
    password.length > 256
  )
    throw new UserInputError("Informe nome, e-mail válido e senha de 12 a 256 caracteres");
  const salt = randomBytes(16).toString("hex");
  const account: UserAccount = {
    id: randomUUID(),
    email,
    name,
    salt,
    hash: await passwordHash(password, salt),
    createdAt: new Date().toISOString(),
    emailVerified: false,
  };
  const sql = db();
  if (sql) {
    await ensureSchema();
    const inserted =
      await sql`INSERT INTO app_users (id,email,name,salt,hash) VALUES (${account.id},${email},${name},${salt},${account.hash}) ON CONFLICT (email) DO NOTHING RETURNING id`;
    if (!inserted.length) throw new UserInputError("Este e-mail já possui acesso");
  } else {
    const state = readLocalState();
    state.users ??= {};
    if (state.users[email]) throw new UserInputError("Este e-mail já possui acesso");
    state.userSecret ||= randomBytes(32).toString("hex");
    state.users[email] = account;
    writeLocalState(state);
  }
  return publicUser(account);
}
export async function authenticateUser(
  rawEmail: string,
  password: string,
): Promise<PublicUser | null> {
  if (!configured() || password.length > 256) return null;
  const user = await findUser(normalizedEmail(rawEmail));
  if (!user) {
    await passwordHash(password, "phosphor-unknown-account");
    return null;
  }
  return equalSecrets(await passwordHash(password, user.salt), user.hash) ? publicUser(user) : null;
}
export async function setUserCookie(user: PublicUser) {
  const account = await findById(user.id);
  if (!account || secret().length < 32) throw new Error("Segredo de sessão indisponível");
  const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const value = `${user.id}.${expiry}`;
  (await cookies()).set(COOKIE, `${value}.${signSession(value, secret(), account.hash)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}
export async function clearUserCookie() {
  (await cookies()).delete(COOKIE);
}
export async function currentUser(): Promise<PublicUser | null> {
  if (!configured() || secret().length < 32) return null;
  const token = (await cookies()).get(COOKIE)?.value ?? "";
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [id, expiry, signature] = parts;
  if (!id || !validExpiry(expiry, SESSION_SECONDS)) return null;
  const user = await findById(id);
  if (!user || !equalSecrets(signature, signSession(`${id}.${expiry}`, secret(), user.hash)))
    return null;
  return publicUser(user);
}
export async function createResetLink(rawEmail: string, origin: string) {
  if (!emailConfigured()) throw new Error("Recuperação por e-mail ainda não configurada");
  const user = await findUser(normalizedEmail(rawEmail));
  if (!user) return;
  const token = randomBytes(32).toString("hex"),
    hash = digest(token),
    expires = new Date(Date.now() + 30 * 60000);
  const sql = db();
  if (sql) {
    await ensureSchema();
    await sql`UPDATE app_users SET reset_hash = ${hash}, reset_expires_at = ${expires} WHERE id = ${user.id}`;
  } else {
    const state = readLocalState();
    const account = state.users?.[user.email];
    if (!account) return;
    account.resetHash = hash;
    account.resetExpiresAt = expires.toISOString();
    writeLocalState(state);
  }
  const link = `${origin}${accountLinkPath("redefinir", token)}`;
  await sendEmail(
    user.email,
    "Redefinir senha · Phosphor",
    `Recebemos um pedido para redefinir sua senha. Abra este link em até 30 minutos:\n\n${link}\n\nSe não foi você, ignore esta mensagem.`,
  );
}
export async function resetUserPassword(token: string, password: string) {
  if (!/^[a-f0-9]{64}$/.test(token) || password.length < 12 || password.length > 256) return false;
  const hash = digest(token),
    salt = randomBytes(16).toString("hex"),
    newHash = await passwordHash(password, salt);
  const sql = db();
  if (sql) {
    await ensureSchema();
    const rows =
      await sql`UPDATE app_users SET salt = ${salt}, hash = ${newHash}, reset_hash = NULL, reset_expires_at = NULL WHERE reset_hash = ${hash} AND reset_expires_at > NOW() RETURNING id`;
    return rows.length > 0;
  }
  if (process.env.NODE_ENV === "production") return false;
  const state = readLocalState();
  const user = Object.values(state.users ?? {}).find(
    (value) => value.resetHash === hash && Date.parse(value.resetExpiresAt ?? "") > Date.now(),
  );
  if (!user) return false;
  user.salt = salt;
  user.hash = newHash;
  user.resetHash = undefined;
  user.resetExpiresAt = undefined;
  writeLocalState(state);
  return true;
}
export async function requestEmailVerification(userId: string, origin: string) {
  if (!emailConfigured()) throw new Error("Envio de e-mail não configurado");
  const user = await findById(userId);
  if (!user || user.emailVerified) return;
  const token = randomBytes(32).toString("hex"),
    hash = digest(token),
    expires = new Date(Date.now() + 24 * 3600000);
  const sql = db();
  if (sql) {
    await ensureSchema();
    await sql`UPDATE app_users SET verify_hash = ${hash}, verify_expires_at = ${expires} WHERE id = ${userId}`;
  } else {
    const state = readLocalState();
    const account = state.users?.[user.email];
    if (!account) return;
    account.verifyHash = hash;
    account.verifyExpiresAt = expires.toISOString();
    writeLocalState(state);
  }
  await sendEmail(
    user.email,
    "Confirme seu e-mail · Phosphor",
    `Confirme seu e-mail para ativar alertas:\n\n${origin}${accountLinkPath("verificar", token)}\n\nEste link expira em 24 horas.`,
  );
}
export async function verifyUserEmail(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const hash = digest(token),
    sql = db();
  if (sql) {
    await ensureSchema();
    const rows =
      await sql`UPDATE app_users SET email_verified = TRUE, verify_hash = NULL, verify_expires_at = NULL WHERE verify_hash = ${hash} AND verify_expires_at > NOW() RETURNING id`;
    return rows.length > 0;
  }
  if (process.env.NODE_ENV === "production") return false;
  const state = readLocalState();
  const user = Object.values(state.users ?? {}).find(
    (value) => value.verifyHash === hash && Date.parse(value.verifyExpiresAt ?? "") > Date.now(),
  );
  if (!user) return false;
  user.emailVerified = true;
  user.verifyHash = undefined;
  user.verifyExpiresAt = undefined;
  writeLocalState(state);
  return true;
}
export async function getAlertPrefs(userId: string): Promise<AlertPrefs> {
  return { ...defaultAlertPrefs, ...(await findById(userId))?.alertPrefs };
}
export async function setAlertPrefs(userId: string, prefs: AlertPrefs) {
  const user = await findById(userId);
  if (!user || (prefs.enabled && !user.emailVerified))
    throw new UserInputError("Confirme seu e-mail antes de ativar alertas");
  const safe = {
    enabled: Boolean(prefs.enabled),
    minRisk: [45, 60, 75].includes(prefs.minRisk) ? prefs.minRisk : 60,
    supplyChainOnly: Boolean(prefs.supplyChainOnly),
    latamOnly: Boolean(prefs.latamOnly),
  };
  const sql = db();
  if (sql) {
    await ensureSchema();
    await sql`UPDATE app_users SET alert_prefs = ${sql.json(safe)} WHERE id = ${userId}`;
  } else {
    if (process.env.NODE_ENV === "production") throw new Error("Armazenamento indisponível");
    const state = readLocalState();
    const account = state.users?.[user.email];
    if (!account) throw new UserInputError("Conta não encontrada");
    account.alertPrefs = safe;
    writeLocalState(state);
  }
  return safe;
}
export async function alertSubscribers(): Promise<UserAccount[]> {
  const sql = db();
  if (!sql)
    return Object.values(readLocalState().users ?? {}).filter(
      (user) => user.emailVerified && user.alertPrefs?.enabled,
    );
  await ensureSchema();
  const rows = await sql<
    UserRow[]
  >`SELECT * FROM app_users WHERE email_verified = TRUE AND alert_prefs->>'enabled' = 'true'`;
  return rows.map(userFromRow);
}
