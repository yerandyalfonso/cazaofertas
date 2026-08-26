import { extractAsin, generateAmazonUrl } from "@/lib/affiliate";
import type { ProductRow } from "@/types/database";

const AMAZON_HOST =
  /amazon\.(es|com|co\.uk|de|fr|it|nl|se|pl|com\.mx|com\.br|ca|in|com\.au)$/i;

/** Producto con campos de precio y URL usados por detección / afiliados. */
export type ProductWithPricing = Pick<
  ProductRow,
  | "id"
  | "asin"
  | "title"
  | "slug"
  | "amazon_url"
  | "affiliate_url"
  | "current_price"
  | "previous_price"
  | "lowest_price"
  | "highest_price"
  | "discount_percentage"
  | "currency"
  | "is_active"
  | "brand"
  | "image_url"
  | "category_id"
>;

export function isValidAmazonUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const host = url.hostname.replace(/^www\./, "");
    return AMAZON_HOST.test(host);
  } catch {
    return false;
  }
}

export function resolveProductAmazonUrl(
  product: Pick<ProductRow, "amazon_url" | "asin">,
): string | null {
  if (isValidAmazonUrl(product.amazon_url)) {
    return product.amazon_url!.trim();
  }
  if (product.asin) {
    return generateAmazonUrl(product.asin);
  }
  return null;
}

export function productHasMonitorableUrl(
  product: Pick<ProductRow, "amazon_url" | "asin">,
): boolean {
  return Boolean(resolveProductAmazonUrl(product));
}

export function buildAsinUrlMap(
  products: Array<Pick<ProductRow, "asin" | "amazon_url">>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const product of products) {
    const url = resolveProductAmazonUrl(product);
    if (url) {
      map.set(product.asin, url);
    }
  }
  return map;
}

export function normalizeAsinFromUrl(url: string): string | null {
  return extractAsin(url);
}
