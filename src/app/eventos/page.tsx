import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { EventList } from "@/components/map/event-list";
import { getEvents } from "@/lib/server/store";

export const metadata: Metadata = { title: "Eventos" };
export const dynamic = "force-dynamic";
export default async function EventsPage() {
  const feed = await getEvents().catch(() => ({
    events: [],
    available: [],
    unavailable: ["Fontes"],
    fetchedAt: new Date().toISOString(),
  }));
  return (
    <>
      <SiteHeader />
      <main className="wrap list-page">
        <div className="kicker">PHOSPHOR / EVENTOS</div>
        <h1>Eventos recentes</h1>
        <p className="page-intro">
          Acompanhe acontecimentos geográficos e confira as informações publicadas por cada fonte.
        </p>
        <EventList events={feed.events} />
      </main>
    </>
  );
}
