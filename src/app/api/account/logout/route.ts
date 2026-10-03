import { withApiErrors } from "@/lib/server/api-handler";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import { clearUserCookie } from "@/lib/server/user-auth";

export const POST = withApiErrors(async function POST() {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  await clearUserCookie();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
});
