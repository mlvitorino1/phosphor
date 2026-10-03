import { withApiErrors } from "@/lib/server/api-handler";
import { readJsonBody } from "@/lib/server/request-body";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { resetSchema } from "@/lib/domain/account-validation";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import { resetUserPassword } from "@/lib/server/user-auth";

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  if (!(await consumeRateLimit(request, "account/reset", 5, 900000)))
    return NextResponse.json(
      { error: "Limite temporário de tentativas. Aguarde e tente novamente." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  const parsed = await readJsonBody(request, resetSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const ok = await resetUserPassword(String(body.token ?? ""), String(body.password ?? ""));
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Link inválido ou expirado" }, { status: 400 });
});
