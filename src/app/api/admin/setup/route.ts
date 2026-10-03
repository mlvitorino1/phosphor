import { withApiErrors } from "@/lib/server/api-handler";
import { readJsonBody } from "@/lib/server/request-body";
import { consumeRateLimit } from "@/lib/server/rate-limit";
import { adminLoginSchema } from "@/lib/domain/account-validation";
import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, sameOrigin, setAdminCookie, setupLocalAdmin } from "@/lib/server/auth";

export const POST = withApiErrors(async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1"].includes(request.nextUrl.hostname) ||
    !(await sameOrigin())
  )
    return NextResponse.json({ error: "Configuração local indisponível" }, { status: 403 });
  if (adminConfigured())
    return NextResponse.json({ error: "Administrador já configurado" }, { status: 409 });
  if (!(await consumeRateLimit(request, "admin/setup", 3, 900000)))
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
    !(await setupLocalAdmin(body.password))
  )
    return NextResponse.json(
      { error: "Informe Marcus e uma senha com pelo menos 12 caracteres" },
      { status: 400 },
    );
  await setAdminCookie();
  return NextResponse.json({ ok: true });
});
