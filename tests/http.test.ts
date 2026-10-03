import { expect, it, vi } from "vitest";
import { readResponseText } from "@/lib/server/http";
import { withApiErrors } from "@/lib/server/api-handler";
import { UserInputError } from "@/lib/domain/errors";

it("limits upstream bytes with and without Content-Length", async () => {
  expect(await readResponseText(new Response("hello"), 5)).toBe("hello");
  await expect(readResponseText(new Response("too large"), 5)).rejects.toThrow("limite");
  await expect(
    readResponseText(new Response("hello", { headers: { "Content-Length": "100" } }), 5),
  ).rejects.toThrow("limite");
});

it("keeps unexpected internal errors out of the public response", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const result = await withApiErrors(async () => {
    throw new Error("postgresql://private:secret@internal");
  })();
  expect(result.status).toBe(503);
  expect(await result.text()).not.toContain("private");
  expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
});

it("returns deliberate validation messages", async () => {
  const result = await withApiErrors(async () => {
    throw new UserInputError("Confirme seu e-mail");
  })();
  expect(result.status).toBe(422);
  expect(await result.json()).toEqual({ error: "Confirme seu e-mail" });
});
