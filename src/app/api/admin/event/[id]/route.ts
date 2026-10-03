import { readJsonBody } from "@/lib/server/request-body";
import { withApiErrors } from "@/lib/server/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/server/auth";
import { updateEvent } from "@/lib/server/store";
import { z } from "zod";

const schema = z
  .object({
    hidden: z.boolean().optional(),
    impact: z.enum(["low", "moderate", "high", "critical"]).nullable().optional(),
    status: z
      .enum(["detected", "active", "monitoring", "stabilizing", "closed"])
      .nullable()
      .optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    location: z.string().trim().min(1).max(160).optional(),
    verifiedLevel: z.number().int().min(0).max(5).nullable().optional(),
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
  const { id } = await params;
  try {
    return NextResponse.json({ ok: await updateEvent(id, parsed.data) });
  } catch (error) {
    logFailure("Erro administrativo", error);
    return NextResponse.json({ error: "Não foi possível salvar" }, { status: 500 });
  }
});
import { logFailure } from "@/lib/server/safe-log";
