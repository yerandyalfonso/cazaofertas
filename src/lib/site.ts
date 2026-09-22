/**
 * URL pública del sitio (previews OG, enlaces Telegram “Ver en la web”).
 */
function normalizeSiteBase(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalDevHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local")
  );
}

function vercelProductionSiteUrl(): string | null {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) {
    return `https://${normalizeSiteBase(vercel)}`;
  }
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return `https://${normalizeSiteBase(vercelUrl)}`;
  }
  return null;
}

export function getSiteUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim();
  if (explicit) {
    return normalizeSiteBase(explicit);
  }

  return vercelProductionSiteUrl() ?? "https://cazaofertas-olive.vercel.app";
}

/**
 * URL HTTPS para botones/enlaces de Telegram (nunca localhost).
 * Prioridad: TELEGRAM_SITE_URL → sitio público no local → Vercel → fallback prod.
 */
export function getTelegramSiteUrl(): string {
  const telegramExplicit = process.env.TELEGRAM_SITE_URL?.trim();
  if (telegramExplicit) {
    return normalizeSiteBase(telegramExplicit);
  }

  const explicit =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim();
  if (explicit) {
    try {
      const parsed = new URL(explicit);
      if (parsed.protocol === "https:" && !isLocalDevHost(parsed.hostname)) {
        return normalizeSiteBase(explicit);
      }
    } catch {
      // ignore malformed URL
    }
  }

  return vercelProductionSiteUrl() ?? "https://cazaofertas-olive.vercel.app";
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function telegramAbsoluteUrl(path: string): string {
  const base = getTelegramSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * URL del marketplace (Chollos de Hoy), donde vive la ficha de producto
 * pública (`/oferta/[slug]`). Los enlaces "Ver en la web" de Telegram/
 * Facebook deben apuntar aquí en vez de al blog, porque el producto ya
 * existe en el marketplace.
 */
export function getMarketplaceSiteUrl(): string {
  const explicit = process.env.MARKETPLACE_SITE_URL?.trim();
  if (explicit) {
    return normalizeSiteBase(explicit);
  }
  return "https://chollosdhoy.com";
}

export function marketplaceAbsoluteUrl(path: string): string {
  const base = getMarketplaceSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Handle de Instagram / redes para carruseles y pie de tarjetas. */
export function getSocialHandle(): string {
  const raw = process.env.NEXT_PUBLIC_SOCIAL_HANDLE?.trim();
  if (raw) {
    return raw.startsWith("@") ? raw : `@${raw}`;
  }
  return "@cazaoferta";
}
