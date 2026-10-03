import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import type { LocalState } from "@/lib/domain/models";
import { captureNews, getNewsCandidates } from "@/lib/server/news";
import { news } from "./fixtures";

const local = vi.hoisted(() => ({ state: {} as LocalState }));
vi.mock("@/lib/server/database", () => ({
  db: () => null,
  ensureSchema: async () => {},
  getSetting: async () => null,
  setSetting: vi.fn(),
}));
vi.mock("@/lib/server/local-state", () => ({
  readLocalState: () => structuredClone(local.state),
  updateLocalState: (mutate: (state: LocalState) => unknown) => mutate(local.state),
}));
vi.mock("@/lib/server/news-crawler", () => ({ crawlSources: [], crawlNews: vi.fn() }));

beforeEach(() => {
  local.state = {
    sources: { CNN: false, "BBC News": false, "Globo / g1": false },
    eventOverrides: {},
    news: {},
    users: {},
  };
  vi.stubEnv("NODE_ENV", "test");
});

it("shares discovery work and preserves changes made while providers respond", async () => {
  const url = "https://example.org/flood-brazil";
  const id = createHash("sha256").update(url).digest("hex").slice(0, 24);
  const date = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const fetcher = vi.fn(async () => {
    // This represents a separate admin action after capture took its initial snapshot.
    local.state.sources.USGS = false;
    local.state.news[id] = news({ id, url, status: "blocked" });
    local.state.userSecret = "created-during-discovery";
    return Response.json({
      articles: [{ url, title: "Enchente interrompe rodovias no Brasil", seendate: date }],
    });
  });
  vi.stubGlobal("fetch", fetcher);
  try {
    const first = captureNews(true),
      second = captureNews(true);
    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(local.state.news[id].status).toBe("blocked");
    expect(local.state.sources.USGS).toBe(false);
    expect(local.state.userSecret).toBe("created-during-discovery");
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});

it("reading the review panel does not mutate publication state", async () => {
  local.state.news.test = news({ id: "test" });
  const snapshot = structuredClone(local.state);
  await getNewsCandidates();
  expect(local.state).toEqual(snapshot);
});
