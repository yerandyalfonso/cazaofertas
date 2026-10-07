import { roundMoney, toNumber } from "@/lib/money";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { DealCandidate } from "@/services/alertMatching";
import { resolveTelegramMinDiscountPercent } from "@/services/appSettings";
import { isTelegramChannelConfigured } from "@/services/telegram/bot";

/** Horas sin re-encolar el mismo producto al mismo precio tras un envío real. */
const DEFAULT_COOLDOWN_HOURS = 12;

export interface ChannelNotifyResult {
  attempted: boolean;
  sent: boolean;
  queued: boolean;
  skipped: boolean;
  reason?: string;
  score: number;
  /** Descuento del deal (%). */
  discountPercentage: number;
  /** Umbral admin de % para el canal. */
  minDiscountPercent: number;
  /** @deprecated Alias de minDiscountPercent (compat). */
  minScore: number;
}

function cooldownMs(hours = DEFAULT_COOLDOWN_HOURS): number {
  return hours * 60 * 60 * 1000;
}

/**
 * Encola un chollo para el grupo/canal si pasa umbral de % y cooldown.
 * y lo publica al momento (`flushPendingChannelNotifications`); lo que falle
 * queda en cola para el siguiente envío.
 */
export async function notifyChannelDealIfEligible(
  client: TypedSupabaseClient,
  deal: DealCandidate,
  options?: {
    /** @deprecated Ignorado; el umbral es global por % (admin). */
    minScore?: number;
    minDiscountPercent?: number;
    cooldownHours?: number;
  },
): Promise<ChannelNotifyResult> {
  const minDiscountPercent =
    options?.minDiscountPercent ?? (await resolveTelegramMinDiscountPercent());
  const score = deal.score ?? 0;
  const discountPercentage = deal.discountPercentage ?? 0;

  const base = {
    score,
    discountPercentage,
    minDiscountPercent,
    minScore: minDiscountPercent,
  };

  if (!isTelegramChannelConfigured()) {
    return {
      attempted: false,
      sent: false,
      queued: false,
      skipped: true,
      reason: "Telegram canal no configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID).",
      ...base,
    };
  }

  // Miravia: el «precio original» lo pone cada vendedor (muchos al doble del
  // precio) y no hay mínimo de 30 días. Solo bajadas que hemos visto nosotros.
  if (deal.retailer === "miravia" && !deal.referenceObserved) {
    return {
      attempted: false,
      sent: false,
      queued: false,
      skipped: true,
      reason: "Miravia: solo se publican bajadas observadas por nosotros.",
      ...base,
    };
  }

  if (discountPercentage < minDiscountPercent) {
    return {
      attempted: false,
      sent: false,
      queued: false,
      skipped: true,
      reason: `Descuento −${Math.round(discountPercentage)}% < umbral −${minDiscountPercent}%.`,
      ...base,
    };
  }

  const { data: product, error: productError } = await client
    .from("products")
    .select(
      "id, last_telegram_notified_at, last_telegram_notified_price, last_telegram_notified_score, deal_expires_at",
    )
    .eq("id", deal.productId)
    .maybeSingle();

  if (productError) {
    return {
      attempted: false,
      sent: false,
      queued: false,
      skipped: true,
      reason: productError.message,
      ...base,
    };
  }

  const expiresAt = product?.deal_expires_at
    ? new Date(product.deal_expires_at).getTime()
    : deal.expiresAt
      ? new Date(deal.expiresAt).getTime()
      : null;
  if (expiresAt !== null && expiresAt <= Date.now()) {
    return {
      attempted: false,
      sent: false,
      queued: false,
      skipped: true,
      reason: "La oferta ya ha caducado.",
      ...base,
    };
  }

  const { data: pendingRow } = await client
    .from("channel_notifications")
    .select("id")
    .eq("product_id", deal.productId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingRow?.id) {
    await client
      .from("channel_notifications")
      .update({
        score,
        old_price: deal.previousPrice,
        new_price: deal.currentPrice,
        discount_percentage: deal.discountPercentage,
        deal_level: deal.dealLevel,
      })
      .eq("id", pendingRow.id);

    return {
      attempted: true,
      sent: false,
      queued: true,
      skipped: false,
      reason: "Ya en cola; se actualizó el precio/score.",
      ...base,
    };
  }

  const lastAt = product?.last_telegram_notified_at
    ? new Date(product.last_telegram_notified_at).getTime()
    : null;
  const lastPrice = toNumber(product?.last_telegram_notified_price ?? null);
  const withinCooldown =
    lastAt !== null && Date.now() - lastAt < cooldownMs(options?.cooldownHours);
  const samePrice =
    lastPrice !== null &&
    roundMoney(lastPrice) === roundMoney(deal.currentPrice);

  if (withinCooldown && samePrice) {
    return {
      attempted: false,
      sent: false,
      queued: false,
      skipped: true,
      reason: "Ya notificado recientemente al mismo precio.",
      ...base,
    };
  }

  if (
    withinCooldown &&
    !samePrice &&
    score < (toNumber(product?.last_telegram_notified_score) ?? 0) + 5
  ) {
    return {
      attempted: false,
      sent: false,
      queued: false,
      skipped: true,
      reason: "En cooldown sin mejora relevante de score.",
      ...base,
    };
  }

  const { error: insertError } = await client
    .from("channel_notifications")
    .insert({
      product_id: deal.productId,
      score,
      old_price: deal.previousPrice,
      new_price: deal.currentPrice,
      discount_percentage: deal.discountPercentage,
      deal_level: deal.dealLevel,
      status: "pending",
    });

  if (insertError) {
    return {
      attempted: true,
      sent: false,
      queued: false,
      skipped: false,
      reason: insertError.message,
      ...base,
    };
  }

  // Publicar en el momento (sin esperar al lote): los precios de las ofertas
  // cambian en minutos. El envío «reserva» cada fila, así que VPS y Mac no
  // duplican. Si falla, queda en cola para el siguiente intento.
  let sentNow = false;
  try {
    const { flushPendingChannelNotifications } = await import("@/services/telegramFlush");
    const flushed = await flushPendingChannelNotifications({ force: true, limit: 5 });
    sentNow = flushed.sent > 0;
  } catch (error) {
    console.warn(
      "[telegram] No se pudo publicar al momento; queda en cola:",
      error instanceof Error ? error.message : error,
    );
  }

  return {
    attempted: true,
    sent: sentNow,
    queued: !sentNow,
    skipped: false,
    ...base,
  };
}

export const channelNotificationsService = {
  notifyChannelDealIfEligible,
};
