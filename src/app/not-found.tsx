import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap" style={{ paddingBlock: 96 }}>
      <p className="eyebrow">PHOSPHOR · 404</p>
      <h1>Página não encontrada.</h1>
      <p>O endereço pode ter mudado ou o evento pode ter saído do mapa.</p>
      <Link className="button button-primary" href="/mapa">
        Explorar o mapa
      </Link>
    </main>
  );
}
