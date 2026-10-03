import { readJsonBody } from "@/lib/server/request-body";
import { withApiErrors } from "@/lib/server/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/server/auth";
import { setSourceEnabled, sourceSettings } from "@/lib/server/feeds";
import { z } from "zod";

export const GET = withApiErrors(async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({ sources: await sourceSettings() });
});
export const PATCH = withApiErrors(async function PATCH(request: NextRequest) {
  if (!(await sameOrigin()) || !(await isAdmin()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const schema = z.object({ name: z.string().max(80), enabled: z.boolean() }).strict();
  const parsed = await readJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  if (!(await setSourceEnabled(parsed.data.name, parsed.data.enabled)))
    return NextResponse.json(
      { error: "Fonte inválida ou configuração indisponível" },
      { status: 400 },
    );
  return NextResponse.json({ ok: true, sources: await sourceSettings() });
});
