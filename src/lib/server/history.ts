import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { HistoricalArchive, HistoricalIndex } from "@/lib/domain/history-models";
export type {
  HistoricalRecord,
  HistoricalArchive,
  HistoricalIndex,
} from "@/lib/domain/history-models";
const directory = join(process.cwd(), "public", "history");

export async function getHistoricalIndex(): Promise<HistoricalIndex[]> {
  try {
    return JSON.parse(await readFile(join(directory, "index.json"), "utf8"));
  } catch {
    return [];
  }
}
export async function getHistoricalArchive(key: string): Promise<HistoricalArchive | null> {
  if (!/^\d{4}(?:\d{2})?(?:\d{2})?(?:-[A-Z]{2})?$/.test(key)) return null;
  try {
    return JSON.parse(await readFile(join(directory, `${key}.json`), "utf8"));
  } catch {
    return null;
  }
}
