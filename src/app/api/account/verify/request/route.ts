import { withApiErrors } from "@/lib/server/api-handler";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import { currentUser, emailLinkOrigin, requestEmailVerification } from "@/lib/server/user-auth";

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta" }, { status: 401 });
  if (!(await consumeRateLimit(request, `verify:${user.id}`, 1, 60000)))
    return NextResponse.json({ error: "Aguarde um minuto" }, { status: 429 });
  try {
    await requestEmailVerification(user.id, emailLinkOrigin(request.nextUrl.origin));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "E-mail indisponível neste ambiente" }, { status: 503 });
  }
});
