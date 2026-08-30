import { absoluteUrl } from "@/lib/site";

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

/** URL absoluta (Telegram, emails, etc.). */
export function buildTrackedAffiliateUrl(
  options: TrackedAffiliateOptions,
): string {
  return absoluteUrl(buildTrackedAffiliatePath(options));
}
