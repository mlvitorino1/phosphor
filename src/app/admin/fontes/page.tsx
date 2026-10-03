import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SourcesPanel } from "@/components/admin/sources-panel";
import { isAdmin } from "@/lib/server/auth";
import { sourceSettings } from "@/lib/server/feeds";

export const dynamic = "force-dynamic";
export default async function SourcesPage() {
  if (!(await isAdmin())) redirect("/admin");
  return (
    <>
      <SiteHeader />
      <main className="wrap admin-page">
        <Link href="/configuracoes" className="back-link">
          ← Configurações de Marcus
        </Link>
        <div className="kicker admin-kicker">CAPTURA DE DADOS</div>
        <h1>Configurar fontes</h1>
        <p className="page-intro">
          Pause uma fonte sem perder as notícias já capturadas. Manchetes com local identificável
          podem entrar no mapa automaticamente.
        </p>
        <SourcesPanel initial={await sourceSettings()} />
      </main>
    </>
  );
}
