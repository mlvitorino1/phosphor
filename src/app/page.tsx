import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Crosshair, Globe2, Layers3, Radio, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { HeroGlobe } from "@/components/map/hero-globe";
import { getEvents } from "@/lib/server/store";
import { EventCard } from "@/components/map/event-card";
import { Brand } from "@/components/layout/brand";
import { SignalClue } from "@/components/portfolio/recruiter-easter-eggs";
export const dynamic = "force-dynamic";

export default async function Home() {
  const feed = await getEvents().catch(() => ({
    events: [],
    available: [],
    unavailable: ["Fontes"],
    fetchedAt: new Date().toISOString(),
  }));
  const recent = feed.events.slice(0, 3);
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="hero-identity">
              <Image
                src="/phosphor-hero.png"
                alt="P luminoso verde, identidade visual do Phosphor"
                width={136}
                height={136}
                sizes="(max-width: 560px) 96px, 136px"
                priority
                className="hero-identity-image"
              />
              <div>
                <span>PHOSPHOR</span>
                <strong>O mundo em sinais.</strong>
                <small>MONITOR DE EVENTOS GLOBAIS</small>
              </div>
            </div>
            <div className="eyebrow">
              <span className="pulse-dot" /> UM MAPA VIVO DO PLANETA
            </div>
            <h1>
              O mundo muda.
              <br />
              <span>Veja onde.</span>
            </h1>
            <p>
              Eventos relevantes ao redor do planeta, organizados por localização, impacto e fonte.
              Uma forma clara de entender o que está acontecendo agora.
            </p>
            <div className="hero-actions">
              <Link href="/mapa" className="button button-primary">
                Explorar o mapa <ArrowRight size={18} />
              </Link>
              <Link href="/eventos" className="button button-secondary">
                Ver eventos
              </Link>
            </div>
            <div className="hero-foot">
              <Radio size={15} /> Dados de fontes públicas, atualizados periodicamente{" "}
              <span className="hero-foot-line" /> {feed.events.length} eventos exibidos
            </div>
          </div>
          <div className="hero-visual">
            <HeroGlobe events={feed.events.slice(0, 120)} />
            <div className="hero-globe-caption">
              <Crosshair size={14} /> VISÃO GLOBAL · ARRASTE PARA EXPLORAR
            </div>
          </div>
        </section>

        <section className="signal-strip">
          <div className="wrap signal-inner">
            <span>
              <span className="pulse-dot" /> PHOSPHOR / AGORA
            </span>
            <strong>{feed.events.length}</strong>
            <span>eventos no mapa</span>
            <i />
            <strong>{feed.events.filter((e) => e.impact === "critical").length}</strong>
            <span>com impacto crítico</span>
            <i />
            <strong>{feed.available.length}</strong>
            <span>fontes integradas</span>
            <Link href="/mapa">
              ABRIR MAPA <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        <section className="section wrap how-section">
          <div className="section-heading">
            <div>
              <div className="kicker">01 / VISÃO GERAL</div>
              <h2>Do sinal à compreensão.</h2>
            </div>
            <p>
              Cada ponto representa um acontecimento com contexto suficiente para você entender o
              essencial em segundos.
            </p>
          </div>
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Globe2 />
              </div>
              <span>01</span>
              <h3>Localize</h3>
              <p>Veja onde os eventos estão acontecendo em um mapa global interativo.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Layers3 />
              </div>
              <span>02</span>
              <h3>Entenda o impacto</h3>
              <p>Identifique categoria, abrangência, horário e nível de impacto com clareza.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <ShieldCheck />
              </div>
              <span>03</span>
              <h3>Confira a origem</h3>
              <p>Acesse as fontes vinculadas e acompanhe novas observações do evento.</p>
            </div>
          </div>
        </section>

        <section className="section wrap recent-section">
          <div className="section-heading">
            <div>
              <div className="kicker">02 / ÚLTIMAS ATUALIZAÇÕES</div>
              <h2>Acontecendo agora</h2>
            </div>
            <Link href="/eventos" className="text-link">
              Todos os eventos <ArrowRight size={17} />
            </Link>
          </div>
          {recent.length ? (
            <div className="recent-grid">
              {recent.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              As fontes estão temporariamente indisponíveis. Tente novamente em alguns minutos.
            </div>
          )}
        </section>

        <section className="final-cta wrap">
          <div>
            <div className="kicker">PHOSPHOR / O PLANETA EM PERSPECTIVA</div>
            <h2>Abra. Observe. Compreenda.</h2>
            <p>Explore acontecimentos por lugar, tipo e intensidade.</p>
          </div>
          <Link href="/mapa" className="button button-primary">
            Explorar o mapa <ArrowRight size={18} />
          </Link>
        </section>
      </main>
      <footer className="footer wrap">
        <Brand compact />
        <span>Informações sujeitas à atualização pelas fontes.</span>
        <SignalClue />
      </footer>
    </>
  );
}
