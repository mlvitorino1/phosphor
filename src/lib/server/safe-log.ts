import "server-only";

/** Never serialize provider errors: messages, causes and URLs may contain credentials. */
export function logFailure(context: string, error: unknown) {
  const knownTypes = new Set([
    "TypeError",
    "SyntaxError",
    "RangeError",
    "AbortError",
    "TimeoutError",
  ]);
  const type =
    error instanceof Error ? (knownTypes.has(error.name) ? error.name : "Error") : "Unknown";
  console.error(context, { type });
}
