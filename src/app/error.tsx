"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="wrap" style={{ paddingBlock: 96 }}>
      <p className="eyebrow">PHOSPHOR</p>
      <h1>Não foi possível carregar esta página.</h1>
      <p>Verifique sua conexão e tente novamente em alguns instantes.</p>
      <div className="hero-actions">
        <button className="button button-primary" onClick={reset}>
          Tentar novamente
        </button>
        <Link className="button button-secondary" href="/">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
