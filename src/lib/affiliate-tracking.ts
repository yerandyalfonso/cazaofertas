import { absoluteUrl, marketplaceAbsoluteUrl } from "@/lib/site";

export type AffiliateClickSource =
  | "web"
  | "deal_card"
  | "product_card"
  | "product_page"
  | "offer_page"
  | "blog"
  | "blog_inline"
  | "telegram"
  | "facebook"
  | "admin"
  | "other";

export interface TrackedAffiliateOptions {
  productId: string;
  source?: AffiliateClickSource | string;
  articleId?: string | null;
  /** Marca el clic como prueba (admin / QA). */
  test?: boolean;
  /**
   * ASIN o código de tienda (MV-…, KB-…). Si se pasa, la URL absoluta usa el
   * formato corto /ir/<código>?s=tg en vez de /api/redirect?product=<uuid>.
   */
  code?: string | null;
}

/** Abreviaturas de `source` en los enlaces cortos (?s=tg). */
const SHORT_SOURCES: Record<string, string> = { telegram: "tg", facebook: "fb" };

export function expandAffiliateSource(raw: string | null | undefined): string {
  const value = raw?.trim().slice(0, 64) || "web";
  return (
    Object.entries(SHORT_SOURCES).find(([, short]) => short === value)?.[0] ?? value
  );
}

function buildShortAffiliatePath(code: string, options: TrackedAffiliateOptions): string {
  const params = new URLSearchParams();
  if (options.source) params.set("s", SHORT_SOURCES[options.source] ?? options.source);
  if (options.test) params.set("t", "1");
  const query = params.toString();
  return `/ir/${encodeURIComponent(code.trim())}${query ? `?${query}` : ""}`;
}

/**
 * Ruta relativa de tracking → /api/redirect → Amazon afiliado.
 * Usar en <a href> del sitio.
 */
export function buildTrackedAffiliatePath(
  options: TrackedAffiliateOptions,
): string {
  const params = new URLSearchParams();
  params.set("product", options.productId);
  if (options.source) params.set("source", options.source);
  if (options.articleId) params.set("article", options.articleId);
  if (options.test) params.set("test", "true");
  return `/api/redirect?${params.toString()}`;
}

/** URL absoluta (Telegram, Facebook, emails, etc.). */
export function buildTrackedAffiliateUrl(
  options: TrackedAffiliateOptions,
): string {
  const code = options.code?.trim();
  const path =
    code && !options.articleId
      ? buildShortAffiliatePath(code, options)
      : buildTrackedAffiliatePath(options);
  if (options.source === "telegram" || options.source === "facebook") {
    return marketplaceAbsoluteUrl(path);
  }
  return absoluteUrl(path);
}
