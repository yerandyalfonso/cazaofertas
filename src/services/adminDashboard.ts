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
  byRetailer: Array<{ retailer: string; count: number }>;
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
        "amazon_url, asin, retailer, product_url, last_checked_at",
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
  const retailerMap = new Map<string, number>();

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
      retailerMap.set(key, (retailerMap.get(key) ?? 0) + 1);
    }
  });

  return {
    activeProducts,
    amazonMonitorable,
    retailMonitorable,
    lastCheckedAt,
    oldestCheckedAt,
    neverChecked,
    byRetailer: [...retailerMap.entries()]
      .map(([retailer, count]) => ({ retailer, count }))
      .sort((a, b) => b.count - a.count),
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
