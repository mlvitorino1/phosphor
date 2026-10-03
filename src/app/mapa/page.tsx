import type { Metadata } from "next";
import { Explorer } from "@/components/map/explorer";
import { getEvents } from "@/lib/server/store";
import { currentUser } from "@/lib/server/user-auth";
import { isAdmin } from "@/lib/server/auth";
import "../entrar/entry.css";
import "./map-entry.css";

export const metadata: Metadata = { title: "Mapa de eventos" };
export const dynamic = "force-dynamic";
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ entrar?: string; redefinir?: string; verificar?: string }>;
}) {
  const [feed, user, admin, params] = await Promise.all([
    getEvents().catch(() => ({
      events: [],
      available: [],
      unavailable: ["Fontes"],
      fetchedAt: new Date().toISOString(),
    })),
    currentUser(),
    isAdmin(),
    searchParams,
  ]);
  const resetToken = typeof params.redefinir === "string" ? params.redefinir : "";
  const verifyToken = typeof params.verificar === "string" ? params.verificar : "";
  return (
    <Explorer
      initial={feed.events}
      available={feed.available}
      unavailable={feed.unavailable}
      fetchedAt={feed.fetchedAt}
      initialUser={user}
      admin={admin}
      entryRequested={params.entrar === "1" || Boolean(resetToken || verifyToken)}
      resetToken={resetToken}
      verifyToken={verifyToken}
    />
  );
}
