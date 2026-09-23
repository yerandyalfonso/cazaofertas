import Script from "next/script";

/**
 * Estadísticas de visitas (Umami en el VPS, sin cookies). Caddy expone solo
 * /umami/script.js y /umami/api/send; el tracker envía al mismo prefijo.
 */
export function UmamiScript() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  if (!websiteId || process.env.NODE_ENV !== "production") return null;
  return (
    <Script
      src="/umami/script.js"
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  );
}
