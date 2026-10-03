import { readJsonBody } from "@/lib/server/request-body";
import { UserInputError } from "@/lib/domain/errors";
import { withApiErrors } from "@/lib/server/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/server/auth";
import { currentUser, getAlertPrefs, setAlertPrefs } from "@/lib/server/user-auth";
import { z } from "zod";

const schema = z
  .object({
    enabled: z.boolean(),
    minRisk: z.union([z.literal(45), z.literal(60), z.literal(75)]),
    supplyChainOnly: z.boolean(),
    latamOnly: z.boolean(),
  })
  .strict();
export const GET = withApiErrors(async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta" }, { status: 401 });
  return NextResponse.json(
    { user, prefs: await getAlertPrefs(user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const PATCH = withApiErrors(async function PATCH(request: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta" }, { status: 401 });
  const parsed = await readJsonBody(request, schema, 16384);
  if (!parsed.ok) return parsed.response;
  try {
    return NextResponse.json({ prefs: await setAlertPrefs(user.id, parsed.data) });
  } catch (error) {
    if (!(error instanceof UserInputError)) throw error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao salvar" },
      { status: 422 },
    );
  }
});
