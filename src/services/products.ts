import {
  extractAsin,
  generateAffiliateUrl,
  generateAmazonUrl,
} from "@/lib/affiliate";
import { resolveAmazonProductCategoryId } from "@/lib/categories";
import { roundMoney, toNumber } from "@/lib/money";
import type { TypedSupabaseClient } from "@/lib/supabase";
import { scrapeAmazonProductPage } from "@/providers/price";
import type { ProductRow } from "@/types/database";
import { ProductAvailability } from "@/types";

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

function slugifyProduct(title: string, asin: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "producto"}-${asin}`.toLowerCase();
}

export interface EnsuredAmazonProduct {
  id: string;
  asin: string;
  title: string;
  amazonUrl: string;
  currentPrice: number | null;
  created: boolean;
}

/**
 * Busca el producto por ASIN o lo crea scrapeando la ficha de Amazon.
 * Así las alertas por URL alimentan el catálogo (ofertas, blog, crons).
 */
export async function ensureProductFromAmazonUrl(
  client: TypedSupabaseClient,
  urlOrAsin: string,
  options?: { scrape?: boolean },
): Promise<EnsuredAmazonProduct> {
  const asin = extractAsin(urlOrAsin)?.toUpperCase();
  if (!asin) {
    throw new Error("URL o ASIN de Amazon no válidos.");
  }

  const amazonUrl = /https?:\/\//i.test(urlOrAsin.trim())
    ? urlOrAsin.trim()
    : generateAmazonUrl(asin);

  const { data: existing, error: lookupError } = await client
    .from("products")
    .select("id, asin, title, amazon_url, current_price, image_url, brand, category_id")
    .eq("asin", asin)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (existing) {
    const needsMedia =
      options?.scrape !== false &&
      (!existing.image_url || !existing.brand);
    const needsCategory = options?.scrape !== false && !existing.category_id;

    if (needsMedia || needsCategory) {
      try {
        const quote = await scrapeAmazonProductPage(amazonUrl, asin, {
          timeoutMs: 12_000,
        });
        const patch: {
          image_url?: string;
          brand?: string | null;
          category_id?: string | null;
          updated_at: string;
        } = { updated_at: new Date().toISOString() };
        if (!existing.image_url && quote.imageUrl) {
          patch.image_url = quote.imageUrl;
        }
        if (!existing.brand && quote.brand) {
          patch.brand = quote.brand;
        }
        if (needsCategory) {
          const categoryId = await resolveAmazonProductCategoryId(client, {
            categorySlug: quote.categorySlug,
            title: quote.title ?? existing.title,
            brand: quote.brand ?? existing.brand,
          });
          if (categoryId) patch.category_id = categoryId;
        }
        if (patch.image_url || patch.brand || patch.category_id) {
          await client.from("products").update(patch).eq("id", existing.id);
        }
      } catch {
        // Mantener el producto existente aunque falle el backfill de media.
      }
    }

    return {
      id: existing.id,
      asin: existing.asin,
      title: existing.title,
      amazonUrl: existing.amazon_url || amazonUrl,
      currentPrice: toNumber(existing.current_price),
      created: false,
    };
  }

  if (options?.scrape === false) {
    throw new Error(`Producto ${asin} no está en catálogo.`);
  }

  const quote = await scrapeAmazonProductPage(amazonUrl, asin, {
    timeoutMs: 12_000,
  });

  if (quote.price === null) {
    throw new Error(
      quote.availability === ProductAvailability.OUT_OF_STOCK
        ? "El producto está agotado en Amazon."
        : "No se pudo obtener el precio en Amazon.",
    );
  }

  const price = roundMoney(quote.price);
  const previous =
    quote.previousPrice != null ? roundMoney(quote.previousPrice) : price;
  const title = (quote.title?.trim() || `Producto Amazon ${asin}`).slice(0, 200);
  const slug = slugifyProduct(title, asin);
  const now = new Date().toISOString();
  const discount =
    previous > price ? roundMoney(((previous - price) / previous) * 100) : 0;
  const categoryId = await resolveAmazonProductCategoryId(client, {
    categorySlug: quote.categorySlug,
    title,
    brand: quote.brand,
  });

  const { error: slugCleanupError } = await client
    .from("products")
    .delete()
    .eq("slug", slug)
    .neq("asin", asin);

  if (slugCleanupError) {
    throw new Error(slugCleanupError.message);
  }

  const { data: inserted, error: insertError } = await client
    .from("products")
    .insert({
      asin,
      title,
      slug,
      amazon_url: quote.amazonUrl ?? amazonUrl,
      affiliate_url: generateAffiliateUrl({
        amazon_url: quote.amazonUrl ?? amazonUrl,
        asin,
      }),
      image_url: quote.imageUrl ?? null,
      brand: quote.brand ?? null,
      category_id: categoryId,
      current_price: price,
      previous_price: previous,
      lowest_price: price,
      highest_price: Math.max(price, previous),
      discount_percentage: discount,
      currency: quote.currency || "EUR",
      availability: quote.availability ?? ProductAvailability.IN_STOCK,
      is_active: true,
      last_checked_at: now,
      updated_at: now,
    })
    .select("id, asin, title, amazon_url, current_price")
    .single();

  if (insertError) {
    if (
      insertError.code === "23505" ||
      /duplicate|unique/i.test(insertError.message)
    ) {
      const { data: raced } = await client
        .from("products")
        .select("id, asin, title, amazon_url, current_price")
        .eq("asin", asin)
        .maybeSingle();
      if (raced) {
        return {
          id: raced.id,
          asin: raced.asin,
          title: raced.title,
          amazonUrl: raced.amazon_url || amazonUrl,
          currentPrice: toNumber(raced.current_price),
          created: false,
        };
      }
    }
    throw new Error(insertError.message);
  }

  await client.from("price_history").insert({
    product_id: inserted.id,
    price,
    source: "amazon",
  });

  return {
    id: inserted.id,
    asin: inserted.asin,
    title: inserted.title,
    amazonUrl: inserted.amazon_url || amazonUrl,
    currentPrice: toNumber(inserted.current_price),
    created: true,
  };
}
