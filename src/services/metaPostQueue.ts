import { calculateDiscountPercentage, toNumber } from "@/lib/money";
import { resolveProductBuyUrl } from "@/lib/retailers";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import { resolveParentSlug } from "@/lib/category-taxonomy";
import type { DealCandidate } from "@/services/alertMatching";
import { dealScoringService } from "@/services/deal-scoring";
import { postDealBatchToFacebookPage } from "@/services/facebook";
import { postDealBatchToInstagram } from "@/services/instagram";
import {
  getMetaSocialSettings,
  isMetaPostIntervalElapsed,
  recordMetaPostSent,
} from "@/services/metaSocialSettings";
import { DealLevel, ProductAvailability } from "@/types";

export interface MetaBatchFlushResult {
  ok: true;
  skipped: boolean;
  reason?: string;
  pendingBefore: number;
  batchSize: number;
  posted: number;
  facebookOk: boolean;
  instagramOk: boolean;
}

/**
 * Encola un chollo para el próximo lote de Facebook/Instagram si supera el
 * umbral de descuento de Meta. No publica nada aquí — eso lo hace
 * `maybeFlushMetaBatch` cuando se junta el tamaño de lote configurado.
 * Nunca lanza: un fallo al encolar no debe romper Telegram.
 */
export async function queueMetaPost(deal: DealCandidate): Promise<void> {
  try {
    const settings = await getMetaSocialSettings();
    const discount = deal.discountPercentage ?? 0;
    if (discount < settings.minDiscountPercent) return;

    const client = createSupabaseServiceClient();
    const { error } = await client.from("meta_post_queue").insert({
      product_id: deal.productId,
      score: deal.score,
      old_price: deal.previousPrice,
      new_price: deal.currentPrice,
      discount_percentage: discount,
      status: "pending",
    });

    // Choque con el índice único de pendientes (ya encolado): no es un error.
    if (error && error.code !== "23505") {
      console.warn("[meta-post-queue] no se pudo encolar", error.message);
    }
  } catch (error) {
    console.warn(
      "[meta-post-queue] no se pudo encolar",
      error instanceof Error ? error.message : error,
    );
  }
}

async function countPendingMetaPosts(
  client: TypedSupabaseClient,
): Promise<number> {
  const { count, error } = await client
    .from("meta_post_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

async function loadPendingDeals(
  client: TypedSupabaseClient,
  limit: number,
): Promise<{ queueIds: string[]; deals: DealCandidate[] }> {
  const { data: rows, error } = await client
    .from("meta_post_queue")
    .select("id, product_id, old_price, new_price, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !rows?.length) return { queueIds: [], deals: [] };

  const queueIds: string[] = [];
  const deals: DealCandidate[] = [];

  for (const row of rows) {
    const { data: product, error: productError } = await client
      .from("products")
      .select(
        "id, asin, retailer, title, slug, brand, description, image_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, discount_percentage, availability, is_active, deal_expires_at, category_id, categories(id, name, slug, parent_id, parent:parent_id(id, name, slug))",
      )
      .eq("id", row.product_id)
      .maybeSingle();

    if (
      productError ||
      !product ||
      !product.is_active ||
      product.availability === ProductAvailability.OUT_OF_STOCK
    ) {
      queueIds.push(row.id);
      continue;
    }

    const expiresAt = product.deal_expires_at;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      queueIds.push(row.id);
      continue;
    }

    const currentPrice = toNumber(product.current_price) ?? 0;
    const previousPrice =
      toNumber(product.previous_price) ?? toNumber(row.old_price) ?? currentPrice;
    const discount =
      calculateDiscountPercentage(previousPrice, currentPrice) ||
      toNumber(product.discount_percentage) ||
      0;

    const categoryRaw = product.categories;
    const categoryNode = Array.isArray(categoryRaw) ? categoryRaw[0] : categoryRaw;
    const parentRaw = categoryNode?.parent;
    const parentNode = Array.isArray(parentRaw) ? parentRaw[0] : parentRaw;
    const parentSlug =
      parentNode?.slug ??
      (categoryNode?.slug ? resolveParentSlug(categoryNode.slug) : null);

    const scoring = dealScoringService.scoreProduct({
      currentPrice,
      previousPrice: previousPrice > currentPrice ? previousPrice : null,
      lowestPrice: toNumber(product.lowest_price),
      categorySlug: parentSlug ?? "otros",
    });

    queueIds.push(row.id);
    deals.push({
      productId: product.id,
      asin: product.asin,
      title: product.title,
      brand: product.brand,
      categoryId: categoryNode?.id ?? product.category_id,
      categoryName: categoryNode?.name ?? null,
      categorySlug: categoryNode?.slug ?? null,
      parentCategorySlug: parentSlug ?? null,
      parentCategoryName: parentNode?.name ?? null,
      retailer: product.retailer,
      currentPrice,
      previousPrice: previousPrice > currentPrice ? previousPrice : currentPrice,
      discountPercentage: discount,
      dealLevel: scoring.level,
      score: scoring.score,
      dealLabel: scoring.label,
      productSlug: product.slug,
      imageUrl: product.image_url,
      summary: product.description?.trim() || product.brand,
      affiliateUrl: resolveProductBuyUrl({
        retailer: product.retailer,
        asin: product.asin,
        amazon_url: product.amazon_url,
        affiliate_url: product.affiliate_url,
        product_url: product.amazon_url,
      }),
      nearHistoricalLow: scoring.level === DealLevel.HISTORICAL_LOW,
      detectedAt: row.created_at,
      expiresAt,
    });
  }

  return { queueIds, deals };
}

/**
 * Publica el lote de Facebook/Instagram cuando hay suficientes chollos en
 * cola (`batchSize`, por defecto 10) y ya pasó el espaciado mínimo desde el
 * último lote. Un carrusel por red en vez de un post por chollo — reduce
 * drásticamente el nº de llamadas a la API de Meta.
 */
export async function maybeFlushMetaBatch(options?: {
  force?: boolean;
}): Promise<MetaBatchFlushResult> {
  const client = createSupabaseServiceClient();
  const settings = await getMetaSocialSettings();
  const pendingBefore = await countPendingMetaPosts(client);

  if (pendingBefore === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "Cola de Meta vacía.",
      pendingBefore: 0,
      batchSize: settings.batchSize,
      posted: 0,
      facebookOk: false,
      instagramOk: false,
    };
  }

  if (!options?.force && pendingBefore < settings.batchSize) {
    return {
      ok: true,
      skipped: true,
      reason: `Esperando lote completo (${pendingBefore}/${settings.batchSize}).`,
      pendingBefore,
      batchSize: settings.batchSize,
      posted: 0,
      facebookOk: false,
      instagramOk: false,
    };
  }

  if (!options?.force && !(await isMetaPostIntervalElapsed(settings))) {
    return {
      ok: true,
      skipped: true,
      reason: "Aún no pasó el espaciado mínimo desde el último lote.",
      pendingBefore,
      batchSize: settings.batchSize,
      posted: 0,
      facebookOk: false,
      instagramOk: false,
    };
  }

  const { queueIds, deals } = await loadPendingDeals(client, settings.batchSize);

  if (queueIds.length > 0) {
    await client.from("meta_post_queue").update({
      status: "posted",
      posted_at: new Date().toISOString(),
    }).in("id", queueIds);
  }

  if (deals.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: "Nada publicable en el lote (productos caducados/agotados).",
      pendingBefore,
      batchSize: settings.batchSize,
      posted: 0,
      facebookOk: false,
      instagramOk: false,
    };
  }

  const facebook = await postDealBatchToFacebookPage(deals);
  if (!facebook.ok && !facebook.skipped) {
    console.warn("[facebook] lote", facebook.error ?? "No se pudo publicar el lote.");
  }

  const instagram = await postDealBatchToInstagram(deals);
  if (!instagram.ok && !instagram.skipped) {
    console.warn("[instagram] lote", instagram.error ?? "No se pudo publicar el lote.");
  }

  if (facebook.ok || instagram.ok) {
    await recordMetaPostSent();
  }

  return {
    ok: true,
    skipped: false,
    pendingBefore,
    batchSize: settings.batchSize,
    posted: deals.length,
    facebookOk: facebook.ok,
    instagramOk: instagram.ok,
  };
}
