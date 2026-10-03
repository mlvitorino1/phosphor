"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, LockKeyhole, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import type { PublicUser } from "@/lib/domain/accounts";
import { readAccountTokens } from "@/lib/domain/account-links";

export type EntryStage = "auth" | "location" | "welcome" | "reveal" | "complete";
type Mode = "login" | "register" | "forgot" | "reset";
export type EntryLocation = { lat: number; lng: number } | null;

export function EntryExperience({
  stage,
  user,
  progress,
  total,
  onStage,
  onUser,
  onLocation,
}: {
  stage: EntryStage;
  user: PublicUser | null;
  progress: number;
  total: number;
  onStage: (stage: EntryStage) => void;
  onUser: (user: PublicUser) => void;
  onLocation: (location: EntryLocation) => void;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [resetToken, setResetToken] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    let revision = 0;
    const readLink = () => {
      if (!active) return;
      const fragment = window.location.hash;
      if (!fragment.includes("redefinir=") && !fragment.includes("verificar=")) return;
      const tokens = readAccountTokens(fragment);
      const current = ++revision;
      // Remove secrets before later requests; keep a reset token only in component memory.
      window.history.replaceState(null, "", "/mapa?entrar=1");
      onStage("auth");
      setResetToken(tokens.resetToken);
      setMode(tokens.resetToken ? "reset" : "login");
      setError("");
      setNotice("");
      if (!tokens.resetToken && !tokens.verifyToken) {
        setError("Link inválido ou expirado. Solicite um novo link.");
      }
      if (!tokens.verifyToken) return;
      void fetch("/api/account/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokens.verifyToken }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Falha na confirmação");
          if (active && revision === current)
            setNotice("E-mail confirmado. Você já pode ativar alertas.");
        })
        .catch((cause) => {
          if (active && revision === current)
            setError(cause instanceof Error ? cause.message : "Falha na confirmação");
        });
    };
    // Defer past Strict Mode cleanup so one-use tokens are sent once.
    queueMicrotask(readLink);
    // Opening another email link can change only the fragment on the same mounted map.
    window.addEventListener("hashchange", readLink);
    return () => {
      active = false;
      window.removeEventListener("hashchange", readLink);
    };
  }, [onStage]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const endpoint =
      mode === "register"
        ? "register"
        : mode === "forgot"
          ? "forgot"
          : mode === "reset"
            ? "reset"
            : "login";
    try {
      const response = await fetch(`/api/account/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "reset" ? { token: resetToken, password } : { email, password, name },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível continuar agora");
      if (mode === "forgot") {
        setNotice("Se o e-mail estiver cadastrado, você receberá o link de recuperação.");
        return;
      }
      if (mode === "reset") {
        setResetToken("");
        setMode("login");
        setPassword("");
        setNotice("Senha atualizada. Entre com seus dados.");
        window.history.replaceState(null, "", "/mapa?entrar=1");
        return;
      }
      onUser(data.user);
      setPassword("");
      onStage("location");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro inesperado");
    } finally {
      setBusy(false);
    }
  }

  function continueWithLocation(location: EntryLocation) {
    onLocation(location);
    onStage("welcome");
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      continueWithLocation(null);
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setBusy(false);
        continueWithLocation({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        setBusy(false);
        continueWithLocation(null);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 },
    );
  }

  if (stage === "complete") return null;
  if (stage === "reveal")
    return (
      <div className="entry-reveal-status" role="status">
        <span className="pulse-dot" />
        <span>
          Conectando sinais ao mapa{" "}
          <strong>
            {progress}/{total}
          </strong>
        </span>
        <span className="entry-reveal-track" aria-hidden="true">
          <i style={{ width: `${total ? Math.min(100, (progress / total) * 100) : 100}%` }} />
        </span>
      </div>
    );
  return (
    <div className="entry-modal-wrap">
      <section
        className={`entry-modal ${stage === "welcome" ? "entry-modal-welcome" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-title"
      >
        {stage === "auth" && (
          <>
            <div className="entry-kicker">
              <Image src="/phosphor-mark.svg" width={26} height={26} alt="" aria-hidden="true" />{" "}
              PHOSPHOR
            </div>
            <h1 id="entry-title">
              {mode === "register"
                ? "Crie seu acesso"
                : mode === "forgot"
                  ? "Recupere seu acesso"
                  : mode === "reset"
                    ? "Nova senha"
                    : "O mundo em perspectiva."}
            </h1>
            <p className="entry-intro">
              {mode === "login"
                ? "Entre para acompanhar riscos e eventos que importam para você."
                : mode === "register"
                  ? "Acompanhe eventos globais com foco em cadeias de suprimentos na América Latina."
                  : mode === "forgot"
                    ? "Enviaremos um link para redefinir sua senha."
                    : "Escolha uma nova senha com pelo menos 12 caracteres."}
            </p>
            <form onSubmit={submit} className="entry-form">
              {mode === "register" && (
                <label>
                  Nome
                  <input
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label>
                  E-mail
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  Senha
                  <input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={mode === "login" ? 1 : 12}
                  />
                </label>
              )}
              {error && (
                <p className="entry-error" role="alert">
                  {error}
                </p>
              )}
              {notice && (
                <p className="entry-notice" role="status">
                  {notice}
                </p>
              )}
              <button className="entry-primary" disabled={busy}>
                {busy
                  ? "Aguarde…"
                  : mode === "login"
                    ? "Entrar"
                    : mode === "register"
                      ? "Criar conta"
                      : mode === "forgot"
                        ? "Enviar link"
                        : "Salvar nova senha"}
                <ArrowRight size={17} />
              </button>
            </form>
            <div className="entry-options">
              {mode === "login" ? (
                <>
                  <button
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                    }}
                  >
                    Esqueci minha senha
                  </button>
                  <button
                    onClick={() => {
                      setMode("register");
                      setError("");
                    }}
                  >
                    Criar conta
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMode("login");
                    setError("");
                    setNotice("");
                  }}
                >
                  Voltar ao login
                </button>
              )}
            </div>
            <p className="entry-small">
              <LockKeyhole size={13} /> Seu acesso é protegido. A localização é opcional.
            </p>
          </>
        )}
        {stage === "location" && (
          <>
            <div className="entry-kicker">
              <ShieldCheck size={15} /> ACESSO CONFIRMADO
            </div>
            <div className="entry-location-icon">
              <MapPin size={30} />
            </div>
            <h1 id="entry-title">Veja o mundo a partir de onde você está.</h1>
            <p className="entry-intro">
              Podemos usar sua localização uma vez para aproximar o globo da sua região. Ela não é
              enviada ao servidor.
            </p>
            <button className="entry-primary" disabled={busy} onClick={requestLocation}>
              {busy ? "Aguardando permissão…" : "Usar minha localização"}
              <ArrowRight size={17} />
            </button>
            <button className="entry-skip" onClick={() => continueWithLocation(null)}>
              Continuar sem localização
            </button>
          </>
        )}
        {stage === "welcome" && (
          <>
            <div className="entry-welcome-symbol">
              <Sparkles size={30} />
            </div>
            <h1 id="entry-title">Bem-vindo{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.</h1>
            <p className="entry-intro">Seu monitor está ganhando vida.</p>
          </>
        )}
      </section>
    </div>
  );
}
