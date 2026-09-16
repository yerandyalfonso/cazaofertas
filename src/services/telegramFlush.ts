import { generateAffiliateUrl } from "@/lib/affiliate";
import { calculateDiscountPercentage, toNumber } from "@/lib/money";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { resolveParentSlug } from "@/lib/category-taxonomy";
import type { DealCandidate } from "@/services/alertMatching";
import {
  getAppSettings,
  getTelegramFlushRescheduleMinutes,
  persistTelegramFlushAt,
  resolveTelegramFlushLimit,
  resolveTelegramMinScoreForRetailer,
  updateAppSettings,
} from "@/services/appSettings";
import { dealScoringService } from "@/services/deal-scoring";
import { sendChannelDealAlert } from "@/services/telegram/bot";
import { DealLevel, ProductAvailability } from "@/types";

const SEND_DELAY_MS = 1_200;

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

export interface TelegramBatchSchedule {
  batchHours: number;
  lastFlushAt: string | null;
  nextFlushAt: string | null;
  batchDue: boolean;
  pending: number;
  queued: number;
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

function isBatchDue(
  lastFlushAt: string | null,
  batchHours: number,
  nowMs = Date.now(),
): boolean {
  if (!lastFlushAt) return true;
  return (
    nowMs >=
    new Date(lastFlushAt).getTime() + batchHours * 60 * 60 * 1000
  );
}

function isResumeDue(
  resumeAt: string | null,
  nowMs = Date.now(),
): boolean {
  return resumeAt !== null && nowMs >= new Date(resumeAt).getTime();
}

export async function countPendingChannelNotifications(): Promise<number> {
  return countQueuedChannelNotifications(["pending"]);
}

export interface ChannelNotificationQueueStats {
  pending: number;
  failed: number;
  /** Pendientes + fallidos (cola que reintenta el flush). */
  queued: number;
}

export async function getChannelNotificationQueueStats(): Promise<ChannelNotificationQueueStats> {
  try {
    const client = createSupabaseServiceClient();
    const [pendingRes, failedRes] = await Promise.all([
      client
        .from("channel_notifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      client
        .from("channel_notifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
    ]);
    const pending = pendingRes.error ? 0 : (pendingRes.count ?? 0);
    const failed = failedRes.error ? 0 : (failedRes.count ?? 0);
    return { pending, failed, queued: pending + failed };
  } catch {
    return { pending: 0, failed: 0, queued: 0 };
  }
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

/** Estado del intervalo de lote (sin enviar). */
export async function getTelegramBatchSchedule(): Promise<TelegramBatchSchedule> {
  const settings = await getAppSettings();
  const queue = await getChannelNotificationQueueStats();
  const batchDue = isBatchDue(
    settings.lastTelegramFlushAt,
    settings.telegramBatchHours,
  );

  return {
    batchHours: settings.telegramBatchHours,
    lastFlushAt: settings.lastTelegramFlushAt,
    nextFlushAt: nextFlushIso(
      settings.lastTelegramFlushAt,
      settings.telegramBatchHours,
    ),
    batchDue,
    pending: queue.pending,
    queued: queue.queued,
  };
}

/**
 * Intenta publicar el lote si toca el intervalo. Los crons de discovery solo encolan.
 */
export async function maybeFlushTelegramBatch(options?: {
  force?: boolean;
  limit?: number;
}): Promise<TelegramFlushResult> {
  return flushPendingChannelNotifications(options);
}

/**
 * Publica en Telegram los chollos pendientes (grupo + canal).
 * Envía cuando toca el intervalo (`telegramBatchHours`), hay reintento
 * programado (`telegramFlushResumeAt`) o con `force: true` (admin).
 * Si quedan items en cola, agenda otro envío en `telegramFlushRescheduleMinutes`.
 */
export async function flushPendingChannelNotifications(options?: {
  force?: boolean;
  limit?: number;
}): Promise<TelegramFlushResult> {
  const finishedAt = new Date().toISOString();
  const settings = await getAppSettings();
  const batchHours = settings.telegramBatchHours;
  const lastFlush = settings.lastTelegramFlushAt;
  const scheduledResumeAt = settings.telegramFlushResumeAt;
  const nextFlushAt = nextFlushIso(lastFlush, batchHours);
  const batchDue = isBatchDue(lastFlush, batchHours);
  const resumeDue = isResumeDue(scheduledResumeAt);
  const rescheduleMinutes = await getTelegramFlushRescheduleMinutes();
  const queue = await getChannelNotificationQueueStats();

  if (!options?.force && !batchDue && !resumeDue) {
    const waitHint = scheduledResumeAt
      ? ` Reintento parcial: ${new Date(scheduledResumeAt).toLocaleString("es-ES")}.`
      : ` Próximo lote: ${new Date(nextFlushAt).toLocaleString("es-ES")}.`;
    return {
      ok: true,
      skipped: true,
      reason: `Aún no toca el lote (cada ${batchHours} h).${waitHint}`,
      nextFlushAt,
      resumeAt: scheduledResumeAt,
      batchHours,
      pendingBefore: queue.queued,
      remainingPending: queue.queued,
      sent: 0,
      skippedExpired: 0,
      skippedLowScore: 0,
      skippedUnavailable: 0,
      failed: 0,
      finishedAt,
    };
  }

  const client = createSupabaseServiceClient();
  const defaultLimit = await resolveTelegramFlushLimit();
  const limit =
    options?.limit && options.limit > 0
      ? Math.min(options.limit, 80)
      : defaultLimit;

  const pendingBefore = queue.queued;

  if (pendingBefore === 0) {
    // Cola vacía: limpia resume. Solo avanza el reloj del lote si tocaba el intervalo.
    if (!options?.force) {
      if (batchDue) {
        await persistTelegramFlushAt(finishedAt);
      } else if (scheduledResumeAt) {
        try {
          await updateAppSettings({ telegramFlushResumeAt: null });
        } catch (error) {
          console.warn(
            "[telegram-flush] no se pudo limpiar resume",
            error instanceof Error ? error.message : error,
          );
        }
      }
    }
    return {
      ok: true,
      skipped: true,
      reason: "Toca lote pero no hay nada en cola.",
      nextFlushAt: nextFlushIso(
        batchDue || options?.force ? finishedAt : lastFlush,
        batchHours,
      ),
      resumeAt: null,
      batchHours,
      pendingBefore: 0,
      remainingPending: 0,
      sent: 0,
      skippedExpired: 0,
      skippedLowScore: 0,
      skippedUnavailable: 0,
      failed: 0,
      finishedAt,
    };
  }

  // Priorizar pending: los failed antiguos no deben comerse todo el cupo del lote.
  const { data: pendingRows, error: pendingError } = await client
    .from("channel_notifications")
    .select("id, product_id, created_at, old_price, new_price, status")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (pendingError) {
    throw new Error(pendingError.message);
  }

  const remainingSlots = Math.max(0, limit - (pendingRows?.length ?? 0));
  const { data: failedRows, error: failedError } =
    remainingSlots > 0
      ? await client
          .from("channel_notifications")
          .select("id, product_id, created_at, old_price, new_price, status")
          .eq("status", "failed")
          .order("created_at", { ascending: true })
          .limit(remainingSlots)
      : { data: [] as Array<{
          id: string;
          product_id: string;
          created_at: string;
          old_price: number | null;
          new_price: number | null;
          status: string;
        }>, error: null };

  if (failedError) {
    throw new Error(failedError.message);
  }

  const rows = [...(pendingRows ?? []), ...(failedRows ?? [])];
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

  // Si quedan pendientes/fallidos, programa reintento en N minutos (ajuste admin).
  // El reloj del lote solo avanza en el envío programado (batchDue), force o cola vacía;
  // así un resume parcial no empuja el próximo lote completo N horas.
  const nextResumeAt =
    remainingPending > 0 ? resumeIso(rescheduleMinutes) : null;
  const shouldAdvanceClock =
    Boolean(options?.force) || batchDue || remainingPending === 0;
  const nextLastFlushAt = shouldAdvanceClock ? finishedAt : lastFlush;

  try {
    await updateAppSettings({
      lastTelegramFlushAt: nextLastFlushAt,
      telegramFlushResumeAt: nextResumeAt,
    });
  } catch (error) {
    console.warn(
      "[telegram-flush] no se pudo guardar ajustes de lote",
      error instanceof Error ? error.message : error,
    );
  }

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
