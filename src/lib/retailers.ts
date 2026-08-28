import { generateAffiliateUrl, type AffiliateProductInput } from "@/lib/affiliate";

export const PRODUCT_RETAILERS = ["amazon", "kiabi", "carrefour"] as const;
export type ProductRetailer = (typeof PRODUCT_RETAILERS)[number];

export function isProductRetailer(value: string): value is ProductRetailer {
  return (PRODUCT_RETAILERS as readonly string[]).includes(value);
}

export function normalizeRetailer(
  value: string | null | undefined,
): ProductRetailer {
  if (value && isProductRetailer(value)) return value;
  return "amazon";
}

/** ID sintético en `products.asin` para no romper el esquema legacy. */
export function syntheticAsinForRetailer(
  retailer: ProductRetailer,
  externalId: string,
): string {
  const clean = externalId.trim().toUpperCase();
  if (retailer === "amazon") return clean;
  if (retailer === "kiabi") return `KB-${clean}`;
  if (retailer === "carrefour") return `CF-${clean}`;
  return `RT-${clean}`;
}

export function extractKiabiProductId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const fromUrl = trimmed.match(/_(P\d+C\d+)/i);
  if (fromUrl?.[1]) return fromUrl[1].toUpperCase();

  if (/^P\d+C\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

export function isKiabiProductUrl(url: string): boolean {
  return /kiabi\.(es|com|fr)/i.test(url) && Boolean(extractKiabiProductId(url));
}

export function normalizeKiabiProductUrl(url: string): string {
  const parsed = new URL(url.trim());
  parsed.hash = "";
  return parsed.toString();
}

export interface ProductLinkFields {
  retailer?: string | null;
  asin?: string | null;
  external_id?: string | null;
  product_url?: string | null;
  amazon_url?: string | null;
  affiliate_url?: string | null;
}

/** URL pública del producto (catálogo, redirects). */
export function resolveProductPageUrl(product: ProductLinkFields): string {
  return (
    product.product_url?.trim() ||
    product.amazon_url?.trim() ||
    (product.asin && normalizeRetailer(product.retailer) === "amazon"
      ? `https://www.amazon.es/dp/${product.asin}`
      : "")
  );
}

/**
 * URL de compra/afiliado.
 * Amazon: tag de afiliado. Otras tiendas: affiliate_url o product_url directo.
 */
export function resolveProductBuyUrl(product: ProductLinkFields): string {
  if (product.affiliate_url?.trim()) {
    return product.affiliate_url.trim();
  }

  const retailer = normalizeRetailer(product.retailer);
  if (retailer === "amazon") {
    const input: AffiliateProductInput = {
      amazon_url: product.amazon_url ?? product.product_url,
      affiliate_url: product.affiliate_url,
      asin: product.asin,
    };
    return generateAffiliateUrl(input);
  }

  const direct = resolveProductPageUrl(product);
  if (!direct) {
    throw new Error("No se pudo resolver URL de compra para el producto.");
  }
  return direct;
}

export function retailerLabel(retailer: string | null | undefined): string {
  switch (normalizeRetailer(retailer)) {
    case "kiabi":
      return "Kiabi";
    case "carrefour":
      return "Carrefour";
    default:
      return "Amazon";
  }
}

/** CTA principal en ficha de producto: "Ir a Kiabi", "Ir a Amazon", etc. */
export function retailerBuyCtaLabel(retailer: string | null | undefined): string {
  return `Ir a ${retailerLabel(retailer)}`;
}

/** CTA en tarjetas y listados: "Ver en Kiabi", etc. */
export function retailerViewCtaLabel(retailer: string | null | undefined): string {
  return `Ver en ${retailerLabel(retailer)}`;
}
