import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Navegacao } from "@/componentes/Navegacao";
import { RegistrarServiceWorker } from "@/componentes/RegistrarServiceWorker";
import { PlanoProvider } from "@/estado/PlanoContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Método Horizonte",
  description: "Planejamento financeiro pessoal e familiar com visão de longo prazo.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone.svg", apple: "/icone.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f6feb",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <PlanoProvider>
          <Navegacao />
          {children}
        </PlanoProvider>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
