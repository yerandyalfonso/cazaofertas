import { roundMoney, toNumber } from "@/lib/money";
import {
  buildOutOfStockUpdate,
  inStockAvailabilityPatch,
} from "@/lib/out-of-stock-policy";
import {
  normalizeRetailer,
  resolveProductPageUrl,
  type ProductRetailer,
} from "@/lib/retailers";
import { createSupabaseServiceClient } from "@/lib/supabase";
import {
  inferRetailerFromAsin,
  productHasRetailMonitorableUrl,
} from "@/services/products";
import { previewProductPage } from "@/services/productScrape";
import { isRetailBlockedError } from "@/lib/retail-url-utils";
import type { PriceSource } from "@/types";
import { ProductAvailability } from "@/types";

export interface RetailPriceCheckResult {
  ok: true;
  monitorable: number;
  scoped: number;
  finishedAt: string;
  stats: {
    processed: number;
    updated: number;
    unchanged: number;
    skippedBlocked: number;
    errors: Array<{ asin: string; message: string }>;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function priceSourceForRetailer(retailer: ProductRetailer): PriceSource {
  if (retailer === "kiabi") return "kiabi";
  return "mock";
}

export async function runRetailPriceCheck(options?: {
  limit?: number;
  asins?: string[];
  delayMs?: number;
}): Promise<RetailPriceCheckResult> {
  const client = createSupabaseServiceClient();
  const requested = options?.asins
    ?.map((asin) => asin.trim().toUpperCase())
    .filter(Boolean);

  const limitRaw = options?.limit;
  const limit =
    Number.isFinite(limitRaw) && (limitRaw as number) > 0
      ? Math.min(20, limitRaw as number)
      : 4;

  const { data: products, error } = await client
    .from("products")
    .select(
      "id, asin, retailer, product_url, amazon_url, title, brand, image_url, description, current_price, previous_price, lowest_price, highest_price, availability, out_of_stock_at, is_active, last_checked_at",
    )
    .eq("is_active", true);

  if (error) {
    throw new Error(`No se pudieron leer productos retail: ${error.message}`);
  }

  const monitorable = (products ?? [])
    .filter(productHasRetailMonitorableUrl)
    .sort((a, b) => {
      const aChecked = a.last_checked_at
        ? new Date(a.last_checked_at).getTime()
        : 0;
      const bChecked = b.last_checked_at
        ? new Date(b.last_checked_at).getTime()
        : 0;
      return aChecked - bChecked;
    });

  const queue = (
    requested?.length
      ? monitorable.filter((product) =>
          requested.includes(product.asin.toUpperCase()),
        )
      : monitorable
  ).slice(0, limit);

  const stats = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    skippedBlocked: 0,
    errors: [] as Array<{ asin: string; message: string }>,
  };

  const delayMs = options?.delayMs ?? 1_800;

  for (let index = 0; index < queue.length; index += 1) {
    const product = queue[index]!;
    stats.processed += 1;

    const retailer =
      product.retailer != null
        ? normalizeRetailer(product.retailer)
        : inferRetailerFromAsin(product.asin);
    const productUrl = resolveProductPageUrl(product);

    if (!productUrl) {
      stats.errors.push({
        asin: product.asin,
        message: "No hay URL de producto para revisar.",
      });
      continue;
    }

    try {
      const preview = await previewProductPage(productUrl, { retailer });
      const nextPrice = preview.price;
      const listPrice =
        preview.listPrice != null &&
        nextPrice != null &&
        preview.listPrice > nextPrice
          ? preview.listPrice
          : null;

      if (nextPrice == null) {
        if (toNumber(product.current_price) != null) {
          const now = new Date().toISOString();
          await client
            .from("products")
            .update({
              last_checked_at: now,
              updated_at: now,
              ...(preview.title ? { title: preview.title } : {}),
              ...(preview.brand ? { brand: preview.brand } : {}),
              ...(preview.imageUrl ? { image_url: preview.imageUrl } : {}),
              ...(preview.description
                ? { description: preview.description }
                : {}),
            })
            .eq("id", product.id);
          stats.skippedBlocked += 1;
          continue;
        }

        const blocked =
          preview.partial ||
          Boolean(preview.warning && isRetailBlockedError(preview.warning));
        stats.errors.push({
          asin: product.asin,
          message: blocked
            ? "La tienda bloqueó el scrape (anti-bot)."
            : "La tienda no devolvió precio para este producto.",
        });
        continue;
      }

      const resolvedPrice = roundMoney(nextPrice);
      const resolvedListPrice =
        listPrice != null && listPrice > resolvedPrice
          ? roundMoney(listPrice)
          : null;
      const storedCurrent = toNumber(product.current_price);
      const storedPrevious = toNumber(product.previous_price);
      const reference =
        resolvedListPrice ??
        (storedPrevious != null && storedPrevious > resolvedPrice
          ? storedPrevious
          : resolvedPrice);
      const changed =
        storedCurrent === null ||
        Math.abs(storedCurrent - resolvedPrice) >= 0.01;
      const now = new Date().toISOString();
      const discount =
        reference > resolvedPrice
          ? roundMoney(((reference - resolvedPrice) / reference) * 100)
          : 0;

      const { error: updateError } = await client
        .from("products")
        .update({
          current_price: resolvedPrice,
          previous_price: reference,
          discount_percentage: discount,
          lowest_price:
            toNumber(product.lowest_price) == null
              ? resolvedPrice
              : roundMoney(
                  Math.min(toNumber(product.lowest_price)!, resolvedPrice),
                ),
          highest_price: roundMoney(
            Math.max(
              toNumber(product.highest_price) ?? resolvedPrice,
              resolvedPrice,
              reference,
            ),
          ),
          availability: ProductAvailability.IN_STOCK,
          last_checked_at: now,
          updated_at: now,
          ...inStockAvailabilityPatch(ProductAvailability.IN_STOCK),
          ...(preview.title ? { title: preview.title } : {}),
          ...(preview.brand ? { brand: preview.brand } : {}),
          ...(preview.imageUrl ? { image_url: preview.imageUrl } : {}),
          ...(preview.description ? { description: preview.description } : {}),
        })
        .eq("id", product.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (changed) {
        await client.from("price_history").insert({
          product_id: product.id,
          price: resolvedPrice,
          source: priceSourceForRetailer(retailer),
        });
        stats.updated += 1;
      } else {
        stats.unchanged += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      if (/agotado|out_of_stock/i.test(message)) {
        const now = new Date().toISOString();
        const oosPatch = buildOutOfStockUpdate(product, now);
        await client.from("products").update(oosPatch).eq("id", product.id);
        stats.unchanged += 1;
        continue;
      }

      stats.errors.push({ asin: product.asin, message });
    }

    if (index < queue.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    ok: true,
    monitorable: monitorable.length,
    scoped: queue.length,
    finishedAt: new Date().toISOString(),
    stats,
  };
}
