import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3, MapPin, Radio } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { EventIcon, ImpactBadge, utcDate } from "@/components/map/event-card";
import { DetailMap } from "@/components/map/detail-map";
import { getEvent, getTimeline } from "@/lib/server/store";
import { CATEGORY_LABEL, KIND_LABEL, STATUS_LABEL } from "@/lib/domain/types";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = await getEvent((await params).id);
  return { title: e?.title ?? "Evento não encontrado" };
}
export default async function EventPage({ params }: Props) {
  const event = await getEvent((await params).id);
  if (!event) notFound();
  const timeline = await getTimeline(event.id).catch(() => []);
  const updates = timeline.length ? timeline : event.updates;
  return (
    <>
      <SiteHeader />
      <main className="wrap detail-page">
        <Link href="/eventos" className="back-link">
          <ArrowLeft size={16} /> Voltar aos eventos
        </Link>
        <div className="detail-heading">
          <div className="kicker">
            <Radio size={15} /> {KIND_LABEL[event.kind ?? "incident"].toUpperCase()} /{" "}
            {CATEGORY_LABEL[event.category].toUpperCase()}
          </div>
          <h1>{event.title}</h1>
          <div className="detail-badges">
            <ImpactBadge impact={event.impact} />
            <span className="status-pill">{STATUS_LABEL[event.status]}</span>
            <span className="detail-meta">
              <Clock3 size={14} /> Atualizado {utcDate(event.updatedAt)}
            </span>
          </div>
        </div>
        <div className="detail-grid">
          <div className="detail-primary">
            <div className="detail-map">
              <DetailMap event={event} />
            </div>
            <div className="detail-block">
              <div className="kicker">VISÃO GERAL</div>
              <h2>Sobre este evento</h2>
              <p>{event.summary}</p>
            </div>
            <div className="detail-block">
              <div className="kicker">ACOMPANHAMENTO</div>
              <h2>Linha do tempo</h2>
              <div className="timeline">
                {updates.slice(0, 20).map((u, i) => (
                  <div className="timeline-row" key={`${u.at}-${i}`}>
                    <i />
                    <div>
                      <strong>{utcDate(u.at)}</strong>
                      <p>{u.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <aside className="detail-sidebar">
            <div className="detail-side-card">
              <div className="kicker">DADOS ESSENCIAIS</div>
              <div className="side-category">
                <EventIcon event={event} size={19} /> {CATEGORY_LABEL[event.category]}
              </div>
              <dl>
                <div>
                  <dt>Localização</dt>
                  <dd>
                    <MapPin size={14} /> {event.location}
                  </dd>
                </div>
                <div>
                  <dt>Natureza</dt>
                  <dd>{KIND_LABEL[event.kind ?? "incident"]}</dd>
                </div>
                <div>
                  <dt>Início</dt>
                  <dd>{utcDate(event.startedAt)}</dd>
                </div>
                <div>
                  <dt>Abrangência</dt>
                  <dd>
                    {event.geoPrecision === "country"
                      ? "Apenas país identificado"
                      : event.geometry
                        ? "Área publicada pela fonte"
                        : event.geoType === "localized"
                          ? "Ponto de referência"
                          : event.radiusKm
                            ? `Área aproximada · ${event.radiusKm} km`
                            : "Centro da região; limite não informado"}
                  </dd>
                </div>
                <div>
                  <dt>Coordenadas de referência</dt>
                  <dd>
                    {event.lat.toFixed(2)}, {event.lng.toFixed(2)}
                  </dd>
                </div>
                {Object.entries(event.metrics).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="detail-side-card">
              <div className="kicker">FONTES VERIFICÁVEIS</div>
              <p className="source-intro">Informações publicadas pelas organizações abaixo.</p>
              {event.sources.map((s, i) => (
                <a
                  className="source-link"
                  key={`${s.url}-${i}`}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.name}
                  <ArrowUpRight size={16} />
                </a>
              ))}
            </div>
            <p className="detail-disclaimer">
              Classificação e localização podem mudar conforme as fontes. Consulte os órgãos
              responsáveis para orientações oficiais.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}
