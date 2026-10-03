import { readResponseText } from "./http";
import robotsParser from "robots-parser";
import "server-only";
import { XMLParser } from "fast-xml-parser";
import { load } from "cheerio";

export type CrawledArticle = {
  url: string;
  title: string;
  publishedAt: string;
  language: string;
  sourceCountry: string;
  description?: string;
  discoverySource: string;
  discoveryMethod: "rss" | "section";
};

type CrawlSource = {
  name: string;
  country: string;
  language: string;
  host: string;
  feeds: string[];
  sections: { url: string; articlePath: RegExp }[];
};

// Each source must expose its own feed or public section page. Add more sources here after checking their terms and URL patterns.
export const crawlSources: CrawlSource[] = [
  {
    name: "Agência Brasil",
    country: "Brazil",
    language: "pt",
    host: "agenciabrasil.ebc.com.br",
    feeds: [
      "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
      "https://agenciabrasil.ebc.com.br/rss/saude/feed.xml",
      "https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml",
      "https://agenciabrasil.ebc.com.br/rss/economia/feed.xml",
      "https://agenciabrasil.ebc.com.br/rss/geral/feed.xml",
      "https://agenciabrasil.ebc.com.br/rss/politica/feed.xml",
    ],
    sections: ["ultimas", "meio-ambiente", "economia"].map((path) => ({
      url: `https://agenciabrasil.ebc.com.br/${path}`,
      articlePath: /\/noticia\/\d{4}-\d{2}\//,
    })),
  },
];

const eventTerms =
  /\b(tornado|furac[aã]o|ciclone|tempestade|enchente|inunda[cç][aã]o|terremoto|tremor|tsunami|inc[eê]ndio|queimada|deslizamento|erup[cç][aã]o|vulc[aã]o|epidemia|surto|evacua[cç][aã]o|explos[aã]o|desastre|emerg[eê]ncia|acidente|conflito|ataque|protesto|manifesta[cç][aã]o|apag[aã]o|rompimento|barragem|defesa civil|porto|portos|rodovia|ferrovia|log[ií]stica|abastecimento|greve|bloqueio|transporte|energia|safra|seca|estiagem|colheita|soja|milho|exporta[cç][aã]o|petr[oó]leo|refinaria|polui[cç][aã]o|contamina[cç][aã]o|desmatamento|san[cç][aã]o|fronteira|alf[aâ]ndega|cadeia de suprimentos)\b/i;
const xml = new XMLParser({ ignoreAttributes: false, trimValues: true, processEntities: true });
const asText = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : value && typeof value === "object"
        ? asText(
            (value as Record<string, unknown>)["#text"] ??
              (value as Record<string, unknown>)["@_href"],
          )
        : "";
const list = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

function validArticle(
  url: string,
  source: CrawlSource,
  title: string,
  publishedAt: string,
  method: CrawledArticle["discoveryMethod"],
  description = "",
): CrawledArticle | null {
  try {
    const parsed = new URL(url);
    const date = Date.parse(publishedAt);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== source.host ||
      title.length < 15 ||
      title.length > 220 ||
      /<[^>]+>|https?:\/\//i.test(title) ||
      !eventTerms.test(title) ||
      !Number.isFinite(date) ||
      date < Date.now() - 7 * 86400000 ||
      date > Date.now() + 3600000
    )
      return null;
    return {
      url: parsed.href,
      title: title.slice(0, 350),
      publishedAt: new Date(date).toISOString(),
      description: description.slice(0, 500),
      language: source.language,
      sourceCountry: source.country,
      discoverySource: source.name,
      discoveryMethod: method,
    };
  } catch {
    return null;
  }
}

async function fetchText(url: string, accept: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { Accept: accept, "User-Agent": "Phosphor/0.1 (public news discovery)" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return readResponseText(response, 2_000_000);
}

function parseFeed(body: string, source: CrawlSource) {
  const feed = xml.parse(body) as Record<string, unknown>;
  const rss = feed.rss as { channel?: { item?: unknown; language?: unknown } } | undefined;
  const atom = feed.feed as { entry?: unknown; "@_xml:lang"?: string } | undefined;
  const entries = list(rss?.channel?.item ?? atom?.entry).slice(0, 60);
  return entries.flatMap((raw) => {
    const item = raw as Record<string, unknown>;
    const title = load(asText(item.title)).text().replace(/\s+/g, " ").trim();
    const link = Array.isArray(item.link)
      ? asText(
          item.link.find(
            (value) =>
              typeof value === "object" &&
              value &&
              (value as Record<string, unknown>)["@_rel"] === "alternate",
          ) ?? item.link[0],
        )
      : asText(item.link);
    const date = asText(item.pubDate ?? item.published ?? item.updated ?? item["dc:date"]);
    const description = load(asText(item.description ?? item.summary ?? item["content:encoded"]))
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const article = validArticle(link, source, title, date, "rss", description);
    return article ? [article] : [];
  });
}

async function readRobots(source: CrawlSource) {
  const url = `https://${source.host}/robots.txt`;
  try {
    const rules = robotsParser(url, await fetchText(url, "text/plain"));
    return {
      allowed: (path: string) =>
        rules.isAllowed(`https://${source.host}${path}`, "Phosphor") === true,
      delay: Math.max(250, (rules.getCrawlDelay("Phosphor") ?? 0) * 1000),
    };
  } catch {
    return { allowed: () => false, delay: 250 };
  }
}

function parseSection(body: string, source: CrawlSource, articlePath: RegExp, sectionUrl: string) {
  const $ = load(body);
  const found: { url: string; title: string }[] = [];
  $("a[href]").each((_, element) => {
    if (found.length >= 24) return false;
    const href = $(element).attr("href") ?? "";
    let url: URL;
    try {
      url = new URL(href, sectionUrl);
    } catch {
      return;
    }
    if (!articlePath.test(url.pathname)) return;
    const title = load($(element).text()).text().replace(/\s+/g, " ").trim();
    if (url.protocol !== "https:" || url.hostname !== source.host || url.username || url.password)
      return;
    if (
      title.length >= 15 &&
      title.length <= 220 &&
      eventTerms.test(title) &&
      !found.some((current) => current.url === url.href)
    )
      found.push({ url: url.href, title });
  });
  return found;
}

async function inspectArticle(url: string, fallbackTitle: string, source: CrawlSource) {
  const body = await fetchText(url, "text/html");
  const $ = load(body);
  const title =
    $("meta[property='og:title']").attr("content") ||
    $("h1").first().text().trim() ||
    fallbackTitle;
  const published =
    $("meta[property='article:published_time']").attr("content") ||
    $("meta[name='date']").attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    "";
  const description =
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    "";
  return validArticle(url, source, title, published, "section", description);
}

export async function crawlNews(source: CrawlSource) {
  const jobs = source.feeds.map(async (url) =>
    parseFeed(
      await fetchText(url, "application/rss+xml, application/atom+xml, application/xml, text/xml"),
      source,
    ),
  );
  jobs.push(
    (async () => {
      const robots = await readRobots(source);
      // An excessive publisher delay means the supplemental HTML pass waits for another run.
      if (robots.delay > 5000) return [];
      const discovered = new Map<string, { url: string; title: string }>();
      for (const section of source.sections) {
        if (!robots.allowed(new URL(section.url).pathname)) continue;
        const found = parseSection(
          await fetchText(section.url, "text/html"),
          source,
          section.articlePath,
          section.url,
        );
        for (const article of found)
          if (robots.allowed(new URL(article.url).pathname)) discovered.set(article.url, article);
        await new Promise((resolve) => setTimeout(resolve, robots.delay));
      }
      const articles: CrawledArticle[] = [];
      // RSS is primary. At most six supplemental metadata pages are inspected sequentially.
      for (const item of [...discovered.values()].slice(0, 6)) {
        try {
          const article = await inspectArticle(item.url, item.title, source);
          if (article) articles.push(article);
        } catch {
          /* One unavailable article does not discard the rest of the source. */
        }
        await new Promise((resolve) => setTimeout(resolve, robots.delay));
      }
      return articles;
    })(),
  );
  const results = await Promise.allSettled(jobs);
  return {
    articles: results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    errors: results.flatMap((result, index) =>
      result.status === "rejected"
        ? [
            `${index < source.feeds.length ? "RSS" : "Seção"}: ${result.reason instanceof Error ? result.reason.message : "falha"}`,
          ]
        : [],
    ),
  };
}
