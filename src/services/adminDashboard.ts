import { createSupabaseServiceClient } from "@/lib/supabase";
import {
  productHasMonitorableUrl,
  productHasRetailMonitorableUrl,
} from "@/services/products";
import { countPendingChannelNotifications } from "@/services/telegramFlush";

export interface AdminCatalogStats {
  activeProducts: number;
  amazonMonitorable: number;
  retailMonitorable: number;
  lastCheckedAt: string | null;
  oldestCheckedAt: string | null;
  neverChecked: number;
  byRetailer: RetailerHealth[];
}

/** Estado de la vigilancia de una tienda, sacado de sus productos activos. */
export interface RetailerHealth {
  retailer: string;
  count: number;
  /** Revisión de precio más reciente. */
  lastCheckedAt: string | null;
  checked24h: number;
  /** Sin revisar en más de 48 h (o nunca). */
  stale48h: number;
  outOfStock: number;
  /** Último producto dado de alta (lo mete el job de ofertas o una alerta). */
  lastCreatedAt: string | null;
}

export interface AdminClickStats {
  clicks7d: number;
  clicks30d: number;
  testClicks7d: number;
  bySource: Array<{ source: string; count: number }>;
}

const PRODUCT_PAGE_SIZE = 1000;

type ProductStatRow = {
  amazon_url: string | null;
  asin: string | null;
  retailer: string | null;
  product_url: string | null;
  last_checked_at: string | null;
  availability: string | null;
  created_at: string | null;
};

function startOfDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

async function forEachActiveProductPage(
  onPage: (rows: ProductStatRow[]) => void,
): Promise<void> {
  const client = createSupabaseServiceClient();
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("products")
      .select(
        "amazon_url, asin, retailer, product_url, last_checked_at, availability, created_at",
      )
      .eq("is_active", true)
      .range(offset, offset + PRODUCT_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const rows = (data ?? []) as ProductStatRow[];
    if (rows.length === 0) break;

    onPage(rows);

    if (rows.length < PRODUCT_PAGE_SIZE) break;
    offset += PRODUCT_PAGE_SIZE;
  }
}

export async function getAdminCatalogStats(): Promise<AdminCatalogStats> {
  let activeProducts = 0;
  let amazonMonitorable = 0;
  let retailMonitorable = 0;
  let neverChecked = 0;
  let lastCheckedAt: string | null = null;
  let oldestCheckedAt: string | null = null;
  const retailerMap = new Map<string, RetailerHealth>();
  const now = Date.now();
  const since24h = new Date(now - 24 * 3_600_000).toISOString();
  const since48h = new Date(now - 48 * 3_600_000).toISOString();

  await forEachActiveProductPage((rows) => {
    for (const row of rows) {
      activeProducts += 1;
      if (productHasMonitorableUrl(row as Parameters<typeof productHasMonitorableUrl>[0])) {
        amazonMonitorable += 1;
      }
      if (
        productHasRetailMonitorableUrl(
          row as Parameters<typeof productHasRetailMonitorableUrl>[0],
        )
      ) {
        retailMonitorable += 1;
      }
      if (!row.last_checked_at) neverChecked += 1;
      if (row.last_checked_at) {
        if (!lastCheckedAt || row.last_checked_at > lastCheckedAt) {
          lastCheckedAt = row.last_checked_at;
        }
        if (!oldestCheckedAt || row.last_checked_at < oldestCheckedAt) {
          oldestCheckedAt = row.last_checked_at;
        }
      }
      const key = (row.retailer ?? "amazon").trim() || "amazon";
      const health = retailerMap.get(key) ?? {
        retailer: key,
        count: 0,
        lastCheckedAt: null,
        checked24h: 0,
        stale48h: 0,
        outOfStock: 0,
        lastCreatedAt: null,
      };
      health.count += 1;
      if (row.last_checked_at && row.last_checked_at >= since24h) health.checked24h += 1;
      if (!row.last_checked_at || row.last_checked_at < since48h) health.stale48h += 1;
      if (row.availability === "OUT_OF_STOCK") health.outOfStock += 1;
      if (row.last_checked_at && (!health.lastCheckedAt || row.last_checked_at > health.lastCheckedAt)) {
        health.lastCheckedAt = row.last_checked_at;
      }
      if (row.created_at && (!health.lastCreatedAt || row.created_at > health.lastCreatedAt)) {
        health.lastCreatedAt = row.created_at;
      }
      retailerMap.set(key, health);
    }
  });

  return {
    activeProducts,
    amazonMonitorable,
    retailMonitorable,
    lastCheckedAt,
    oldestCheckedAt,
    neverChecked,
    byRetailer: [...retailerMap.values()].sort((a, b) => b.count - a.count),
  };
}

async function countClicksSince(
  sinceIso: string,
  options?: { includeTest?: boolean; onlyTest?: boolean },
): Promise<number> {
  const client = createSupabaseServiceClient();
  let query = client
    .from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .gte("created_at", sinceIso);

  if (options?.onlyTest) {
    query = query.eq("is_test", true);
  } else if (!options?.includeTest) {
    query = query.eq("is_test", false);
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getAdminClickStats(options?: {
  includeTest?: boolean;
}): Promise<AdminClickStats> {
  const since30 = startOfDaysAgo(30);
  const since7 = startOfDaysAgo(7);
  const includeTest = options?.includeTest ?? false;

  const [clicks30d, clicks7d, testClicks7d] = await Promise.all([
    countClicksSince(since30, { includeTest }),
    countClicksSince(since7, { includeTest }),
    countClicksSince(since7, { onlyTest: true }),
  ]);

  const client = createSupabaseServiceClient();
  const sourceMap = new Map<string, number>();
  let offset = 0;

  while (true) {
    let sourceQuery = client
      .from("affiliate_clicks")
      .select("source")
      .gte("created_at", since30)
      .range(offset, offset + PRODUCT_PAGE_SIZE - 1);

    if (!includeTest) {
      sourceQuery = sourceQuery.eq("is_test", false);
    }

    const { data: sourceRows, error: sourceError } = await sourceQuery;
    if (sourceError) throw new Error(sourceError.message);

    const rows = sourceRows ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const key = row.source || "web";
      sourceMap.set(key, (sourceMap.get(key) ?? 0) + 1);
    }

    if (rows.length < PRODUCT_PAGE_SIZE) break;
    offset += PRODUCT_PAGE_SIZE;
  }

  return {
    clicks7d,
    clicks30d,
    testClicks7d,
    bySource: [...sourceMap.entries()]
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  };
}

export async function getAdminOpsSnapshot(): Promise<{
  catalog: AdminCatalogStats;
  clicks: AdminClickStats;
  pendingTelegram: number;
}> {
  const [catalog, clicks, pendingTelegram] = await Promise.all([
    getAdminCatalogStats(),
    getAdminClickStats(),
    countPendingChannelNotifications(),
  ]);
  return { catalog, clicks, pendingTelegram };
}

export interface RetailerStatsRow {
  /** `null` = clics de productos ya borrados. */
  retailer: string | null;
  activeProducts: number;
  clicks: number;
}

/**
 * Por tienda: productos activos y clics a tienda (sin pruebas) en los
 * últimos N días. El clic no guarda la tienda: se toma del producto.
 */
export async function getRetailerStats(days: number): Promise<RetailerStatsRow[]> {
  const client = createSupabaseServiceClient();
  const since = startOfDaysAgo(days);
  const clicksByProduct = new Map<string, number>();
  let orphanClicks = 0;

  for (let offset = 0; ; offset += PRODUCT_PAGE_SIZE) {
    const { data, error } = await client
      .from("affiliate_clicks")
      .select("product_id")
      .eq("is_test", false)
      .gte("created_at", since)
      .range(offset, offset + PRODUCT_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      if (!row.product_id) orphanClicks += 1;
      else clicksByProduct.set(row.product_id, (clicksByProduct.get(row.product_id) ?? 0) + 1);
    }
    if (!data || data.length < PRODUCT_PAGE_SIZE) break;
  }

  const clicksByRetailer = new Map<string, number>();
  const ids = [...clicksByProduct.keys()];
  // Lotes pequeños: los ids van en la URL de la petición.
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await client.from("products").select("id, retailer").in("id", chunk);
    if (error) throw new Error(error.message);
    const found = new Set<string>();
    for (const row of data ?? []) {
      found.add(row.id);
      const key = (row.retailer ?? "amazon").trim() || "amazon";
      clicksByRetailer.set(key, (clicksByRetailer.get(key) ?? 0) + (clicksByProduct.get(row.id) ?? 0));
    }
    for (const id of chunk) if (!found.has(id)) orphanClicks += clicksByProduct.get(id) ?? 0;
  }

  const { byRetailer } = await getAdminCatalogStats();
  const retailers = new Set([...byRetailer.map((row) => row.retailer), ...clicksByRetailer.keys()]);
  const rows: RetailerStatsRow[] = [...retailers].map((retailer) => ({
    retailer,
    activeProducts: byRetailer.find((row) => row.retailer === retailer)?.count ?? 0,
    clicks: clicksByRetailer.get(retailer) ?? 0,
  }));
  rows.sort((a, b) => b.clicks - a.clicks || b.activeProducts - a.activeProducts);
  if (orphanClicks > 0) rows.push({ retailer: null, activeProducts: 0, clicks: orphanClicks });
  return rows;
}

export interface TopClickedProduct {
  productId: string;
  title: string;
  slug: string | null;
  retailer: string | null;
  clicks: number;
}

/** Productos con más clics a tienda (sin clics de prueba) en los últimos N días. */
export async function getTopClickedProducts(
  days: number,
  limit = 10,
): Promise<TopClickedProduct[]> {
  const client = createSupabaseServiceClient();
  const since = startOfDaysAgo(days);
  const counts = new Map<string, number>();

  for (let offset = 0; ; offset += PRODUCT_PAGE_SIZE) {
    const { data, error } = await client
      .from("affiliate_clicks")
      .select("product_id")
      .eq("is_test", false)
      // Clics de productos ya borrados quedan con product_id null.
      .not("product_id", "is", null)
      .gte("created_at", since)
      .range(offset, offset + PRODUCT_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
    }
    if (!data || data.length < PRODUCT_PAGE_SIZE) break;
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  if (top.length === 0) return [];

  const { data: products } = await client
    .from("products")
    .select("id, title, slug, retailer")
    .in(
      "id",
      top.map(([id]) => id),
    );
  const byId = new Map((products ?? []).map((row) => [row.id, row]));
  return top.map(([productId, clicks]) => ({
    productId,
    title: byId.get(productId)?.title ?? "Producto eliminado",
    slug: byId.get(productId)?.slug ?? null,
    retailer: byId.get(productId)?.retailer ?? null,
    clicks,
  }));
}
