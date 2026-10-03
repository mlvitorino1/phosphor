import { z } from "zod";
import { readJsonBody } from "@/lib/server/request-body";
import { withApiErrors } from "@/lib/server/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import { verifyUserEmail } from "@/lib/server/user-auth";

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const parsed = await readJsonBody(
    request,
    z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }),
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const ok = await verifyUserEmail(String(body.token ?? ""));
  return NextResponse.json(ok ? { ok: true } : { error: "Link inválido ou expirado" }, {
    status: ok ? 200 : 422,
  });
});
