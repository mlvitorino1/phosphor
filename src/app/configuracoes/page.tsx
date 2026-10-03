import Link from "next/link";
import { redirect } from "next/navigation";
import { Newspaper, RadioTower, SlidersHorizontal } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { isAdmin } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  if (!(await isAdmin())) redirect("/admin");
  return (
    <>
      <SiteHeader />
      <main className="wrap admin-page">
        <div className="kicker">CONTA DE MARCUS · ADMINISTRADOR</div>
        <h1>Configurações</h1>
        <p className="page-intro">Gerencie a captura e revise o que aparece no mapa.</p>
        <div className="settings-grid">
          <Link href="/admin/fontes" className="settings-card">
            <RadioTower />
            <h2>Configurar fontes</h2>
            <p>Ativar ou pausar fontes de dados e a descoberta pelo GDELT.</p>
            <span>Abrir →</span>
          </Link>
          <Link href="/admin/noticias" className="settings-card">
            <Newspaper />
            <h2>Painel de notícias</h2>
            <p>Acompanhar publicações automáticas, corrigir locais e bloquear matérias.</p>
            <span>Abrir →</span>
          </Link>
          <Link href="/admin" className="settings-card">
            <SlidersHorizontal />
            <h2>Revisar eventos</h2>
            <p>Corrigir impacto, status, posição e visibilidade dos registros.</p>
            <span>Abrir →</span>
          </Link>
        </div>
      </main>
    </>
  );
}
