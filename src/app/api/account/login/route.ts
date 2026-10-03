import { withApiErrors } from "@/lib/server/api-handler";
import { readJsonBody } from "@/lib/server/request-body";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { loginSchema } from "@/lib/domain/account-validation";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import { authenticateUser, setUserCookie } from "@/lib/server/user-auth";

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  if (!(await consumeRateLimit(request, "account/login", 10, 900000)))
    return NextResponse.json(
      { error: "Limite temporário de tentativas. Aguarde e tente novamente." },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  const parsed = await readJsonBody(request, loginSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const user = await authenticateUser(String(body.email ?? ""), String(body.password ?? ""));
  if (!user) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  await setUserCookie(user);
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
});
