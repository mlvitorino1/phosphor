import { afterEach, describe, expect, it, vi } from "vitest";
import { logFailure } from "@/lib/server/safe-log";
import { withApiErrors } from "@/lib/server/api-handler";
import { validBearer } from "@/lib/server/security";
import { firms } from "@/lib/server/regional-feeds";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("credential exposure boundaries", () => {
  it("omits messages, causes and arbitrary error names from logs and API responses", async () => {
    const secret = "fixture".repeat(8);
    const failure = new Error(`Request failed: https://example.org/${secret}`, {
      cause: { headers: { Authorization: `Bearer ${secret}` } },
    });
    failure.name = secret;
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    logFailure("Falha na fonte", failure);
    const response = await withApiErrors(async () => {
      throw failure;
    })();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(secret);
    expect(JSON.stringify(output.mock.calls)).not.toContain(secret);
    expect(output.mock.calls[0]).toEqual(["Falha na fonte", { type: "Error" }]);
  });

  it("requires an exact Bearer header and a sufficiently long configured cron secret", () => {
    const secret = "c".repeat(32);
    expect(validBearer(`Bearer ${secret}`, secret)).toBe(true);
    for (const header of [null, "", secret, `Bearer ${secret}x`, `Bearer ${"x".repeat(32)}`])
      expect(validBearer(header, secret)).toBe(false);
    expect(validBearer("Bearer short", "short")).toBe(false);
    expect(validBearer("Bearer undefined", undefined)).toBe(false);
  });

  it("never caches the keyed FIRMS request or publishes the API key in event sources", async () => {
    const secret = "fixture".repeat(8);
    vi.stubEnv("FIRMS_MAP_KEY", secret);
    const rows = [
      "latitude,longitude,acq_date,acq_time,confidence,type",
      "-15.81,-47.91,2026-10-02,1200,h,0",
      "-15.82,-47.92,2026-10-02,1210,h,0",
      "-15.83,-47.93,2026-10-02,1220,h,0",
    ];
    const fetcher = vi.fn(async () => new Response(rows.join("\n")));
    vi.stubGlobal("fetch", fetcher);
    const events = await firms();
    expect(fetcher.mock.calls[0]).toEqual([
      expect.stringContaining(`/csv/${secret}/`),
      expect.objectContaining({ cache: "no-store", redirect: "error" }),
    ]);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain(secret);
  });
});
