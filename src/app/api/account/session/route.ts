import { withApiErrors } from "@/lib/server/api-handler";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/user-auth";

export const GET = withApiErrors(async function GET() {
  return NextResponse.json(
    { user: await currentUser() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
