import { withApiErrors } from "@/lib/server/api-handler";
import { readJsonBody } from "@/lib/server/request-body";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { forgotSchema } from "@/lib/domain/account-validation";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import { emailConfigured } from "@/lib/server/email";
import { createResetLink, emailLinkOrigin } from "@/lib/server/user-auth";

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  if (!emailConfigured())
    return NextResponse.json(
      { error: "Recuperação por e-mail indisponível neste ambiente" },
      { status: 503 },
    );
  if (!(await consumeRateLimit(request, "account/forgot", 1, 60000)))
    return NextResponse.json(
      { error: "Limite temporário de tentativas. Aguarde e tente novamente." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  const parsed = await readJsonBody(request, forgotSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  try {
    await createResetLink(String(body.email ?? ""), emailLinkOrigin(request.nextUrl.origin));
  } catch {
    return NextResponse.json(
      { error: "O serviço de e-mail está temporariamente indisponível" },
      { status: 503 },
    );
  }
  return NextResponse.json({
    ok: true,
    message: "Se houver uma conta, enviaremos um link de recuperação.",
  });
});
