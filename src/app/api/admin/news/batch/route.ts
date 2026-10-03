import { readJsonBody } from "@/lib/server/request-body";
import { withApiErrors } from "@/lib/server/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, sameOrigin } from "@/lib/server/auth";
import { batchNewsAction } from "@/lib/server/news";
import { dispatchNewsAlerts } from "@/lib/server/alerts";
import { logFailure } from "@/lib/server/safe-log";

const schema = z
  .object({
    ids: z
      .array(z.string().regex(/^[a-f0-9]{24}$/))
      .min(1)
      .max(5000),
    action: z.enum(["approve", "reject", "unapprove", "block", "unblock", "delete", "restore"]),
  })
  .strict();

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (!(await sameOrigin()) || !(await isAdmin()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const parsed = await readJsonBody(request, schema, 196608);
  if (!parsed.ok) return parsed.response;
  const result = await batchNewsAction(parsed.data.ids, parsed.data.action);
  if (parsed.data.action === "approve" && result.changed.length)
    await dispatchNewsAlerts(request.nextUrl.origin).catch((error) =>
      logFailure("Falha nos alertas após aprovação em lote", error),
    );
  return NextResponse.json(result);
});
