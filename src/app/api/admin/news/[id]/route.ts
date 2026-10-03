import { readJsonBody } from "@/lib/server/request-body";
import { withApiErrors } from "@/lib/server/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/server/auth";
import { reviewNews } from "@/lib/server/news";
import { dispatchNewsAlerts } from "@/lib/server/alerts";
import { z } from "zod";

const schema = z
  .object({
    status: z.enum(["pending", "approved", "rejected", "blocked", "deleted"]),
    category: z
      .enum([
        "earthquake",
        "storm",
        "flood",
        "wildfire",
        "volcano",
        "landslide",
        "tsunami",
        "health",
        "civil",
        "other",
      ])
      .optional(),
    impact: z.enum(["low", "moderate", "high", "critical"]).optional(),
    location: z.string().trim().min(2).max(160).optional(),
    region: z
      .enum(["North America", "South America", "Europe", "Asia", "Africa", "Oceania", "Antarctica"])
      .optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    geoPrecision: z.enum(["point", "country"]).optional(),
    summary: z.string().trim().min(20).max(1200).optional(),
    verifiedLevel: z.number().int().min(0).max(5).nullable().optional(),
    verificationUrl: z.union([z.url().startsWith("https://"), z.literal("")]).optional(),
  })
  .strict();
export const PATCH = withApiErrors(async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sameOrigin()) || !(await isAdmin()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const parsed = await readJsonBody(request, schema, 16384);
  if (!parsed.ok) return parsed.response;
  const review = parsed.data;
  if (
    review.status === "approved" &&
    (!review.category ||
      !review.impact ||
      !review.location ||
      !review.region ||
      !review.summary ||
      review.lat === undefined ||
      review.lng === undefined)
  )
    return NextResponse.json(
      { error: "Informe tema, região, contexto e coordenadas antes de publicar" },
      { status: 400 },
    );
  const { id } = await params;
  const item = await reviewNews(id, review);
  if (item?.status === "approved")
    await dispatchNewsAlerts(request.nextUrl.origin).catch((error) =>
      logFailure("Falha nos alertas após aprovação", error),
    );
  return NextResponse.json(
    item ? { ok: true, item } : { error: "Notícia indisponível ou revisão incompleta" },
    { status: item ? 200 : 422 },
  );
});
import { logFailure } from "@/lib/server/safe-log";
