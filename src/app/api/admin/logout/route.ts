import { withApiErrors } from "@/lib/server/api-handler";
import { NextResponse } from "next/server";
import { clearAdminCookie, sameOrigin } from "@/lib/server/auth";
export const POST = withApiErrors(async function POST() {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
});
