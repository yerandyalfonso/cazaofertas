import type { Metadata } from "next";
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
    "Marketplace de ofertas: filtra por categoría, tienda y descuento. Los mejores chollos del día en un solo sitio.",
  metadataBase: new URL(getSiteUrl()),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "es_ES",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${dmSans.variable} antialiased`}>
        {children}
        <UmamiScript />
      </body>
    </html>
  );
}
