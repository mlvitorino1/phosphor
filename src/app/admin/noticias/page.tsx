import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { NewsPanel } from "@/components/admin/news-panel";
import { isAdmin } from "@/lib/server/auth";
import { getNewsCandidates } from "@/lib/server/news";

export const dynamic = "force-dynamic";
export default async function NewsPage() {
  if (!(await isAdmin())) redirect("/admin");
  const initial = await getNewsCandidates();
  return (
    <>
      <SiteHeader />
      <main className="wrap admin-page">
        <Link href="/configuracoes" className="back-link">
          ← Configurações de Marcus
        </Link>
        <div className="kicker admin-kicker">PUBLICAÇÃO E CORREÇÃO</div>
        <h1>Painel de notícias</h1>
        <NewsPanel initial={initial} />
      </main>
    </>
  );
}
