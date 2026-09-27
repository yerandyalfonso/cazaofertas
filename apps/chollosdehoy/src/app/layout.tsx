import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { UmamiScript } from "@/components/UmamiScript";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Chollos de Hoy — Ofertas y descuentos",
    template: "%s | Chollos de Hoy",
  },
  description:
    "Chollos de Amazon, Miravia y otras tiendas con el precio comprobado. Filtra por categoría, tienda y descuento, y crea alertas en Telegram.",
  metadataBase: new URL(getSiteUrl()),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#faf7f4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${dmSans.variable} antialiased`}>
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        {children}
        <UmamiScript />
      </body>
    </html>
  );
}
