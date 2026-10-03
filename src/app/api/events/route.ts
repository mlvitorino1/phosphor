import { withApiErrors } from "@/lib/server/api-handler";
import { NextResponse } from "next/server";
import { getEvents } from "@/lib/server/store";
import { logFailure } from "@/lib/server/safe-log";

export const dynamic = "force-dynamic";
export const GET = withApiErrors(async function GET() {
  try {
    const result = await getEvents();
    return NextResponse.json(result, {
      status: result.available.length ? 200 : 503,
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=240" },
    });
  } catch (error) {
    logFailure("Eventos indisponíveis", error);
    return NextResponse.json(
      {
        events: [],
        available: [],
        unavailable: ["Armazenamento"],
        fetchedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
});
