import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://chollosdehoy.com",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${dmSans.variable} antialiased`}>{children}</body>
    </html>
  );
}
