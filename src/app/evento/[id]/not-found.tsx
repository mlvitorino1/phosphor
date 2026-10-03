import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap empty-page">
        <h1>Evento não encontrado</h1>
        <p>Ele pode ter sido removido ou ainda não estar disponível.</p>
        <Link href="/eventos" className="button button-primary">
          Ver eventos
        </Link>
      </main>
    </>
  );
}
