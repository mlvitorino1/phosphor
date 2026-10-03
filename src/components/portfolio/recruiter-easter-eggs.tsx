"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import {
  recruiterChallenge,
  solvesRecruiterChallenge,
  type RecruiterLevel,
} from "@/lib/domain/recruiter-challenge";

const RecruiterDossier = dynamic(
  () => import("./recruiter-dossier").then((module) => module.RecruiterDossier),
  { ssr: false },
);
type PuzzleBridge = {
  challenge: typeof recruiterChallenge;
  submit: (groups: unknown) => { ok: boolean; message: string };
};
declare global {
  interface Window {
    phosphor?: PuzzleBridge;
  }
}

export function RecruiterEasterEggs() {
  const [level, setLevel] = useState<RecruiterLevel | null>(null);
  useEffect(() => {
    let sequence = "";
    let lastKey = 0;
    const observe = () => setLevel("medium");
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (target instanceof HTMLElement &&
          (target.isContentEditable || target.closest("input, textarea, select, [role=textbox]")))
      )
        return;
      const now = Date.now();
      if (now - lastKey > 2500) sequence = "";
      lastKey = now;
      sequence = `${sequence}${event.key.toLowerCase()}`.slice(-8);
      if (sequence === "phosphor") {
        sequence = "";
        observe();
      }
    };
    const previous = window.phosphor;
    const bridge: PuzzleBridge = Object.freeze({
      challenge: recruiterChallenge,
      submit(groups: unknown) {
        if (!solvesRecruiterChallenge(groups))
          return {
            ok: false,
            message: "Sinal incompleto. Confira distância, tempo e transitividade.",
          };
        setLevel("advanced");
        return {
          ok: true,
          message: "Sinal 15 decodificado. Os bastidores avançados estão abertos.",
        };
      },
    });
    window.phosphor = bridge;
    window.addEventListener("keydown", onKey);
    window.addEventListener("phosphor:observe", observe);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("phosphor:observe", observe);
      if (window.phosphor === bridge) {
        if (previous) window.phosphor = previous;
        else delete window.phosphor;
      }
    };
  }, []);

  return level ? <RecruiterDossier level={level} onClose={() => setLevel(null)} /> : null;
}

export function SignalClue() {
  const observations = useRef({ count: 0, at: 0 });
  return (
    <button
      type="button"
      className="signal-clue"
      aria-label="Elemento 15. Observe três vezes para descobrir um sinal."
      title="Alguns sinais pedem três observações. Outros, o nome certo."
      onClick={() => {
        const now = Date.now();
        const current = observations.current;
        current.count = now - current.at > 2500 ? 1 : current.count + 1;
        current.at = now;
        if (current.count === 3) {
          current.count = 0;
          window.dispatchEvent(new Event("phosphor:observe"));
        }
      }}
    >
      <small>15</small>P<span aria-hidden="true">·</span>
    </button>
  );
}
