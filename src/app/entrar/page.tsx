import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { legacyAccountPath } from "@/lib/domain/account-links";

export const metadata: Metadata = { title: "Entrar", robots: { index: false, follow: false } };
export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ redefinir?: string; verificar?: string }>;
}) {
  const params = await searchParams;
  redirect(legacyAccountPath(params));
}
