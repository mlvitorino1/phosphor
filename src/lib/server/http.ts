import "server-only";

/** Only controlled status data can be shown in capture diagnostics. */
export class SourceRequestError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("Falha HTTP na fonte");
    this.status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502;
  }
}

export function sourceFailureSummary(error: unknown): string {
  if (error instanceof SourceRequestError)
    return error.status === 429 ? "limite temporário de consultas" : `HTTP ${error.status}`;
  if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name))
    return "tempo limite de consulta";
  return "falha na conexão ou no conteúdo recebido";
}

/** Cap decoded network bytes even when the upstream omits Content-Length. */
export async function readResponseText(response: Response, maxBytes = 10_000_000): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error("Resposta da fonte acima do limite");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Resposta da fonte acima do limite");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}
