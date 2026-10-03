import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { Admin } from "@/components/admin/admin";
import { adminConfigured, isAdmin } from "@/lib/server/auth";
import { getEvents } from "@/lib/server/store";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  const configured = adminConfigured();
  const authorized = await isAdmin();
  const result = authorized ? await getEvents(true).catch(() => null) : null;
  return (
    <>
      <SiteHeader />
      <main className="wrap admin-page">
        <div className="kicker">ÁREA INTERNA · MARCUS</div>
        <h1>Administração</h1>
        <Admin
          key={authorized ? "active" : configured ? "login" : "setup"}
          configured={configured}
          canSetup={process.env.NODE_ENV !== "production"}
          authorized={authorized}
          initial={result?.events ?? []}
        />
      </main>
    </>
  );
}
