import { withApiErrors } from "@/lib/server/api-handler";
import { NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/server/auth";
import { captureNews } from "@/lib/server/news";

export const POST = withApiErrors(async function POST() {
  if (!(await sameOrigin()) || !(await isAdmin()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json(await captureNews(true));
});
