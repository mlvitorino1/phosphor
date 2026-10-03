import Link from "next/link";
import {
  Activity,
  CloudLightning,
  Flame,
  Mountain,
  Waves,
  Wind,
  MapPin,
  ArrowUpRight,
  HeartPulse,
  Siren,
  Newspaper,
} from "lucide-react";
import type { Category, EventRecord } from "@/lib/domain/types";
import { CATEGORY_LABEL, IMPACT_LABEL, KIND_LABEL, STATUS_LABEL } from "@/lib/domain/types";

export function CategoryIcon({ category, size = 20 }: { category: Category; size?: number }) {
  const props = { size, strokeWidth: 1.8 };
  switch (category) {
    case "earthquake":
      return <Activity {...props} />;
    case "storm":
      return <Wind {...props} />;
    case "flood":
      return <Waves {...props} />;
    case "wildfire":
      return <Flame {...props} />;
    case "volcano":
    case "landslide":
      return <Mountain {...props} />;
    case "tsunami":
      return <Waves {...props} />;
    case "health":
      return <HeartPulse {...props} />;
    case "civil":
      return <Siren {...props} />;
    default:
      return <CloudLightning {...props} />;
  }
}
export function EventIcon({
  event,
  size = 20,
}: {
  event: Pick<EventRecord, "category" | "kind">;
  size?: number;
}) {
  return event.kind === "report" ? (
    <Newspaper size={size} strokeWidth={1.8} />
  ) : (
    <CategoryIcon category={event.category} size={size} />
  );
}
export function utcDate(value: string) {
  return (
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    })
      .format(new Date(value))
      .replace(" de ", " ") + " UTC"
  );
}
export function ImpactBadge({ impact }: { impact: EventRecord["impact"] }) {
  return (
    <span className={`impact-badge impact-${impact}`}>
      <span />
      {IMPACT_LABEL[impact]}
    </span>
  );
}
export function EventCard({ event }: { event: EventRecord }) {
  return (
    <Link href={`/evento/${encodeURIComponent(event.id)}`} className="event-card">
      <div className="event-card-top">
        <div className="category-chip">
          <EventIcon event={event} size={17} /> {CATEGORY_LABEL[event.category]} ·{" "}
          {KIND_LABEL[event.kind ?? "incident"]}
        </div>
        <ImpactBadge impact={event.impact} />
      </div>
      <h3>{event.title}</h3>
      <p className="event-location">
        <MapPin size={15} /> {event.location}
      </p>
      <div className="event-card-bottom">
        <span>{utcDate(event.updatedAt)}</span>
        <span>{STATUS_LABEL[event.status]}</span>
        <ArrowUpRight size={18} />
      </div>
    </Link>
  );
}
