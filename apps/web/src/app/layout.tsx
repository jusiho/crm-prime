import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/providers";

export const metadata: Metadata = {
  title: "Trimmo — Vende por WhatsApp con agentes de IA",
  description:
    "El CRM con agentes de IA que responde, califica y agenda a tus leads en segundos, 24/7, directo en tu número de WhatsApp.",
  openGraph: {
    title: "Trimmo — Convierte WhatsApp en tu mejor vendedor",
    description:
      "Agentes de IA que atienden, califican y agendan tus leads de WhatsApp las 24 horas. Bandeja en tiempo real, pipeline, campañas y flujos sin código.",
    type: "website",
    locale: "es_ES",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
