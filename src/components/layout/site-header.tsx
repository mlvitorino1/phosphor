import Link from "next/link";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { isAdmin } from "@/lib/server/auth";
import { currentUser } from "@/lib/server/user-auth";
import { Brand } from "@/components/layout/brand";

export async function SiteHeader() {
  const [admin, user] = await Promise.all([isAdmin(), currentUser()]);
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <Link className="brand" href="/" aria-label="Phosphor — início">
          <Brand />
        </Link>
        <nav aria-label="Navegação principal">
          <Link href="/mapa">Mapa</Link>
          <Link href="/eventos">Eventos</Link>
          <Link href="/historico">Histórico</Link>
          {user && <Link href="/alertas">Alertas</Link>}
        </nav>
        <div className="header-actions">
          <Link href="/mapa" className="header-action">
            Abrir mapa <ArrowUpRight size={16} />
          </Link>
          <Link href="/mapa?entrar=1" className="header-user">
            {user ? user.name.split(" ")[0] : "Entrar"}
          </Link>
          {admin && (
            <Link href="/configuracoes" className="header-user">
              <Settings2 size={15} />
              Marcus
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
