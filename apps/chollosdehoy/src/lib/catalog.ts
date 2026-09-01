import { resolveParentSlug } from "@/lib/taxonomy";
import {
  calculateDiscountPercentage,
  toNumber,
} from "@/lib/money";
import type { MarketplaceFilters } from "@/lib/filters";
import { MARKETPLACE_PAGE_SIZE } from "@/lib/coupons";
import { getActiveCoupons } from "@/lib/coupons-db";
import type { MarketplaceBootstrap, PaginatedProducts } from "@/lib/marketplace-types";
import { getSupabaseServer } from "@/lib/supabase";
import {
  DealLevel,
  type CategoryFilterNode,
  type MarketplaceProduct,
  type MarketplaceStats,
  type SortOption,
} from "@/lib/types";

const CATEGORY_SELECT =
  "*, categories(id, name, slug, parent_id, parent:parent_id(id, name, slug))";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

type ProductRow = {
  id: string;
  asin: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  brand: string | null;
  retailer: string | null;
  current_price: number | string | null;
  previous_price: number | string | null;
  lowest_price: number | string | null;
  discount_percentage: number | string | null;
  affiliate_url: string | null;
  amazon_url: string | null;
  product_url: string | null;
  is_featured: boolean | null;
  created_at: string;
  category_id: string | null;
  categories?:
    | {
        id: string;
        name: string;
        slug: string;
        parent_id?: string | null;
        parent?:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        parent_id?: string | null;
        parent?:
          | { id: string; name: string; slug: string }
          | { id: string; name: string; slug: string }[]
          | null;
      }[]
    | null;
};

function scoreProduct(input: {
  currentPrice: number;
  previousPrice: number | null;
  lowestPrice: number | null;
  discountPercentage: number;
}): { level: DealLevel; score: number; label: string } {
  const { currentPrice, previousPrice, lowestPrice, discountPercentage } = input;
  let score = Math.min(45, discountPercentage * 1.4);

  if (previousPrice && previousPrice > currentPrice) {
    score += Math.min(15, discountPercentage * 0.3);
  }

  if (lowestPrice && lowestPrice > 0 && currentPrice <= lowestPrice * 1.02) {
    return {
      level: DealLevel.HISTORICAL_LOW,
      score: Math.min(100, Math.round(score + 35)),
      label: "Mínimo histórico",
    };
  }

  if (discountPercentage >= 40) {
    return {
      level: DealLevel.GREAT_DEAL,
      score: Math.min(100, Math.round(score + 10)),
      label: "Gran chollo",
    };
  }

  if (discountPercentage >= 20) {
    return {
      level: DealLevel.GOOD_DEAL,
      score: Math.min(100, Math.round(score)),
      label: "Buen precio",
    };
  }

  return {
    level: DealLevel.NORMAL,
    score: Math.min(100, Math.round(score)),
    label: "Oferta",
  };
}

export function mapProduct(row: ProductRow): MarketplaceProduct {
  const categoryRaw = row.categories;
  const categoryNode = Array.isArray(categoryRaw)
    ? (categoryRaw[0] ?? null)
    : (categoryRaw ?? null);
  const parentRaw = categoryNode?.parent;
  const parentNode = Array.isArray(parentRaw)
    ? (parentRaw[0] ?? null)
    : (parentRaw ?? null);

  const subSlug = categoryNode?.slug ?? null;
  const parentSlug =
    parentNode?.slug ?? (subSlug ? resolveParentSlug(subSlug) : null);

  const currentPrice = toNumber(row.current_price) ?? 0;
  const previousPrice = toNumber(row.previous_price);
  const lowestPrice = toNumber(row.lowest_price);
  const discountPercentage =
    toNumber(row.discount_percentage) ??
    (previousPrice && previousPrice > currentPrice
      ? calculateDiscountPercentage(previousPrice, currentPrice)
      : 0);

  const scoring = scoreProduct({
    currentPrice,
    previousPrice,
    lowestPrice,
    discountPercentage,
  });

  const productUrl =
    row.product_url?.trim() || row.amazon_url?.trim() || "#";
  const affiliateUrl = row.affiliate_url?.trim() || productUrl;

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    brand: row.brand,
    retailer: row.retailer ?? "amazon",
    currentPrice,
    previousPrice,
    lowestPrice,
    discountPercentage,
    affiliateUrl,
    productUrl,
    isFeatured: Boolean(row.is_featured),
    createdAt: row.created_at,
    category: categoryNode
      ? {
          id: categoryNode.id,
          name: categoryNode.name,
          slug: categoryNode.slug,
          parentSlug: parentSlug ?? null,
          parentName: parentNode?.name ?? null,
        }
      : null,
    dealLevel: scoring.level,
    dealScore: scoring.score,
    dealLabel: scoring.label,
  };
}

function sortProducts(
  products: MarketplaceProduct[],
  sort: SortOption,
): MarketplaceProduct[] {
  return [...products].sort((a, b) => {
    switch (sort) {
      case "discount":
        return b.discountPercentage - a.discountPercentage;
      case "price-asc":
        return a.currentPrice - b.currentPrice;
      case "price-desc":
        return b.currentPrice - a.currentPrice;
      case "newest":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "score":
      default:
        if (b.dealScore !== a.dealScore) return b.dealScore - a.dealScore;
        return b.discountPercentage - a.discountPercentage;
    }
  });
}

async function resolveCategoryIds(
  filters: MarketplaceFilters,
): Promise<string[] | null> {
  if (!filters.parentSlug && !filters.subcategorySlug) return null;

  const client = getSupabaseServer();
  const { data: allCategories } = await client
    .from("categories")
    .select("id, slug, parent_id");

  const rows = (allCategories ?? []) as CategoryRow[];
  if (!rows.length) return null;

  if (filters.subcategorySlug) {
    const sub = rows.find((c) => c.slug === filters.subcategorySlug);
    return sub ? [sub.id] : [];
  }

  if (filters.parentSlug) {
    const parent = rows.find(
      (c) => c.slug === filters.parentSlug && !c.parent_id,
    );
    if (!parent) return [];
    const subs = rows.filter((c) => c.parent_id === parent.id).map((c) => c.id);
    return [parent.id, ...subs];
  }

  return null;
}

export async function queryMarketplaceProducts(
  filters: MarketplaceFilters,
  page = 1,
  pageSize = MARKETPLACE_PAGE_SIZE,
): Promise<PaginatedProducts> {
  const client = getSupabaseServer();
  const categoryIds = await resolveCategoryIds(filters);
  if (categoryIds?.length === 0) {
    return { items: [], page, pageSize, total: 0, totalPages: 0 };
  }

  const needsScoreSort = filters.sort === "score" || filters.onlyTopDeals;
  const fetchSize = needsScoreSort ? Math.min(page * pageSize * 3, 1200) : pageSize;
  const from = needsScoreSort ? 0 : (page - 1) * pageSize;
  const to = needsScoreSort ? fetchSize - 1 : from + pageSize - 1;

  let query = client
    .from("products")
    .select(CATEGORY_SELECT, { count: "exact" })
    .eq("is_active", true);

  const q = filters.query.trim();
  if (q) {
    const pattern = `%${q}%`;
    query = query.or(
      `title.ilike.${pattern},brand.ilike.${pattern},description.ilike.${pattern}`,
    );
  }

  if (categoryIds) {
    query = query.in("category_id", categoryIds);
  }

  if (filters.retailers.length > 0) {
    query = query.in("retailer", filters.retailers);
  }

  if (filters.minDiscount > 0) {
    query = query.gte("discount_percentage", filters.minDiscount);
  }

  if (filters.minPrice !== null) {
    query = query.gte("current_price", filters.minPrice);
  }

  if (filters.maxPrice !== null) {
    query = query.lte("current_price", filters.maxPrice);
  }

  if (filters.onlyFeatured) {
    query = query.eq("is_featured", true);
  }

  if (filters.onlyTopDeals) {
    query = query.gte("discount_percentage", 25);
  }

  switch (filters.sort) {
    case "discount":
      query = query.order("discount_percentage", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "price-asc":
      query = query.order("current_price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("current_price", { ascending: false });
      break;
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "score":
    default:
      query = query
        .order("discount_percentage", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      break;
  }

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error("[catalog] queryMarketplaceProducts", error.message);
    return { items: [], page, pageSize, total: 0, totalPages: 0 };
  }

  let items = ((data ?? []) as ProductRow[]).map(mapProduct);

  if (needsScoreSort) {
    items = sortProducts(items, filters.sort);
    if (filters.onlyTopDeals) {
      items = items.filter((p) => p.dealScore >= 55);
    }
    const total = items.length;
    const start = (page - 1) * pageSize;
    items = items.slice(start, start + pageSize);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const total = count ?? items.length;
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function fetchCategoryNodes(): Promise<CategoryFilterNode[]> {
  const client = getSupabaseServer();
  const [categoriesRes, productsRes] = await Promise.all([
    client.from("categories").select("id, name, slug, parent_id").order("name"),
    client
      .from("products")
      .select("category_id")
      .eq("is_active", true)
      .not("category_id", "is", null),
  ]);

  const rows = (categoriesRes.data ?? []) as CategoryRow[];
  const counts = new Map<string, number>();
  for (const row of productsRes.data ?? []) {
    const id = row.category_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const parentById = new Map(rows.map((r) => [r.id, r]));
  const parentCounts = new Map<string, number>();

  for (const [catId, count] of counts) {
    const cat = parentById.get(catId);
    if (!cat?.parent_id) continue;
    parentCounts.set(
      cat.parent_id,
      (parentCounts.get(cat.parent_id) ?? 0) + count,
    );
  }

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parent_id,
      productCount: row.parent_id
        ? (counts.get(row.id) ?? 0)
        : (parentCounts.get(row.id) ?? counts.get(row.id) ?? 0),
    }))
    .filter((c) => c.productCount > 0 || !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

async function fetchStats(): Promise<MarketplaceStats> {
  const client = getSupabaseServer();
  const [countRes, discountRes, retailerRes] = await Promise.all([
    client
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    client
      .from("products")
      .select("discount_percentage")
      .eq("is_active", true)
      .gt("discount_percentage", 0)
      .limit(300),
    client
      .from("products")
      .select("retailer")
      .eq("is_active", true)
      .not("retailer", "is", null),
  ]);

  const discounts = (discountRes.data ?? [])
    .map((r) => toNumber(r.discount_percentage))
    .filter((v): v is number => v !== null);
  const avgDiscount =
    discounts.length > 0
      ? Math.round(
          discounts.reduce((sum, v) => sum + v, 0) / discounts.length,
        )
      : 0;

  const retailerCounts = new Map<string, number>();
  for (const row of retailerRes.data ?? []) {
    const id = String(row.retailer);
    retailerCounts.set(id, (retailerCounts.get(id) ?? 0) + 1);
  }
  const topRetailer = [...retailerCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0];

  return {
    totalProducts: countRes.count ?? 0,
    avgDiscount,
    topRetailer: topRetailer
      ? { id: topRetailer[0], count: topRetailer[1] }
      : null,
  };
}

async function fetchSpotlight(): Promise<MarketplaceBootstrap["spotlight"]> {
  const client = getSupabaseServer();
  const [topRes, trendRes, latestRes] = await Promise.all([
    client
      .from("products")
      .select(CATEGORY_SELECT)
      .eq("is_active", true)
      .gte("discount_percentage", 30)
      .order("discount_percentage", { ascending: false, nullsFirst: false })
      .limit(12),
    client
      .from("products")
      .select(CATEGORY_SELECT)
      .eq("is_active", true)
      .order("discount_percentage", { ascending: false, nullsFirst: false })
      .limit(12),
    client
      .from("products")
      .select(CATEGORY_SELECT)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const topDeals = sortProducts(
    ((topRes.data ?? []) as ProductRow[]).map(mapProduct),
    "score",
  ).slice(0, 5);

  const trending = sortProducts(
    ((trendRes.data ?? []) as ProductRow[]).map(mapProduct),
    "discount",
  ).slice(0, 5);

  const latest = ((latestRes.data ?? []) as ProductRow[])
    .map(mapProduct)
    .slice(0, 5);

  return { topDeals, trending, latest };
}

export async function getMarketplaceBootstrap(
  page = 1,
  pageSize = MARKETPLACE_PAGE_SIZE,
): Promise<MarketplaceBootstrap> {
  const [categories, stats, spotlight, initialPage, coupons] = await Promise.all([
    fetchCategoryNodes(),
    fetchStats(),
    fetchSpotlight(),
    queryMarketplaceProducts(
      {
        query: "",
        parentSlug: null,
        subcategorySlug: null,
        retailers: [],
        minDiscount: 0,
        maxPrice: null,
        minPrice: null,
        sort: "score",
        onlyFeatured: false,
        onlyTopDeals: false,
      },
      page,
      pageSize,
    ),
    getActiveCoupons(),
  ]);

  return {
    categories,
    stats,
    spotlight,
    coupons,
    initialPage,
  };
}

/** @deprecated Usar getMarketplaceBootstrap */
export async function getMarketplaceData(limit = 600) {
  const bootstrap = await getMarketplaceBootstrap(1, limit);
  return {
    products: bootstrap.initialPage.items,
    categories: bootstrap.categories,
    stats: bootstrap.stats,
  };
}

export async function getProductBySlug(
  slug: string,
): Promise<MarketplaceProduct | null> {
  const client = getSupabaseServer();
  const { data, error } = await client
    .from("products")
    .select(CATEGORY_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapProduct(data as ProductRow);
}
