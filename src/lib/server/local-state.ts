import "server-only";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import type { LocalState } from "@/lib/domain/models";
export type { LocalState, NewsCandidate, NewsStatus, UserAccount } from "@/lib/domain/models";

const schema = z.object({
  sources: z.record(z.string(), z.boolean()).default({}),
  eventOverrides: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  news: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  users: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  admin: z.object({ salt: z.string(), hash: z.string(), secret: z.string().min(32) }).optional(),
  userSecret: z.string().optional(),
  alertDeliveries: z.record(z.string(), z.string()).default({}),
  newsLastAttempt: z.string().optional(),
  newsLastError: z.string().optional(),
});
const emptyState = (): LocalState => ({
  sources: {},
  eventOverrides: {},
  news: {},
  users: {},
  alertDeliveries: {},
});

/** Development adapter for a single Node process. Production uses PostgreSQL. */
export function createLocalStore(directory: string) {
  const file = join(directory, "local-state.json");
  function read(): LocalState {
    if (process.env.NODE_ENV === "production" || !existsSync(file)) return emptyState();
    try {
      return schema.parse(JSON.parse(readFileSync(file, "utf8"))) as LocalState;
    } catch (cause) {
      throw new Error("Não foi possível ler o armazenamento local", { cause });
    }
  }
  function write(state: LocalState) {
    if (process.env.NODE_ENV === "production")
      throw new Error("Armazenamento local indisponível em produção");
    mkdirSync(directory, { recursive: true });
    const temporary = join(directory, `.local-state-${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
      // Readers see either the previous complete file or the new complete file.
      renameSync(temporary, file);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  function update<T>(mutate: (state: LocalState) => T): T {
    const current = read();
    const result = mutate(current);
    if (result instanceof Promise) throw new Error("A atualização local deve ser síncrona");
    write(current);
    return result;
  }
  return { read, write, update };
}

const store = createLocalStore(join(process.cwd(), "data"));
export const readLocalState = store.read;
export const writeLocalState = store.write;
export const updateLocalState = store.update;
