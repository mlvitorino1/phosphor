import { z } from "zod";
import { readJsonBody } from "@/lib/server/request-body";
import { UserInputError } from "@/lib/domain/errors";
import { withApiErrors } from "@/lib/server/api-handler";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin, sameOrigin } from "@/lib/server/auth";
import { getNewsCandidates, saveNewsAnalysis } from "@/lib/server/news";
import { analyzeNews } from "@/lib/server/ai-news";

export const POST = withApiErrors(async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await sameOrigin()) || !(await isAdmin()))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const item = (await getNewsCandidates()).items.find((candidate) => candidate.id === id);
  if (!item) return NextResponse.json({ error: "Notícia não encontrada" }, { status: 404 });
  const parsed = await readJsonBody(
    request,
    z.object({ excerpt: z.string().min(100).max(12000) }),
    65536,
  );
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  try {
    const analysis = await analyzeNews(item, String(body.excerpt ?? ""));
    const updated = await saveNewsAnalysis(id, analysis);
    return NextResponse.json(
      updated ? { analysis, item: updated } : { error: "Notícia indisponível" },
      { status: updated ? 200 : 422 },
    );
  } catch (error) {
    if (!(error instanceof UserInputError)) throw error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha na análise" },
      { status: 422 },
    );
  }
});
