import { withApiErrors } from "@/lib/server/api-handler";
import { NextResponse } from "next/server";
import { getEvents } from "@/lib/server/store";

export const dynamic = "force-dynamic";
export const GET = withApiErrors(async function GET() {
  try {
    const result = await getEvents();
    return NextResponse.json(result, {
      status: result.available.length ? 200 : 503,
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=240" },
    });
  } catch (error) {
    console.error("Eventos indisponíveis:", {
      type: error instanceof Error ? error.name : "Unknown",
    });
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
