"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Braces, Layers3, ShieldCheck, Sparkles, X } from "lucide-react";
import type { RecruiterLevel } from "@/lib/domain/recruiter-challenge";

export function RecruiterDossier({
  level,
  onClose,
}: {
  level: RecruiterLevel;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [hint, setHint] = useState(false);
  const advanced = level === "advanced";
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    node?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      node?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="recruiter-dialog"
      aria-labelledby="recruiter-title"
      onClose={(event) => {
        // Strict Mode closes and reopens during setup; ignore that queued close event.
        if (!event.currentTarget.open) onClose();
      }}
    >
      <div className="recruiter-shell">
        <button
          className="recruiter-close"
          type="button"
          onClick={onClose}
          aria-label="Fechar bastidores"
          autoFocus
        >
          <X size={21} />
        </button>
        <div className="recruiter-topline">
          <Sparkles size={15} /> SINAL 15 <span>{advanced ? "02 / AVANÇADO" : "01 / MÉDIO"}</span>
        </div>
        <div className="recruiter-element" aria-hidden="true">
          <small>15</small>P<i />
        </div>
        <h2 id="recruiter-title">
          {advanced ? "Conexões sob ruído." : "Você encontrou os bastidores."}
        </h2>
        <p className="recruiter-lead">
          {advanced
            ? "Distância, tempo e transitividade. Um pequeno desafio sobre uma decisão real do Phosphor: transformar relatos dispersos em eventos compreensíveis."
            : "Para quem avalia o trabalho além da primeira tela: as decisões, os limites e o cuidado por trás do mapa."}
        </p>
        <div className="recruiter-grid">
          <article>
            <Layers3 size={21} />
            <h3>{advanced ? "Concorrência tem memória" : "Uma base, limites claros"}</h3>
            <p>
              {advanced
                ? "Leases no PostgreSQL evitam capturas simultâneas. Revisões concorrentes verificam o snapshot anterior, preservando alterações humanas."
                : "Next.js, React e TypeScript. Regras puras separadas de rede, armazenamento e credenciais; fronteiras explícitas com server-only."}
            </p>
          </article>
          <article>
            <ShieldCheck size={21} />
            <h3>{advanced ? "Falhas sem vazamentos" : "Segurança verificável"}</h3>
            <p>
              {advanced
                ? "Erros de provedores ficam fora das respostas e logs. Cookies são assinados e vinculados à credencial atual; redefinir a senha revoga sessões."
                : "Senhas com scrypt e salt, validação de origem e entrada, limites de tentativas e varredura de segredos no histórico do Git."}
            </p>
          </article>
          <article>
            <Braces size={21} />
            <h3>{advanced ? "Precisão antes de certeza" : "Testes para decisões reais"}</h3>
            <p>
              {advanced
                ? "Uma capital é referência aproximada. Scores são heurísticas. Alertas de notícias exigem revisão humana; a IA oferece sugestões com citações."
                : "Regressões de autenticação, deduplicação, prazos e preservação de revisões. A CI também verifica migrações em PostgreSQL isolado."}
            </p>
          </article>
        </div>
        {advanced ? (
          <div className="recruiter-unlocked">
            <span className="pulse-dot" /> Componentes encontrados{" "}
            <code>[A, B, C] · [D] · [E, F]</code>
            <p>
              A e C pertencem ao mesmo grupo pela conexão com B. Este quebra-cabeça usa dados
              fictícios e uma regra reduzida; a deduplicação real também considera natureza,
              categoria e limites próprios de cada evento.
            </p>
          </div>
        ) : (
          <div className="recruiter-next">
            <button type="button" onClick={() => setHint((value) => !value)} aria-expanded={hint}>
              {hint ? "Guardar a pista" : "Há um segundo sinal. Ler a pista →"}
            </button>
            {hint && (
              <div className="recruiter-hint">
                <p>
                  Nas ferramentas do navegador, o elemento 15 tem uma pequena API pública. No
                  Console:
                </p>
                <code>window.phosphor.challenge()</code>
                <p>
                  Implemente os componentes conexos dos relatos. Envie os grupos com{" "}
                  <code>window.phosphor.submit(grupos)</code> para revelar o nível avançado.
                </p>
              </div>
            )}
          </div>
        )}
        <div className="recruiter-footer">
          <span>
            Construído por Marcus Vitorino
            <br />
            <small>Projeto de portfólio · descubra, leia, questione.</small>
          </span>
          <a href="https://github.com/mlvitorino1" target="_blank" rel="noopener noreferrer">
            GitHub do autor <ArrowUpRight size={17} />
          </a>
        </div>
      </div>
    </dialog>
  );
}
