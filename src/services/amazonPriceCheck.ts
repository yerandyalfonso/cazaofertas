import { resolvePriceProvider } from "@/providers/price";
import { runPriceDetection, type PriceDetectionStats } from "@/services/priceDetection";
import { buildAsinUrlMap, productHasMonitorableUrl } from "@/services/products";
import { createSupabaseServiceClient } from "@/lib/supabase";

export interface AmazonPriceCheckResult {
  ok: true;
  provider: "html" | "keepa" | "creators";
  monitorable: number;
  scoped: number;
  finishedAt: string;
  stats: PriceDetectionStats;
}

export async function runAmazonPriceCheck(options?: {
  limit?: number;
  notify?: boolean;
  /** Si se indica, solo se comprueban estos ASINs. */
  asins?: string[];
  /** Override del proveedor (admin puede forzar html para fiabilidad). */
  provider?: "html" | "keepa" | "creators" | "auto";
  delayMs?: number;
}): Promise<AmazonPriceCheckResult> {
  const client = createSupabaseServiceClient();
  const { data: products, error } = await client
    .from("products")
    .select(
      "id, asin, amazon_url, affiliate_url, current_price, previous_price, title, is_active",
    )
    .eq("is_active", true);

  if (error) {
    throw new Error(`No se pudieron leer productos: ${error.message}`);
  }

  const monitorable = (products ?? []).filter(productHasMonitorableUrl);
  const urlByAsin = buildAsinUrlMap(monitorable);
  const requested = options?.asins
    ?.map((asin) => asin.trim().toUpperCase())
    .filter(Boolean);
  const limit = options?.limit;
  const asins = (
    requested?.length
      ? requested.filter((asin) => urlByAsin.has(asin))
      : [...urlByAsin.keys()]
  ).slice(
    0,
    Number.isFinite(limit) && (limit as number) > 0
      ? (limit as number)
      : undefined,
  );

  if (asins.length === 0) {
    throw new Error(
      "No hay productos con URL de Amazon para revisar. Añade ASINs en el catálogo.",
    );
  }

  const scopedUrlMap = new Map(
    asins.map((asin) => [asin, urlByAsin.get(asin)!] as const),
  );

  const resolved = resolvePriceProvider({
    urlByAsin: scopedUrlMap,
    delayMs: options?.delayMs ?? 900,
    timeoutMs: 12_000,
    force: options?.provider,
  });

  const stats = await runPriceDetection({
    client,
    provider: resolved.provider,
    source: resolved.source,
    onlyWithAmazonUrl: true,
    asinAllowList: asins,
    batchSize: resolved.id === "html" ? 2 : 8,
    notify: options?.notify ?? true,
  });

  return {
    ok: true,
    provider: resolved.id,
    monitorable: monitorable.length,
    scoped: scopedUrlMap.size,
    finishedAt: new Date().toISOString(),
    stats,
  };
}
