import { withApiErrors } from "@/lib/server/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { ingest } from "@/lib/server/store";
import { captureNews } from "@/lib/server/news";
import { dispatchNewsAlerts } from "@/lib/server/alerts";

export const dynamic = "force-dynamic";
export const GET = withApiErrors(async function GET(request: NextRequest) {
  const token = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || token !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const [events, news] = await Promise.allSettled([ingest(), captureNews()]);
  if (events.status === "rejected") console.error("Falha na ingestão:", events.reason);
  if (news.status === "rejected") console.error("Falha na captura de notícias:", news.reason);
  if (events.status === "rejected" && news.status === "rejected")
    return NextResponse.json({ error: "Falha na ingestão" }, { status: 500 });
  const alerts = await dispatchNewsAlerts(request.nextUrl.origin).catch((error) => {
    console.error("Falha no envio de alertas:", {
      type: error instanceof Error ? error.name : "Unknown",
    });
    return { evaluated: 0, sent: 0, errors: 1 };
  });
  return NextResponse.json({
    events: events.status === "fulfilled" ? events.value : null,
    news:
      news.status === "fulfilled"
        ? {
            total: news.value.items.length,
            pending: news.value.items.filter((item) => item.status === "pending").length,
            error: news.value.error,
          }
        : { error: "Falha na captura" },
    alerts,
  });
});
