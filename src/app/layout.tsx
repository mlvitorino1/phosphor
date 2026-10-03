import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./admin.css";
import "./news-panel.css";
import "./phosphor.css";
import "./easter-eggs.css";
import { RecruiterEasterEggs } from "@/components/portfolio/recruiter-easter-eggs";

export const metadata: Metadata = {
  applicationName: "Phosphor",
  title: { default: "Phosphor — O mundo muda. Veja onde.", template: "%s | Phosphor" },
  description:
    "Phosphor acompanha eventos relevantes em um mapa vivo, com localização, impacto, atualização e fontes.",
  icons: { icon: "/phosphor-mark.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        {children}
        <RecruiterEasterEggs />
      </body>
    </html>
  );
}
