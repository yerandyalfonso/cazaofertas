/** Dominio público del marketplace (Caddy → :3001). */
const PRODUCTION_SITE_URL = "https://chollosdhoy.com";

/**
 * URL base para canonical, sitemap y Open Graph. Nunca localhost en
 * producción: un canonical a localhost desindexaría todo el sitio.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (
    explicit &&
    !(process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/.test(explicit))
  ) {
    return explicit;
  }
  return PRODUCTION_SITE_URL;
}

export function absoluteUrl(path: string): string {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_NAME = "Chollos de Hoy";
