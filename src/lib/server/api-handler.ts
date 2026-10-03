import "server-only";
import { NextResponse } from "next/server";
import { UserInputError } from "@/lib/domain/errors";

/** A stable JSON failure boundary; database errors and secrets stay out of responses. */
export function withApiErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof UserInputError)
        return NextResponse.json(
          { error: error.message },
          { status: 422, headers: { "Cache-Control": "no-store" } },
        );
      console.error("Falha na API", { type: error instanceof Error ? error.name : "Unknown" });
      return NextResponse.json(
        { error: "Serviço temporariamente indisponível. Tente novamente." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
