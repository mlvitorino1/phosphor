import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`phosphor-brand${compact ? " phosphor-brand-compact" : ""}`}>
      <Image
        src="/phosphor-mark.svg"
        width={39}
        height={39}
        alt=""
        loading="eager"
        aria-hidden="true"
        className="phosphor-brand-mark"
      />
      <span className="phosphor-brand-wordmark">
        Phosphor<small>MONITOR DE EVENTOS</small>
      </span>
    </span>
  );
}
