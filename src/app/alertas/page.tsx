import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { AlertSettings } from "@/components/auth/alert-settings";
import { currentUser, getAlertPrefs } from "@/lib/server/user-auth";

export const dynamic = "force-dynamic";
export default async function AlertsPage() {
  const user = await currentUser();
  if (!user) redirect("/mapa?entrar=1");
  const prefs = await getAlertPrefs(user.id);
  return (
    <>
      <SiteHeader />
      <main className="wrap alerts-page">
        <Link className="back-link" href="/mapa">
          ← Meu monitor
        </Link>
        <div className="kicker">CAMADA DE AÇÃO</div>
        <h1>Meus alertas</h1>
        <p className="page-intro">
          Receba por e-mail novos eventos revisados com risco relevante. A triagem prioriza cadeias
          de suprimentos na América Latina e usa um score explicável.
        </p>
        <AlertSettings initialUser={user} initialPrefs={prefs} />
      </main>
    </>
  );
}
