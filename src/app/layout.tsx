import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "CazaOferta — Revista de chollos Amazon",
    template: "%s · CazaOferta",
  },
  description:
    "Ofertas reales de Amazon España, puntuadas por bajada y mínimo histórico. Alertas por Telegram.",
  openGraph: {
    type: "website",
    locale: "es_ES",
    siteName: "CazaOferta",
    title: "CazaOferta — Revista de chollos Amazon",
    description:
      "Ofertas reales de Amazon España, puntuadas por bajada y mínimo histórico.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
