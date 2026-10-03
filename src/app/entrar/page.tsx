import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };
export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ redefinir?: string; verificar?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ entrar: "1" });
  if (typeof params.redefinir === "string") query.set("redefinir", params.redefinir);
  if (typeof params.verificar === "string") query.set("verificar", params.verificar);
  redirect(`/mapa?${query}`);
}
