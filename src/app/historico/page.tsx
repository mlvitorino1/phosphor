import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { HistoryExplorer } from "@/components/map/history-explorer";
import { getHistoricalArchive, getHistoricalIndex } from "@/lib/server/history";

export const metadata: Metadata = { title: "Acervo histórico" };
export const dynamic = "force-dynamic";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const index = await getHistoricalIndex();
  const params = await searchParams;
  const selected =
    index.find((item) => item.key === params.periodo) ??
    index.find((item) => item.key === "1979") ??
    index[0];
  const archive = selected ? await getHistoricalArchive(selected.key) : null;
  return (
    <>
      <SiteHeader />
      <main className="wrap history-page">
        <div className="kicker">PHOSPHOR / ARQUIVO</div>
        <h1>Acervo histórico</h1>
        <p className="page-intro">
          Registros de eventos codificados pelo GDELT desde 1979. Explore os dados antigos em uma
          área separada dos alertas atuais.
        </p>
        {archive ? (
          <HistoryExplorer
            key={selected.key}
            archive={archive}
            index={index}
            selectedKey={selected.key}
          />
        ) : (
          <div className="empty-state">
            Nenhum período importado. Execute <code>npm run history:import -- 1979</code> no projeto
            para carregar o acervo.
          </div>
        )}
      </main>
    </>
  );
}
