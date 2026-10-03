import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalStore } from "@/lib/server/local-state";

let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "phosphor-test-"));
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
describe("isolated development storage", () => {
  it("writes complete JSON atomically without leaving temporary files", () => {
    const store = createLocalStore(directory);
    store.update((state) => {
      state.sources.USGS = false;
    });
    expect(store.read().sources.USGS).toBe(false);
    expect(JSON.parse(readFileSync(join(directory, "local-state.json"), "utf8"))).toHaveProperty(
      "sources.USGS",
      false,
    );
    expect(readdirSync(directory)).toEqual(["local-state.json"]);
  });
  it("rereads the latest state before each update", () => {
    const store = createLocalStore(directory);
    store.update((state) => {
      state.sources.USGS = false;
    });
    store.update((state) => {
      state.sources.GDELT = false;
    });
    expect(store.read().sources).toEqual({ USGS: false, GDELT: false });
  });
  it("reports corruption instead of silently erasing it", () => {
    writeFileSync(join(directory, "local-state.json"), "broken");
    expect(() => createLocalStore(directory).read()).toThrow("armazenamento local");
    expect(readFileSync(join(directory, "local-state.json"), "utf8")).toBe("broken");
  });
  it("does not read or write local private data in production", () => {
    const store = createLocalStore(directory);
    store.update((state) => {
      state.userSecret = "private-test-data";
    });
    vi.stubEnv("NODE_ENV", "production");
    expect(store.read().userSecret).toBeUndefined();
    expect(() => store.update(() => {})).toThrow("produção");
  });
});
