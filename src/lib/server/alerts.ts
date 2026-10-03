import "server-only";
import { createHash } from "node:crypto";
import { db, ensureSchema } from "@/lib/server/database";
import { readLocalState, writeLocalState, type NewsCandidate } from "@/lib/server/local-state";
import { getNewsCandidates } from "@/lib/server/news";
import { isNewsVisible } from "@/lib/domain/news-deadlines";
import { assessNews } from "@/lib/domain/news-intelligence";
import { alertSubscribers, emailLinkOrigin } from "@/lib/server/user-auth";
import { emailConfigured, sendEmail } from "@/lib/server/email";
import { logFailure } from "./safe-log";

function deliveryKey(channel: string, recipient: string, id: string) {
  return createHash("sha256").update(`${channel}:${recipient}:${id}`).digest("hex");
}
async function claim(key: string) {
  const sql = db();
  if (sql) {
    await ensureSchema();
    const rows =
      await sql`INSERT INTO alert_deliveries (key) VALUES (${key}) ON CONFLICT DO NOTHING RETURNING key`;
    return rows.length > 0;
  }
  if (process.env.NODE_ENV === "production") return false;
  const state = readLocalState();
  state.alertDeliveries ??= {};
  if (state.alertDeliveries[key]) return false;
  state.alertDeliveries[key] = new Date().toISOString();
  writeLocalState(state);
  return true;
}
async function release(key: string) {
  const sql = db();
  if (sql) {
    await sql`DELETE FROM alert_deliveries WHERE key = ${key}`;
    return;
  }
  if (process.env.NODE_ENV === "production") return;
  const state = readLocalState();
  delete state.alertDeliveries?.[key];
  writeLocalState(state);
}
async function pruneDeliveries() {
  const sql = db();
  if (sql) {
    await ensureSchema();
    await sql`DELETE FROM alert_deliveries WHERE sent_at < NOW() - INTERVAL '30 days'`;
    await sql`DELETE FROM rate_limits WHERE expires_at <= NOW()`;
    return;
  }
  if (process.env.NODE_ENV === "production") return;
  const state = readLocalState(),
    cutoff = Date.now() - 30 * 86400000;
  for (const [key, at] of Object.entries(state.alertDeliveries ?? {}))
    if (Date.parse(at) < cutoff) delete state.alertDeliveries?.[key];
  writeLocalState(state);
}
async function once(
  channel: string,
  recipient: string,
  item: NewsCandidate,
  send: () => Promise<unknown>,
) {
  const key = deliveryKey(channel, recipient, item.id);
  if (!(await claim(key))) return false;
  try {
    await send();
    return true;
  } catch (error) {
    await release(key);
    throw error;
  }
}
async function postWebhook(url: string, body: object, token?: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    throw new Error("Webhook deve usar HTTPS");
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Webhook respondeu HTTP ${response.status}`);
}
export async function dispatchNewsAlerts(origin: string) {
  await pruneDeliveries();
  if (!emailConfigured() && !process.env.SLACK_WEBHOOK_URL && !process.env.ERP_WEBHOOK_URL)
    return { evaluated: 0, sent: 0, errors: 0 };
  const publicOrigin = emailLinkOrigin(origin);
  const all = (await getNewsCandidates()).items;
  const recent = all.filter(
    (item) =>
      item.status === "approved" &&
      item.publicationMode !== "automatic" &&
      isNewsVisible(item) &&
      Date.parse(item.approvedAt ?? "") > Date.now() - 24 * 3600000,
  );
  const subscribers = emailConfigured() ? await alertSubscribers() : [];
  let sent = 0,
    errors = 0;
  for (const item of recent) {
    const assessment = assessNews(item, all);
    const link = `${publicOrigin}/evento/news-${item.id}`;
    for (const user of subscribers) {
      const prefs = user.alertPrefs!;
      if (
        assessment.riskScore < prefs.minRisk ||
        (prefs.supplyChainOnly && !assessment.supplyChain) ||
        ((prefs.latamOnly ?? true) && !assessment.latam)
      )
        continue;
      try {
        if (
          await once("email", user.id, item, () =>
            sendEmail(
              user.email,
              `Alerta de risco ${assessment.riskScore}/100 · Phosphor`,
              `${item.title}\n\n${item.summary ?? "Confira o evento revisado."}\n\nLocal: ${item.location ?? "em revisão"}\nRisco: ${assessment.riskScore}/100 · Fonte: ${assessment.sourceScore}/100\n${link}\n\nGerencie seus alertas em ${publicOrigin}/alertas`,
            ),
          )
        )
          sent++;
      } catch (error) {
        errors++;
        logFailure("Falha no alerta por e-mail", error);
      }
    }
    if (assessment.supplyChain && assessment.latam && assessment.riskScore >= 60) {
      if (process.env.SLACK_WEBHOOK_URL)
        try {
          if (
            await once("slack", "workspace", item, () =>
              postWebhook(process.env.SLACK_WEBHOOK_URL!, {
                text: `🚨 *Risco ${assessment.riskScore}/100* · ${item.title}\n${item.location ?? "Local em revisão"}\n${link}`,
              }),
            )
          )
            sent++;
        } catch (error) {
          errors++;
          logFailure("Falha no alerta Slack", error);
        }
      if (process.env.ERP_WEBHOOK_URL)
        try {
          if (
            await once("erp", "system", item, () =>
              postWebhook(
                process.env.ERP_WEBHOOK_URL!,
                {
                  type: "news_risk_alert",
                  id: item.id,
                  title: item.title,
                  summary: item.summary,
                  location: item.location,
                  region: item.region,
                  category: item.category,
                  riskScore: assessment.riskScore,
                  sourceScore: assessment.sourceScore,
                  publishedAt: item.publishedAt,
                  approvedAt: item.approvedAt,
                  url: link,
                  sourceUrl: item.url,
                },
                process.env.ERP_WEBHOOK_TOKEN,
              ),
            )
          )
            sent++;
        } catch (error) {
          errors++;
          logFailure("Falha no alerta ERP", error);
        }
    }
  }
  return { evaluated: recent.length, sent, errors };
}
