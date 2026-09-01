import { generateAffiliateUrl } from "@/lib/affiliate";
import { calculateDiscountPercentage, toNumber } from "@/lib/money";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { resolveParentSlug } from "@/lib/category-taxonomy";
import type { DealCandidate } from "@/services/alertMatching";
import {
  getAppSettings,
  getTelegramFlushRescheduleMinutes,
  resolveTelegramMinScoreForRetailer,
  updateAppSettings,
} from "@/services/appSettings";
import { dealScoringService } from "@/services/deal-scoring";
import { sendChannelDealAlert } from "@/services/telegram/bot";
import { DealLevel, ProductAvailability } from "@/types";

const DEFAULT_FLUSH_LIMIT = 40;
const SEND_DELAY_MS = 700;

export interface TelegramFlushResult {
  ok: true;
  skipped: boolean;
  reason?: string;
  nextFlushAt: string | null;
  resumeAt: string | null;
  batchHours: number;
  pendingBefore: number;
  remainingPending: number;
  sent: number;
  skippedExpired: number;
  skippedLowScore: number;
  skippedUnavailable: number;
  failed: number;
  finishedAt: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFlushIso(lastFlushAt: string | null, batchHours: number): string {
  const base = lastFlushAt ? new Date(lastFlushAt).getTime() : Date.now();
  return new Date(base + batchHours * 60 * 60 * 1000).toISOString();
}

function resumeIso(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export async function countPendingChannelNotifications(): Promise<number> {
  return countQueuedChannelNotifications(["pending"]);
}

export async function countQueuedChannelNotifications(
  statuses: Array<"pending" | "failed"> = ["pending", "failed"],
): Promise<number> {
  try {
    const client = createSupabaseServiceClient();
    const { count, error } = await client
      .from("channel_notifications")
      .select("id", { count: "exact", head: true })
      .in("status", statuses);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Publica en Telegram los chollos pendientes (grupo + canal).
 * Respeta el intervalo de admin; si quedan pendientes programa un reintento.
 */
export async function flushPendingChannelNotifications(options?: {
  force?: boolean;
  limit?: number;
}): Promise<TelegramFlushResult> {
  const finishedAt = new Date().toISOString();
  const settings = await getAppSettings();
  const batchHours = settings.telegramBatchHours;
  const lastFlush = settings.lastTelegramFlushAt;
  const resumeAt = settings.telegramFlushResumeAt;
  const nextFlushAt = nextFlushIso(lastFlush, batchHours);
  const rescheduleMinutes = await getTelegramFlushRescheduleMinutes();

  const batchDue =
    !lastFlush ||
    Date.now() >=
      new Date(lastFlush).getTime() + batchHours * 60 * 60 * 1000;
  const resumeDue =
    resumeAt !== null && Date.now() >= new Date(resumeAt).getTime();

  if (!options?.force && !batchDue && !resumeDue) {
    return {
      ok: true,
      skipped: true,
      reason: `Aún no toca el lote (cada ${batchHours} h).`,
      nextFlushAt,
      resumeAt,
      batchHours,
      pendingBefore: await countQueuedChannelNotifications(),
      remainingPending: await countQueuedChannelNotifications(),
      sent: 0,
      skippedExpired: 0,
      skippedLowScore: 0,
      skippedUnavailable: 0,
      failed: 0,
      finishedAt,
    };
  }

  const client = createSupabaseServiceClient();
  const limit =
    options?.limit && options.limit > 0
      ? Math.min(options.limit, 80)
      : DEFAULT_FLUSH_LIMIT;

  const pendingBefore = await countQueuedChannelNotifications();

  const { data: pending, error: pendingError } = await client
    .from("channel_notifications")
    .select("id, product_id, created_at, old_price, new_price")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (pendingError) {
    throw new Error(pendingError.message);
  }

  const rows = pending ?? [];
  let sent = 0;
  let skippedExpired = 0;
  let skippedLowScore = 0;
  let skippedUnavailable = 0;
  let failed = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    try {
      const { data: product, error: productError } = await client
        .from("products")
        .select(
          "id, asin, retailer, title, slug, brand, description, image_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, discount_percentage, availability, is_active, deal_expires_at, category_id, categories(id, name, slug, parent_id, parent:parent_id(id, name, slug))",
        )
        .eq("id", row.product_id)
        .maybeSingle();

      if (productError || !product) {
        await client
          .from("channel_notifications")
          .update({ status: "failed" })
          .eq("id", row.id);
        failed += 1;
        continue;
      }

      const expiresAt = product.deal_expires_at;
      if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
        await client
          .from("channel_notifications")
          .update({ status: "skipped" })
          .eq("id", row.id);
        skippedExpired += 1;
        continue;
      }

      if (
        !product.is_active ||
        product.availability === ProductAvailability.OUT_OF_STOCK
      ) {
        await client
          .from("channel_notifications")
          .update({ status: "skipped" })
          .eq("id", row.id);
        skippedUnavailable += 1;
        continue;
      }

      const currentPrice = toNumber(product.current_price) ?? 0;
      const previousPrice =
        toNumber(product.previous_price) ??
        toNumber(row.old_price) ??
        currentPrice;
      const discount =
        calculateDiscountPercentage(previousPrice, currentPrice) ||
        toNumber(product.discount_percentage) ||
        0;

      const categoryRaw = product.categories;
      const categoryNode = Array.isArray(categoryRaw)
        ? categoryRaw[0]
        : categoryRaw;
      const parentRaw = categoryNode?.parent;
      const parentNode = Array.isArray(parentRaw)
        ? parentRaw[0]
        : parentRaw;
      const parentSlug =
        parentNode?.slug ??
        (categoryNode?.slug ? resolveParentSlug(categoryNode.slug) : null);

      const scoring = dealScoringService.scoreProduct({
        currentPrice,
        previousPrice: previousPrice > currentPrice ? previousPrice : null,
        lowestPrice: toNumber(product.lowest_price),
        categorySlug: parentSlug ?? "otros",
      });

      const minScore = await resolveTelegramMinScoreForRetailer(
        product.retailer,
      );
      if (scoring.score < minScore) {
        await client
          .from("channel_notifications")
          .update({ status: "skipped" })
          .eq("id", row.id);
        skippedLowScore += 1;
        continue;
      }

      const deal: DealCandidate = {
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
        affiliateUrl: generateAffiliateUrl({
          amazon_url: product.amazon_url,
          affiliate_url: product.affiliate_url,
          asin: product.asin,
        }),
        nearHistoricalLow: scoring.level === DealLevel.HISTORICAL_LOW,
        detectedAt: row.created_at,
        expiresAt: expiresAt,
      };

      const message = await sendChannelDealAlert(deal);
      const now = new Date().toISOString();

      await client
        .from("channel_notifications")
        .update({
          status: "sent",
          sent_at: now,
          telegram_message_id: message.message_id,
          score: scoring.score,
          new_price: currentPrice,
          old_price: previousPrice > currentPrice ? previousPrice : null,
          discount_percentage: discount,
          deal_level: scoring.level,
        })
        .eq("id", row.id);

      await client
        .from("products")
        .update({
          last_telegram_notified_at: now,
          last_telegram_notified_price: currentPrice,
          last_telegram_notified_score: scoring.score,
        })
        .eq("id", product.id);

      sent += 1;
      if (index < rows.length - 1) await sleep(SEND_DELAY_MS);
    } catch (error) {
      console.warn(
        "[telegram-flush]",
        error instanceof Error ? error.message : error,
      );
      await client
        .from("channel_notifications")
        .update({ status: "failed" })
        .eq("id", row.id);
      failed += 1;
    }
  }

  const remainingPending = await countQueuedChannelNotifications();
  const nextResumeAt =
    remainingPending > 0 ? resumeIso(rescheduleMinutes) : null;
  const nextLastFlushAt =
    batchDue || remainingPending === 0 ? finishedAt : lastFlush;

  await updateAppSettings({
    lastTelegramFlushAt: nextLastFlushAt,
    telegramFlushResumeAt: nextResumeAt,
  }).catch((error) => {
    console.warn(
      "[telegram-flush] no se pudo guardar ajustes de lote",
      error instanceof Error ? error.message : error,
    );
  });

  return {
    ok: true,
    skipped: false,
    nextFlushAt: nextFlushIso(nextLastFlushAt, batchHours),
    resumeAt: nextResumeAt,
    batchHours,
    pendingBefore,
    remainingPending,
    sent,
    skippedExpired,
    skippedLowScore,
    skippedUnavailable,
    failed,
    finishedAt,
  };
}
