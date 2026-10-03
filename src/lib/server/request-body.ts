import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Enforce the byte limit while streaming, before allocating or parsing a full body. */
export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 16_384,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return {
      ok: false,
      response: NextResponse.json({ error: "Envie os dados em JSON" }, { status: 415 }),
    };
  const reader = request.body?.getReader();
  if (!reader)
    return {
      ok: false,
      response: NextResponse.json({ error: "Dados inválidos" }, { status: 400 }),
    };
  try {
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return {
          ok: false,
          response: NextResponse.json({ error: "Dados acima do limite" }, { status: 413 }),
        };
      }
      chunks.push(value);
    }
    const parsed = schema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success)
      return {
        ok: false,
        response: NextResponse.json({ error: "Verifique os campos informados" }, { status: 400 }),
      };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "JSON inválido" }, { status: 400 }) };
  } finally {
    reader.releaseLock();
  }
}
