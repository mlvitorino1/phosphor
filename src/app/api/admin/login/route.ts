import { withApiErrors } from "@/lib/server/api-handler";
import { readJsonBody } from "@/lib/server/request-body";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { adminLoginSchema } from "@/lib/domain/account-validation";
import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, passwordMatches, sameOrigin, setAdminCookie } from "@/lib/server/auth";

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  if (!adminConfigured())
    return NextResponse.json({ error: "Administração não configurada" }, { status: 503 });
  if (!(await consumeRateLimit(request, "admin/login", 5, 900000)))
    return NextResponse.json(
      { error: "Limite temporário de tentativas. Aguarde e tente novamente." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  const parsed = await readJsonBody(request, adminLoginSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (
    String(body.username).trim().toLowerCase() !== "marcus" ||
    typeof body.password !== "string" ||
    !(await passwordMatches(body.password))
  ) {
    return NextResponse.json({ error: "Senha inválida" }, { status: 401 });
  }

  await setAdminCookie();
  return NextResponse.json({ ok: true });
});
