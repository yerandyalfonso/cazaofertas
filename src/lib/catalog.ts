import {
  categoryPublicPath,
  childSlugFromSubcategory,
  resolveCategoryDisplayMeta,
  resolveParentSlug,
} from "@/lib/category-taxonomy";
import {
  normalizeRetailer,
  resolveProductBuyUrl,
  resolveProductPageUrl,
  type ProductRetailer,
} from "@/lib/retailers";
import { toNumber } from "@/lib/money";
import { withRetry } from "@/lib/retry";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { dealScoringService } from "@/services/deal-scoring";
import { DealLevel, ProductAvailability } from "@/types";
import type { Database } from "@/types/database";
import { unstable_cache } from "next/cache";
import { cache } from "react";

const CATEGORY_SELECT =
  "*, categories(id, name, slug, parent_id, parent:parent_id(id, name, slug))";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export interface CatalogProduct {
  id: string;
  asin: string;
  retailer: ProductRetailer;
  externalId: string | null;
  productUrl: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  currentPrice: number;
  previousPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  averagePrice30d: number | null;
  averagePrice90d: number | null;
  discountPercentage: number;
  currency: string;
  availability: ProductAvailability;
  isFeatured: boolean;
  lastCheckedAt: string | null;
  affiliateUrl: string;
  category: {
    id: string;
    name: string;
    slug: string;
    parentSlug: string | null;
    parentName: string | null;
    childSlug: string | null;
    path: string;
  } | null;
  dealLevel: DealLevel;
  dealScore: number;
  dealLabel: string;
}

export interface PriceHistoryResult {
  points: Array<{ price: number; timestamp: string }>;
  averagePrice30d: number | null;
  averagePrice90d: number | null;
}

type CategoryWithParent = Pick<CategoryRow, "id" | "name" | "slug"> & {
  parent_id?: string | null;
  parent?:
    | Pick<CategoryRow, "id" | "name" | "slug">
    | Pick<CategoryRow, "id" | "name" | "slug">[]
    | null;
};

type ProductWithCategory = ProductRow & {
  categories?: CategoryWithParent | CategoryWithParent[] | null;
};

export function toCatalogProduct(product: ProductWithCategory): CatalogProduct {
  return mapProduct(product);
}

function mapProduct(product: ProductWithCategory): CatalogProduct {
  const categoryRaw = product.categories;
  const categoryNode = Array.isArray(categoryRaw)
    ? (categoryRaw[0] ?? null)
    : (categoryRaw ?? null);
  const parentRaw = categoryNode?.parent;
  const parentNode = Array.isArray(parentRaw)
    ? (parentRaw[0] ?? null)
    : (parentRaw ?? null);

  const subSlug = categoryNode?.slug ?? null;
  const display = subSlug
    ? resolveCategoryDisplayMeta(subSlug, parentNode?.slug ?? null)
    : null;
  const parentSlug =
    parentNode?.slug ??
    display?.parentSlug ??
    (subSlug ? resolveParentSlug(subSlug, parentNode?.slug ?? null) : null);
  const parentName = parentNode?.name ?? display?.parentName ?? null;
  const subcategoryName =
    categoryNode?.name ?? display?.subcategoryName ?? null;
  const childSlug = subSlug
    ? childSlugFromSubcategory(subSlug, parentSlug)
    : null;

  const currentPrice = toNumber(product.current_price) ?? 0;
  const previousPrice = toNumber(product.previous_price);
  const lowestPrice = toNumber(product.lowest_price);
  const scoring = dealScoringService.scoreProduct({
    currentPrice,
    previousPrice,
    lowestPrice,
    categorySlug: parentSlug ?? subSlug ?? "otros",
  });

  const retailer = normalizeRetailer(product.retailer);
  const productUrl = resolveProductPageUrl(product);

  return {
    id: product.id,
    asin: product.asin,
    retailer,
    externalId: product.external_id ?? (retailer === "amazon" ? product.asin : null),
    productUrl,
    title: product.title,
    slug: product.slug,
    description: product.description,
    imageUrl: product.image_url,
    brand: product.brand,
    currentPrice,
    previousPrice,
    lowestPrice,
    highestPrice: toNumber(product.highest_price),
    averagePrice30d: toNumber(product.average_price_30d),
    averagePrice90d: toNumber(product.average_price_90d),
    discountPercentage:
      toNumber(product.discount_percentage) ?? scoring.discountPercentage,
    currency: product.currency,
    availability: product.availability ?? ProductAvailability.UNKNOWN,
    isFeatured: product.is_featured,
    lastCheckedAt: product.last_checked_at,
    affiliateUrl: (() => {
      try {
        return resolveProductBuyUrl(product);
      } catch {
        return product.affiliate_url?.trim() || productUrl || product.amazon_url;
      }
    })(),
    category: categoryNode
      ? {
          id: categoryNode.id,
          name: subcategoryName ?? categoryNode.name,
          slug: categoryNode.slug,
          parentSlug: parentSlug ?? null,
          parentName,
          childSlug,
          path: parentSlug
            ? categoryPublicPath(parentSlug, subSlug)
            : `/categorias/${categoryNode.slug}`,
        }
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

export async function getActiveProducts(
  limit = 24,
  options?: { orderBy?: "discount" | "created" | "updated" },
): Promise<CatalogProduct[]> {
  const client = getClient();
  if (!client) return [];

  const orderBy = options?.orderBy ?? "discount";
  let query = client
    .from("products")
    .select(CATEGORY_SELECT)
    .eq("is_active", true);

  if (orderBy === "created") {
    query = query.order("created_at", { ascending: false });
  } else if (orderBy === "updated") {
    query = query.order("updated_at", { ascending: false });
  } else {
    query = query.order("discount_percentage", {
      ascending: false,
      nullsFirst: false,
    });
  }

  const { data, error } = await query.limit(limit);

  if (error || !data) {
    console.error("[catalog] getActiveProducts", error?.message);
    return [];
  }

  return data.map((row) => mapProduct(row));
}

/**
 * Listado de ofertas: mezcla recientes (flash nuevos) + mayor descuento,
 * luego ordena por deal score. Evita que solo salgan los top por %.
 */
export async function getOfferListingProducts(
  limit = 150,
): Promise<CatalogProduct[]> {
  const client = getClient();
  if (!client) return [];

  const half = Math.max(Math.ceil(limit / 2), 48);
  const select = CATEGORY_SELECT;

  const [recentRes, discountRes] = await Promise.all([
    client
      .from("products")
      .select(select)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(half),
    client
      .from("products")
      .select(select)
      .eq("is_active", true)
      .order("discount_percentage", { ascending: false, nullsFirst: false })
      .limit(half),
  ]);

  if (recentRes.error) {
    console.error("[catalog] getOfferListingProducts recent", recentRes.error.message);
  }
  if (discountRes.error) {
    console.error(
      "[catalog] getOfferListingProducts discount",
      discountRes.error.message,
    );
  }

  const byId = new Map<string, CatalogProduct>();
  for (const row of [...(recentRes.data ?? []), ...(discountRes.data ?? [])]) {
    byId.set(row.id, mapProduct(row));
  }

  return [...byId.values()]
    .sort((a, b) => {
      if (b.dealScore !== a.dealScore) return b.dealScore - a.dealScore;
      return b.discountPercentage - a.discountPercentage;
    })
    .slice(0, limit);
}

export async function getFeaturedProducts(limit = 4): Promise<CatalogProduct[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("products")
    .select(CATEGORY_SELECT)
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
  const products = await getOfferListingProducts(Math.max(limit * 6, 96));
  return products
    .filter((product) => product.dealLevel !== DealLevel.NORMAL)
    .sort((a, b) => b.dealScore - a.dealScore)
    .slice(0, limit);
}

async function loadProductBySlug(
  slug: string,
): Promise<CatalogProduct | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const data = await withRetry(async () => {
      const { data: row, error } = await client
        .from("products")
        .select(CATEGORY_SELECT)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return row;
    });

    if (!data) return null;
    return mapProduct(data);
  } catch (error) {
    console.error(
      "[catalog] getProductBySlug",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export const getProductBySlug = cache((slug: string) =>
  unstable_cache(
    () => loadProductBySlug(slug),
    ["catalog-product", slug],
    { revalidate: 300 },
  )(),
);

async function loadProductsBySlugs(
  slugs: string[],
): Promise<CatalogProduct[]> {
  if (slugs.length === 0) return [];

  const client = getClient();
  if (!client) return [];

  const unique = [...new Set(slugs)];

  try {
    const data = await withRetry(async () => {
      const { data: rows, error } = await client
        .from("products")
        .select(CATEGORY_SELECT)
        .in("slug", unique)
        .eq("is_active", true);

      if (error) throw new Error(error.message);
      return rows ?? [];
    });

    const bySlug = new Map(data.map((row) => [row.slug, mapProduct(row)]));
    return unique
      .map((slug) => bySlug.get(slug))
      .filter((product): product is CatalogProduct => Boolean(product));
  } catch (error) {
    console.error(
      "[catalog] getProductsBySlugs",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export const getProductsBySlugs = cache((slugs: string[]) =>
  unstable_cache(
    () => loadProductsBySlugs(slugs),
    ["catalog-products", ...[...new Set(slugs)].sort()],
    { revalidate: 300 },
  )(),
);

export interface GetPriceHistoryOptions {
  /** @deprecated Histórico desactivado para liberar recursos. */
  days?: number;
  fetchLimit?: number;
  maxPoints?: number;
}

/** Histórico desactivado: no lee `price_history`. Se mantiene la firma por compat. */
export async function getPriceHistory(
  _productId: string,
  _options: GetPriceHistoryOptions | number = {},
): Promise<PriceHistoryResult> {
  return {
    points: [],
    averagePrice30d: null,
    averagePrice90d: null,
  };
}

export async function getCategories(): Promise<CategoryRow[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .eq("show_in_blog", true)
    .is("parent_id", null)
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

export interface CategoryShowcase {
  /** Nº de productos activos en la categoría (incluye subcategorías). */
  count: number;
  /** Mayor descuento activo, en %. */
  maxDiscount: number;
}

/** Datos para las tarjetas de «Compra por categoría», agrupados por categoría raíz (slug). */
export async function getCategoryShowcases(): Promise<
  Map<string, CategoryShowcase>
> {
  return new Map(await loadCategoryShowcasesCached());
}

// Recuento de todo el catálogo: caché de 10 minutos (Map no se serializa, por eso entradas).
const loadCategoryShowcasesCached = unstable_cache(
  async () => [...(await loadCategoryShowcases()).entries()],
  ["category-showcases"],
  { revalidate: 600 },
);

async function loadCategoryShowcases(): Promise<Map<string, CategoryShowcase>> {
  const showcases = new Map<string, CategoryShowcase>();
  const client = getClient();
  if (!client) return showcases;

  // Supabase devuelve como mucho 1.000 filas por consulta: se lee por páginas.
  const PAGE = 1000;
  const data: unknown[] = [];
  for (let from = 0; from < 20_000; from += PAGE) {
    const { data: page, error } = await client
      .from("products")
      .select("discount_percentage, categories(slug, parent:parent_id(slug))")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !page) {
      console.error("[catalog] getCategoryShowcases", error?.message);
      break;
    }
    data.push(...page);
    if (page.length < PAGE) break;
  }

  type Slugged = { slug: string } | { slug: string }[] | null;
  const one = (value: Slugged) =>
    Array.isArray(value) ? (value[0] ?? null) : value;

  for (const row of data as Array<{
    discount_percentage: number | null;
    categories:
      | ({ slug: string; parent: Slugged } | { slug: string; parent: Slugged }[])
      | null;
  }>) {
    const category = Array.isArray(row.categories)
      ? row.categories[0]
      : row.categories;
    if (!category) continue;
    const rootSlug = one(category.parent)?.slug ?? category.slug;

    const entry = showcases.get(rootSlug) ?? {
      count: 0,
      maxDiscount: 0,
    };
    entry.count += 1;
    entry.maxDiscount = Math.max(
      entry.maxDiscount,
      Math.round(row.discount_percentage ?? 0),
    );
    showcases.set(rootSlug, entry);
  }

  return showcases;
}

/** Buscador de la cabecera: productos activos cuyo título contiene el texto. */
export async function searchProducts(
  query: string,
  limit = 4,
): Promise<CatalogProduct[]> {
  const client = getClient();
  const term = query.trim().replace(/[%_,()]/g, " ").trim();
  if (!client || term.length < 2) return [];

  const { data, error } = await client
    .from("products")
    .select(CATEGORY_SELECT)
    .eq("is_active", true)
    .ilike("title", `%${term}%`)
    .order("discount_percentage", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) {
    console.error("[catalog] searchProducts", error?.message);
    return [];
  }
  return data.map((row) => mapProduct(row));
}

/** Ofertas que la página de categoría pinta en el HTML; el resto llega por tandas. */
export const CATEGORY_FIRST_PAGE = 48;

/** Tamaño de cada tanda que pide la rejilla al hacer scroll. */
export const CATEGORY_PAGE_SIZE = 24;

const CATEGORY_CACHE_TTL_MS = 60_000;
const categoryProductsCache = new Map<
  string,
  { expires: number; products: Promise<CatalogProduct[]> }
>();

/**
 * Todas las ofertas activas de una categoría raíz (incluye sus subcategorías),
 * mejor puntuadas primero. Consulta directa por categoría: no depende del top
 * global. Se guarda un minuto en memoria para que las tandas del scroll no
 * repitan la consulta (no cabe en `unstable_cache`: las grandes pasan de 2 MB).
 */
export function getCategoryProducts(
  rootSlug: string,
): Promise<CatalogProduct[]> {
  const now = Date.now();
  const cached = categoryProductsCache.get(rootSlug);
  if (cached && cached.expires > now) return cached.products;

  const products = loadCategoryProducts(rootSlug).catch((error) => {
    categoryProductsCache.delete(rootSlug);
    throw error;
  });
  categoryProductsCache.set(rootSlug, {
    expires: now + CATEGORY_CACHE_TTL_MS,
    products,
  });
  return products;
}

async function loadCategoryProducts(
  rootSlug: string,
): Promise<CatalogProduct[]> {
  const client = getClient();
  if (!client) return [];

  const { data: cats, error: catError } = await client
    .from("categories")
    .select("id, slug, parent:parent_id(slug)");
  if (catError || !cats) {
    console.error("[catalog] getCategoryProducts categories", catError?.message);
    return [];
  }

  type Slugged = { slug: string } | { slug: string }[] | null;
  const parentSlug = (parent: Slugged) =>
    (Array.isArray(parent) ? parent[0] : parent)?.slug ?? null;
  const ids = (cats as Array<{ id: string; slug: string; parent: Slugged }>)
    .filter((cat) => cat.slug === rootSlug || parentSlug(cat.parent) === rootSlug)
    .map((cat) => cat.id);
  if (ids.length === 0) return [];

  // Supabase devuelve como mucho 1.000 filas por consulta: se lee por páginas.
  const PAGE = 1000;
  const rows: ProductWithCategory[] = [];
  for (let from = 0; from < 20_000; from += PAGE) {
    const { data, error } = await client
      .from("products")
      .select(CATEGORY_SELECT)
      .eq("is_active", true)
      .in("category_id", ids)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) {
      console.error("[catalog] getCategoryProducts", error?.message);
      break;
    }
    rows.push(...(data as ProductWithCategory[]));
    if (data.length < PAGE) break;
  }

  return rows
    .map((row) => mapProduct(row))
    .sort(
      (a, b) =>
        b.dealScore - a.dealScore || b.discountPercentage - a.discountPercentage,
    );
}
