import "server-only";
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendEmail(to: string, subject: string, text: string) {
  if (!emailConfigured()) throw new Error("Envio de e-mail não configurado");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to, subject, text }),
  });
  if (!response.ok) throw new Error(`Serviço de e-mail respondeu ${response.status}`);
  return response.json() as Promise<{ id: string }>;
}
