import { resolvePriceProvider } from "@/providers/price";
import {
  assertCronAllowed,
  maybePauseAfterAmazonErrors,
  type CronControlState,
} from "@/services/cronControl";
import { runPriceDetection, type PriceDetectionStats } from "@/services/priceDetection";
import { buildAsinUrlMap, productHasMonitorableUrl } from "@/services/products";
import { ProductAvailability } from "@/types";
import { createSupabaseServiceClient } from "@/lib/supabase";

/** Lote por defecto: cubre el día con varias corridas sin saturar Amazon. */
export const DEFAULT_PRICE_CHECK_BATCH = 10;

const ROTATION_SELECT =
  "id, asin, retailer, amazon_url, affiliate_url, product_url, current_price, previous_price, title, is_active, last_checked_at, availability";

type RotationRow = {
  id: string;
  asin: string;
  retailer: string | null;
  amazon_url: string;
  affiliate_url: string | null;
  product_url: string | null;
  current_price: number | string;
  previous_price: number | string | null;
  title: string;
  is_active: boolean;
  last_checked_at: string | null;
  availability: string | null;
};

export interface AmazonPriceCheckResult {
  ok: true;
  provider: "html" | "keepa" | "creators";
  monitorable: number;
  scoped: number;
  finishedAt: string;
  stats: PriceDetectionStats;
  rotation?: {
    oldestCheckedAt: string | null;
    newestInBatchCheckedAt: string | null;
  };
  pause?: {
    activated: boolean;
    denials: number;
    state?: CronControlState;
  };
  skipped?: boolean;
  skipReason?: string;
}

function sortRotation(a: RotationRow, b: RotationRow): number {
  const aUnavailable =
    a.availability === ProductAvailability.OUT_OF_STOCK ? 1 : 0;
  const bUnavailable =
    b.availability === ProductAvailability.OUT_OF_STOCK ? 1 : 0;
  if (aUnavailable !== bUnavailable) {
    return aUnavailable - bUnavailable;
  }
  const aChecked = a.last_checked_at
    ? new Date(a.last_checked_at).getTime()
    : 0;
  const bChecked = b.last_checked_at
    ? new Date(b.last_checked_at).getTime()
    : 0;
  return aChecked - bChecked;
}

/** Ventana paginada: no descarga el catálogo entero para elegir N ASINs. */
async function pickMonitorableBatch(
  limit: number,
  requested?: string[],
): Promise<{ monitorable: RotationRow[]; batch: RotationRow[] }> {
  const client = createSupabaseServiceClient();

  if (requested?.length) {
    const { data, error } = await client
      .from("products")
      .select(ROTATION_SELECT)
      .eq("is_active", true)
      .in("asin", requested.slice(0, 50));
    if (error) {
      throw new Error(`No se pudieron leer productos: ${error.message}`);
    }
    const monitorable = ((data ?? []) as RotationRow[])
      .filter(productHasMonitorableUrl)
      .sort(sortRotation);
    return {
      monitorable,
      batch: monitorable.slice(0, limit),
    };
  }

  const pageSize = Math.min(120, Math.max(limit * 15, 40));
  const picked: RotationRow[] = [];
  let offset = 0;

  while (picked.length < limit && offset < 2_000) {
    const { data, error } = await client
      .from("products")
      .select(ROTATION_SELECT)
      .eq("is_active", true)
      .or("retailer.eq.amazon,retailer.is.null")
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`No se pudieron leer productos: ${error.message}`);
    }

    const page = (data ?? []) as RotationRow[];
    if (page.length === 0) break;

    for (const row of page) {
      if (!productHasMonitorableUrl(row)) continue;
      picked.push(row);
      if (picked.length >= limit) break;
    }

    offset += pageSize;
    if (page.length < pageSize) break;
  }

  picked.sort(sortRotation);
  return { monitorable: picked, batch: picked.slice(0, limit) };
}

export async function runAmazonPriceCheck(options?: {
  limit?: number;
  notify?: boolean;
  /** Si se indica, solo se comprueban estos ASINs. */
  asins?: string[];
  /** Override del proveedor (admin puede forzar html para fiabilidad). */
  provider?: "html" | "keepa" | "creators" | "auto";
  delayMs?: number;
  /** Ignora pausa preventiva (admin / force). */
  force?: boolean;
}): Promise<AmazonPriceCheckResult> {
  await assertCronAllowed({ force: options?.force });

  const requested = options?.asins
    ?.map((asin) => asin.trim().toUpperCase())
    .filter(Boolean);

  const limitRaw = options?.limit;
  const limit =
    Number.isFinite(limitRaw) && (limitRaw as number) > 0
      ? Math.min(50, limitRaw as number)
      : DEFAULT_PRICE_CHECK_BATCH;

  const { monitorable, batch } = await pickMonitorableBatch(limit, requested);
  const urlByAsin = buildAsinUrlMap(batch);
  const asins = batch.map((row) => row.asin.toUpperCase()).filter((asin) =>
    urlByAsin.has(asin),
  );

  if (asins.length === 0) {
    throw new Error(
      "No hay productos con URL de Amazon para revisar. Añade ASINs en el catálogo.",
    );
  }

  const batchMeta = asins.map((asin) => {
    const row = batch.find((p) => p.asin.toUpperCase() === asin);
    return row?.last_checked_at ?? null;
  });

  const scopedUrlMap = new Map(
    asins.map((asin) => [asin, urlByAsin.get(asin)!] as const),
  );

  const resolved = resolvePriceProvider({
    urlByAsin: scopedUrlMap,
    delayMs: options?.delayMs ?? 1_100,
    timeoutMs: 12_000,
    force: options?.provider,
  });

  const stats = await runPriceDetection({
    client: createSupabaseServiceClient(),
    provider: resolved.provider,
    source: resolved.source,
    onlyWithAmazonUrl: true,
    asinAllowList: asins,
    batchSize: resolved.id === "html" ? 1 : 8,
    notify: options?.notify ?? true,
  });

  const pause = await maybePauseAfterAmazonErrors(stats.errors, stats.processed);

  return {
    ok: true,
    provider: resolved.id,
    monitorable: Math.max(monitorable.length, asins.length),
    scoped: asins.length,
    finishedAt: new Date().toISOString(),
    stats,
    rotation: {
      oldestCheckedAt: batchMeta[0] ?? null,
      newestInBatchCheckedAt: batchMeta[batchMeta.length - 1] ?? null,
    },
    pause: {
      activated: pause.paused,
      denials: pause.denials,
      state: pause.state,
    },
  };
}
