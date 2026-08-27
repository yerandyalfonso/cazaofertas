import { resolvePriceProvider } from "@/providers/price";
import {
  assertCronAllowed,
  maybePauseAfterAmazonErrors,
  type CronControlState,
} from "@/services/cronControl";
import { runPriceDetection, type PriceDetectionStats } from "@/services/priceDetection";
import { buildAsinUrlMap, productHasMonitorableUrl } from "@/services/products";
import { createSupabaseServiceClient } from "@/lib/supabase";

/** Lote por defecto: cubre el día con varias corridas sin saturar Amazon. */
export const DEFAULT_PRICE_CHECK_BATCH = 10;

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

  const client = createSupabaseServiceClient();
  const requested = options?.asins
    ?.map((asin) => asin.trim().toUpperCase())
    .filter(Boolean);

  const limitRaw = options?.limit;
  const limit =
    Number.isFinite(limitRaw) && (limitRaw as number) > 0
      ? Math.min(50, limitRaw as number)
      : DEFAULT_PRICE_CHECK_BATCH;

  // Rotación: primero los nunca revisados / más antiguos.
  const { data: products, error } = await client
    .from("products")
    .select(
      "id, asin, amazon_url, affiliate_url, current_price, previous_price, title, is_active, last_checked_at",
    )
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true, nullsFirst: true });

  if (error) {
    throw new Error(`No se pudieron leer productos: ${error.message}`);
  }

  const monitorable = (products ?? []).filter(productHasMonitorableUrl);
  const urlByAsin = buildAsinUrlMap(monitorable);

  const asins = (
    requested?.length
      ? requested.filter((asin) => urlByAsin.has(asin))
      : [...urlByAsin.keys()]
  ).slice(0, limit);

  if (asins.length === 0) {
    throw new Error(
      "No hay productos con URL de Amazon para revisar. Añade ASINs en el catálogo.",
    );
  }

  const batchMeta = asins.map((asin) => {
    const row = monitorable.find((p) => p.asin === asin);
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
    client,
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
    monitorable: monitorable.length,
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
