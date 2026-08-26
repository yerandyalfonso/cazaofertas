import { generateAffiliateUrl } from "@/lib/affiliate";
import { toNumber } from "@/lib/money";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { dealScoringService } from "@/services/deal-scoring";
import { DealLevel } from "@/types";
import type { Database } from "@/types/database";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export interface CatalogProduct {
  id: string;
  asin: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  currentPrice: number;
  previousPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  discountPercentage: number;
  currency: string;
  isFeatured: boolean;
  lastCheckedAt: string | null;
  affiliateUrl: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  dealLevel: DealLevel;
  dealScore: number;
  dealLabel: string;
}

type ProductWithCategory = ProductRow & {
  categories?:
    | Pick<CategoryRow, "id" | "name" | "slug">
    | Pick<CategoryRow, "id" | "name" | "slug">[]
    | null;
};

export function toCatalogProduct(product: ProductWithCategory): CatalogProduct {
  return mapProduct(product);
}

function mapProduct(product: ProductWithCategory): CatalogProduct {
  const categoryRaw = product.categories;
  const category = Array.isArray(categoryRaw)
    ? (categoryRaw[0] ?? null)
    : (categoryRaw ?? null);

  const currentPrice = toNumber(product.current_price) ?? 0;
  const previousPrice = toNumber(product.previous_price);
  const lowestPrice = toNumber(product.lowest_price);
  const scoring = dealScoringService.scoreProduct({
    currentPrice,
    previousPrice,
    lowestPrice,
    categorySlug: category?.slug,
  });

  return {
    id: product.id,
    asin: product.asin,
    title: product.title,
    slug: product.slug,
    description: product.description,
    imageUrl: product.image_url,
    brand: product.brand,
    currentPrice,
    previousPrice,
    lowestPrice,
    highestPrice: toNumber(product.highest_price),
    discountPercentage:
      toNumber(product.discount_percentage) ?? scoring.discountPercentage,
    currency: product.currency,
    isFeatured: product.is_featured,
    lastCheckedAt: product.last_checked_at,
    affiliateUrl: generateAffiliateUrl({
      asin: product.asin,
      amazon_url: product.amazon_url,
      affiliate_url: product.affiliate_url,
    }),
    category: category
      ? { id: category.id, name: category.name, slug: category.slug }
      : null,
    dealLevel: scoring.level,
    dealScore: scoring.score,
    dealLabel: scoring.label,
  };
}

function getClient() {
  try {
    return createSupabaseServiceClient();
  } catch {
    return null;
  }
}

export async function getActiveProducts(limit = 24): Promise<CatalogProduct[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("products")
    .select("*, categories(id, name, slug)")
    .eq("is_active", true)
    .order("discount_percentage", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) {
    console.error("[catalog] getActiveProducts", error?.message);
    return [];
  }

  return data.map((row) => mapProduct(row));
}

export async function getFeaturedProducts(limit = 4): Promise<CatalogProduct[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("products")
    .select("*, categories(id, name, slug)")
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("discount_percentage", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) {
    console.error("[catalog] getFeaturedProducts", error?.message);
    return [];
  }

  return data.map((row) => mapProduct(row));
}

export async function getTopDealProducts(limit = 8): Promise<CatalogProduct[]> {
  const products = await getActiveProducts(40);
  return products
    .filter((product) => product.dealLevel !== DealLevel.NORMAL)
    .sort((a, b) => b.dealScore - a.dealScore)
    .slice(0, limit);
}

export async function getProductBySlug(
  slug: string,
): Promise<CatalogProduct | null> {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from("products")
    .select("*, categories(id, name, slug)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    console.error("[catalog] getProductBySlug", error?.message);
    return null;
  }

  return mapProduct(data);
}

export async function getProductsBySlugs(
  slugs: string[],
): Promise<CatalogProduct[]> {
  if (slugs.length === 0) return [];

  const client = getClient();
  if (!client) return [];

  const unique = [...new Set(slugs)];
  const { data, error } = await client
    .from("products")
    .select("*, categories(id, name, slug)")
    .in("slug", unique)
    .eq("is_active", true);

  if (error || !data) {
    console.error("[catalog] getProductsBySlugs", error?.message);
    return [];
  }

  const bySlug = new Map(data.map((row) => [row.slug, mapProduct(row)]));
  return unique
    .map((slug) => bySlug.get(slug))
    .filter((product): product is CatalogProduct => Boolean(product));
}

export async function getPriceHistory(
  productId: string,
  limit = 30,
): Promise<Array<{ price: number; timestamp: string }>> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("price_history")
    .select("price, timestamp")
    .eq("product_id", productId)
    .order("timestamp", { ascending: true })
    .limit(limit);

  if (error || !data) {
    console.error("[catalog] getPriceHistory", error?.message);
    return [];
  }

  return data.map((row) => ({
    price: toNumber(row.price) ?? 0,
    timestamp: row.timestamp,
  }));
}

export async function getCategories(): Promise<CategoryRow[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data) {
    console.error("[catalog] getCategories", error?.message);
    return [];
  }

  return data;
}

export const TELEGRAM_BOT_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ??
  "https://t.me/cazandor_de_ofertas_bot";
