import { UserInputError } from "@/lib/domain/errors";
import { withApiErrors } from "@/lib/server/api-handler";
import { readJsonBody } from "@/lib/server/request-body";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { registrationSchema } from "@/lib/domain/account-validation";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import {
  emailLinkOrigin,
  registerUser,
  requestEmailVerification,
  setUserCookie,
} from "@/lib/server/user-auth";
import { emailConfigured } from "@/lib/server/email";
import { logFailure } from "@/lib/server/safe-log";

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  if (!(await consumeRateLimit(request, "account/register", 3, 3600000)))
    return NextResponse.json(
      { error: "Limite temporário de tentativas. Aguarde e tente novamente." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  const parsed = await readJsonBody(request, registrationSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  try {
    const user = await registerUser(
      String(body.email ?? ""),
      String(body.password ?? ""),
      String(body.name ?? ""),
    );
    await setUserCookie(user);
    let verificationSent = false;
    if (emailConfigured())
      try {
        await requestEmailVerification(user.id, emailLinkOrigin(request.nextUrl.origin));
        verificationSent = true;
      } catch (error) {
        logFailure("Falha no e-mail de verificação", error);
      }
    return NextResponse.json(
      { user, verificationSent },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof UserInputError)) throw error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível criar a conta" },
      { status: 400 },
    );
  }
});
