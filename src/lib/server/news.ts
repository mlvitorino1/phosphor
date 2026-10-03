import {
  newsLocated,
  newsReady,
  nextNewsStatus,
  type BatchNewsAction,
} from "@/lib/domain/news-review";
export type { BatchNewsAction } from "@/lib/domain/news-review";
import { readResponseText } from "./http";
import {
  canonicalArticleUrl,
  normalizedTitle,
  headlineSignal,
  automaticNews,
} from "@/lib/domain/news-publication";
import "server-only";
import { acquireJobLease } from "./job-lease";
import { createHash } from "node:crypto";
import type { EventRecord } from "@/lib/domain/types";
import type { Region } from "@/lib/domain/types";
import {
  readLocalState,
  updateLocalState,
  type LocalState,
  type NewsCandidate,
  type NewsStatus,
} from "@/lib/server/local-state";
import { db, ensureSchema, getSetting, setSetting } from "@/lib/server/database";
import {
  isNewsVisible,
  newsDeadlinePolicy,
  newsVisibilityDeadline,
} from "@/lib/domain/news-deadlines";
import { crawlNews, crawlSources } from "@/lib/server/news-crawler";
import { assessNews } from "@/lib/domain/news-intelligence";
import { suggestNews } from "@/lib/domain/news-suggestions";
import { newsChannelForUrl, newsChannelQuery, newsChannels } from "@/lib/domain/news-channels";

const queries = [
  {
    name: "GDELT · Emergências",
    query:
      "(tornado OR earthquake OR flood OR wildfire OR hurricane OR tsunami OR evacuation OR outbreak OR explosion OR eruption OR landslide OR drought)",
    max: 250,
  },
  {
    name: "GDELT · Cadeia de suprimentos",
    query:
      '("port closure" OR "road blockade" OR "power outage" OR "transport strike" OR "supply chain" OR refinery OR railway OR "oil spill" OR sanctions)',
    max: 250,
  },
];
const cooldown = 15 * 60_000;
type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  language?: string;
  sourcecountry?: string;
};
type IncomingArticle = {
  url?: string;
  title?: string;
  publishedAt: string;
  language?: string;
  sourceCountry?: string;
  sourcecountry?: string;
  description?: string;
  discoverySource: string;
  discoveryMethod: "gdelt" | "rss" | "section";
};
function gdeltDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) return null;
  const parsed = new Date(
    `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`,
  );
  return Number.isFinite(parsed.valueOf()) ? parsed.toISOString() : null;
}
async function getNewsState(): Promise<LocalState> {
  const sql = db();
  if (!sql) return readLocalState();
  await ensureSchema();
  const rows = await sql<
    { data: NewsCandidate }[]
  >`SELECT data FROM news_candidates ORDER BY published_at DESC`;
  const meta = (await getSetting<{ lastAttempt?: string; error?: string }>("news_capture")) ?? {};
  return {
    sources: {},
    eventOverrides: {},
    news: Object.fromEntries(rows.map((row) => [row.data.id, row.data])),
    newsLastAttempt: meta.lastAttempt,
    newsLastError: meta.error,
  };
}
export async function getNewsCandidates() {
  const state = await getNewsState();
  return {
    items: Object.values(state.news)
      .map((item) => {
        const channel = item.discoveryMethod === "gdelt" ? newsChannelForUrl(item.url) : null;
        return channel ? { ...item, discoverySource: channel.name } : item;
      })
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    lastAttempt: state.newsLastAttempt ?? null,
    error: state.newsLastError ?? null,
  };
}
export async function saveNewsAnalysis(
  id: string,
  analysis: NonNullable<NewsCandidate["aiAnalysis"]>,
) {
  const state = await getNewsState(),
    current = state.news[id];
  if (!current || current.status === "deleted" || current.status === "blocked") return null;
  const updated = { ...current, aiAnalysis: analysis };
  const sql = db();
  if (sql) {
    await ensureSchema();
    const rows = await sql<
      { data: NewsCandidate }[]
    >`UPDATE news_candidates SET data = jsonb_set(data, '{aiAnalysis}', ${sql.json(analysis)}) WHERE id = ${id} AND data->>'status' NOT IN ('blocked','deleted') RETURNING data`;
    return rows[0]?.data ?? null;
  } else if (process.env.NODE_ENV !== "production") {
    updateLocalState((latest) => {
      if (latest.news[id]) latest.news[id].aiAnalysis = analysis;
    });
  } else return null;
  return updated;
}
// A process shares one in-flight discovery job. Persisted cooldown limits subsequent requests.
let captureInFlight: ReturnType<typeof performCapture> | null = null;
export function captureNews(force = false) {
  captureInFlight ??= leasedCapture(force).finally(() => {
    captureInFlight = null;
  });
  return captureInFlight;
}
async function leasedCapture(force: boolean) {
  const lease = await acquireJobLease("news_capture");
  if (!lease) return { ...(await getNewsCandidates()), skipped: true };
  try {
    return await performCapture(force);
  } finally {
    await lease.release();
  }
}
async function performCapture(force = false) {
  const state = await getNewsState();
  const sourceFlags = db()
    ? ((await getSetting<Record<string, boolean>>("sources")) ?? {})
    : state.sources;
  const enabledChannels = newsChannels.filter((channel) => sourceFlags[channel.name] !== false);
  if (
    sourceFlags.GDELT === false &&
    !enabledChannels.length &&
    crawlSources.every((source) => sourceFlags[source.name] === false)
  )
    return { ...(await getNewsCandidates()), skipped: true };
  const elapsed = Date.now() - Date.parse(state.newsLastAttempt ?? "1970-01-01T00:00:00Z");
  if (elapsed < (force ? 60_000 : cooldown))
    return { ...(await getNewsCandidates()), skipped: true };
  state.newsLastAttempt = new Date().toISOString();
  const fresh: NewsCandidate[] = [];
  const errors: string[] = [];
  const knownTitles = new Map<string, number[]>();
  for (const item of Object.values(state.news)) {
    const key = `${item.domain}|${normalizedTitle(item.title)}`;
    knownTitles.set(key, [...(knownTitles.get(key) ?? []), Date.parse(item.publishedAt)]);
  }
  function addArticle(article: IncomingArticle) {
    const url = canonicalArticleUrl(article.url ?? "");
    const publishedAt = article.publishedAt;
    const title = typeof article.title === "string" ? article.title.trim().slice(0, 350) : "";
    if (!url || !title || !Number.isFinite(Date.parse(publishedAt))) return;
    if (article.discoveryMethod === "gdelt" && !headlineSignal.test(normalizedTitle(title))) return;
    const id = createHash("sha256").update(url).digest("hex").slice(0, 24);
    if (state.news[id]) return;
    const domain = new URL(url).hostname.replace(/^www\./, "");
    const titleKey = `${domain}|${normalizedTitle(title)}`;
    if (
      knownTitles
        .get(titleKey)
        ?.some((date) => Math.abs(date - Date.parse(publishedAt)) < 12 * 3600000)
    )
      return;
    knownTitles.set(titleKey, [...(knownTitles.get(titleKey) ?? []), Date.parse(publishedAt)]);
    state.news[id] = {
      id,
      url,
      title,
      domain,
      language: article.language ?? "",
      sourceCountry: article.sourceCountry ?? article.sourcecountry ?? "",
      publishedAt,
      capturedAt: state.newsLastAttempt!,
      status: "pending",
      discoverySource: article.discoverySource,
      discoveryMethod: article.discoveryMethod,
      description: article.description?.slice(0, 500),
    };
    fresh.push(state.news[id]);
  }
  const crawlsPromise = Promise.allSettled(
    crawlSources
      .filter((source) => sourceFlags[source.name] !== false)
      .map(async (source) => ({ source, result: await crawlNews(source) })),
  );
  const channelQuery = newsChannelQuery(enabledChannels);
  const searches = [
    ...(sourceFlags.GDELT !== false ? queries : []),
    ...(channelQuery
      ? [{ name: "GDELT · Canais", query: channelQuery, max: 250, channelsOnly: true }]
      : []),
  ];
  if (searches.length) {
    const results = await Promise.allSettled(
      searches.map(async (search) => {
        const params = new URLSearchParams({
          query: search.query,
          mode: "artlist",
          format: "json",
          timespan: "48h",
          maxrecords: String(search.max),
          sort: "datedesc",
        });
        const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(18000),
          headers: { Accept: "application/json", "User-Agent": "Phosphor/0.1 (news discovery)" },
        });
        if (!response.ok) throw new SourceRequestError(response.status);
        const data = JSON.parse(await readResponseText(response, 2_000_000)) as {
          articles?: GdeltArticle[];
        };
        if (!Array.isArray(data.articles)) throw new Error("resposta sem artigos");
        return { search, articles: data.articles };
      }),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        errors.push(`${searches[index].name}: ${sourceFailureSummary(result.reason)}`);
        return;
      }
      for (const article of result.value.articles) {
        const publishedAt = gdeltDate(article.seendate ?? "");
        const channel = newsChannelForUrl(article.url ?? "");
        if (channel && sourceFlags[channel.name] === false) continue;
        if ("channelsOnly" in result.value.search && !channel) continue;
        if (publishedAt)
          addArticle({
            ...article,
            publishedAt,
            discoverySource: channel?.name ?? result.value.search.name,
            discoveryMethod: "gdelt",
          });
      }
    });
  }
  const crawls = await crawlsPromise;
  for (const crawl of crawls) {
    if (crawl.status === "rejected") {
      errors.push(sourceFailureSummary(crawl.reason));
      continue;
    }
    const { source, result } = crawl.value;
    result.articles.forEach(addArticle);
    if (result.errors.length) errors.push(`${source.name}: ${result.errors.join("; ")}`);
  }
  state.newsLastError = errors.length ? errors.join(" | ") : undefined;
  for (const item of fresh) {
    const published = automaticNews(item, Object.values(state.news), state.newsLastAttempt!);
    if (published) {
      state.news[item.id] = published;
      Object.assign(item, published);
    }
  }
  const sql = db();
  if (sql) {
    await ensureSchema();
    for (const item of fresh)
      await sql`INSERT INTO news_candidates (id, data, published_at) VALUES (${item.id}, ${sql.json(item)}, ${item.publishedAt}) ON CONFLICT (id) DO NOTHING`;
    await setSetting("news_capture", {
      lastAttempt: state.newsLastAttempt,
      error: state.newsLastError ?? null,
    });
  } else if (process.env.NODE_ENV !== "production")
    updateLocalState((latest) => {
      // Network calls yield: reread current state and only append new articles.
      // Existing blocks, reviews, source toggles, and accounts must survive capture.
      for (const item of fresh) latest.news[item.id] ??= item;
      latest.newsLastAttempt = state.newsLastAttempt;
      latest.newsLastError = state.newsLastError;
    });
  return getNewsCandidates();
}
export type NewsReview = {
  status: NewsStatus;
  category?: EventRecord["category"];
  impact?: EventRecord["impact"];
  location?: string;
  region?: Region;
  lat?: number;
  lng?: number;
  geoPrecision?: "point" | "country";
  summary?: string;
  verifiedLevel?: number | null;
  verificationUrl?: string;
};
export async function reviewNews(id: string, review: NewsReview) {
  const state = await getNewsState(),
    current = state.news[id];
  if (!current) return null;
  if (current.status === "deleted" && review.status !== "pending") return null;
  if (current.status === "blocked" && !["pending", "deleted"].includes(review.status)) return null;
  const reviewedAt = new Date().toISOString();
  const updated: NewsCandidate = { ...current, ...review, reviewedAt };
  if (review.status === "approved") {
    const fullyReviewed = newsReady(updated);
    if (!fullyReviewed && !(current.publicationMode === "automatic" && newsLocated(updated)))
      return null;
    updated.approvedAt = reviewedAt;
    updated.expiresAt = newsDeadlinePolicy(updated, reviewedAt).expiresAt;
    updated.publicationMode = fullyReviewed ? "reviewed" : "automatic";
    updated.country = updated.country || suggestNews(updated, Object.values(state.news)).country;
    if (review.geoPrecision) updated.geoPrecision = review.geoPrecision;
  } else {
    updated.approvedAt = undefined;
    updated.expiresAt = undefined;
    if (current.status === "approved") updated.autoPublicationDisabled = true;
  }
  const sql = db();
  if (sql) {
    await ensureSchema();
    const saved =
      await sql`UPDATE news_candidates SET data = ${sql.json(updated)} WHERE id = ${id} AND data = ${sql.json(current)} RETURNING id`;
    if (!saved.length) return null;
  } else if (process.env.NODE_ENV !== "production") {
    updateLocalState((latest) => {
      latest.news[id] = updated;
    });
  } else return null;
  return updated;
}
export async function batchNewsAction(ids: string[], action: BatchNewsAction) {
  const state = await getNewsState();
  const now = new Date().toISOString();
  const changed: NewsCandidate[] = [];
  const original = new Map<string, NewsCandidate>();
  let skipped = 0;
  for (const id of new Set(ids)) {
    const current = state.news[id];
    if (!current) {
      skipped++;
      continue;
    }
    const nextStatus = nextNewsStatus(current, action);
    if (!nextStatus || nextStatus === current.status) {
      skipped++;
      continue;
    }
    const updated: NewsCandidate = { ...current, status: nextStatus, reviewedAt: now };
    if (nextStatus === "approved") {
      updated.approvedAt = now;
      updated.expiresAt = newsDeadlinePolicy(updated, now).expiresAt;
      updated.publicationMode = "reviewed";
      updated.country = updated.country || suggestNews(updated, Object.values(state.news)).country;
    } else {
      updated.approvedAt = undefined;
      updated.expiresAt = undefined;
      if (current.status === "approved" || action === "unblock" || action === "restore")
        updated.autoPublicationDisabled = true;
    }
    original.set(id, current);
    state.news[id] = updated;
    changed.push(updated);
  }
  const sql = db();
  if (sql) {
    await ensureSchema();
    if (changed.length)
      await sql.begin(async (tx) => {
        for (let i = changed.length - 1; i >= 0; i--) {
          const item = changed[i];
          const rows =
            await tx`UPDATE news_candidates SET data = ${tx.json(item)} WHERE id = ${item.id} AND data = ${tx.json(original.get(item.id)!)} RETURNING id`;
          if (!rows.length) {
            changed.splice(i, 1);
            skipped++;
          }
        }
      });
  } else if (process.env.NODE_ENV !== "production" && changed.length)
    updateLocalState((latest) => {
      for (const item of changed) latest.news[item.id] = item;
    });
  return { changed, skipped };
}
export async function approvedNewsEvents(): Promise<EventRecord[]> {
  const state = await getNewsState();
  const allNews = Object.values(state.news);
  const events = allNews
    .filter(
      (n) =>
        isNewsVisible(n) &&
        n.category &&
        n.impact &&
        n.location &&
        typeof n.lat === "number" &&
        typeof n.lng === "number" &&
        n.summary,
    )
    .map((n) => {
      const automatic = n.publicationMode === "automatic";
      const approximate = n.geoPrecision === "country";
      const assessment = assessNews(n, allNews);
      return {
        id: `news-${n.id}`,
        title: n.title,
        category: n.category!,
        kind: "report" as const,
        location: n.location!,
        country: n.country ?? "",
        region: n.region,
        lat: n.lat!,
        lng: n.lng!,
        geoType: approximate ? ("regional" as const) : ("localized" as const),
        geoPrecision: approximate ? ("country" as const) : ("point" as const),
        radiusKm: null,
        verifiedLevel: n.verifiedLevel ?? null,
        impact: n.impact!,
        status: "monitoring" as const,
        startedAt: n.publishedAt,
        updatedAt: n.reviewedAt ?? n.approvedAt ?? n.publishedAt,
        expiresAt: newsVisibilityDeadline(n),
        summary: `${n.summary!} ${automatic ? (n.reviewedAt ? "Correção manual registrada, sem confirmação independente." : "Publicação automática, ainda sem revisão humana.") : "Notícia revisada; confira as fontes."}${approximate ? " O ponto exibido é a capital do país como referência, não o local confirmado do evento." : ""}`,
        sources: [
          {
            name: `${(n.discoveryMethod === "gdelt" ? newsChannelForUrl(n.url)?.name : null) ?? n.discoverySource ?? "GDELT"} · ${n.domain}`,
            url: n.url,
            sourceId: n.id,
          },
          ...(n.verificationUrl
            ? [{ name: "Confirmação", url: n.verificationUrl, sourceId: n.id }]
            : []),
        ],
        updates: [
          {
            at: n.reviewedAt ?? n.approvedAt ?? n.publishedAt,
            text: automatic
              ? n.reviewedAt
                ? "Correção manual registrada; confirmação independente pendente."
                : "Captura e posicionamento automáticos; revisão humana pendente."
              : "Contexto e localização revisados pela equipe.",
          },
        ],
        metrics: {
          Veículo: n.domain,
          Idioma: n.language || "Não informado",
          Publicação: automatic ? "Automática" : "Revisada",
          Precisão: approximate ? "Capital como referência do país" : "Ponto informado",
          "Risco de triagem": `${assessment.riskScore}/100`,
          "Evidências da fonte": `${assessment.sourceScore}/100`,
          ...(n.verifiedLevel !== null && n.verifiedLevel !== undefined
            ? { "Nível verificado": n.verifiedLevel }
            : {}),
        },
      };
    });
  events.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const merged: EventRecord[] = [];
  for (const event of events) {
    const match = merged.find((existing) => sameReviewedNews(existing, event));
    if (!match) {
      merged.push(event);
      continue;
    }
    match.sources.push(
      ...event.sources.filter(
        (source) => !match.sources.some((current) => current.url === source.url),
      ),
    );
    match.updates.push(
      ...event.updates.filter(
        (update) =>
          !match.updates.some(
            (current) => current.at === update.at && current.text === update.text,
          ),
      ),
    );
    if (event.updatedAt > match.updatedAt) match.updatedAt = event.updatedAt;
    if (event.expiresAt && (!match.expiresAt || event.expiresAt > match.expiresAt))
      match.expiresAt = event.expiresAt;
  }
  return merged;
}

function sameReviewedNews(a: EventRecord, b: EventRecord) {
  if (
    a.category !== b.category ||
    a.region !== b.region ||
    Math.abs(Date.parse(a.startedAt) - Date.parse(b.startedAt)) > 8 * 3600000
  )
    return false;
  const rad = Math.PI / 180;
  const x = (b.lat - a.lat) * rad,
    y = (b.lng - a.lng) * rad;
  const area =
    Math.sin(x / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(y / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(area), Math.sqrt(1 - area));
  if (km > 30) return false;
  const tokens = (value: string) =>
    new Set(
      normalizedTitle(value)
        .split(" ")
        .filter(
          (word) =>
            word.length >= 4 &&
            !/^(about|after|with|from|para|sobre|apos|entre|mais|amid|that|this)$/.test(word),
        ),
    );
  const left = tokens(a.title),
    right = tokens(b.title);
  const common = [...left].filter((word) => right.has(word)).length;
  return common >= 2 && common / Math.max(left.size, right.size) >= 0.65;
}
import { SourceRequestError, sourceFailureSummary } from "./http";
