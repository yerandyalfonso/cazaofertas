import { roundMoney, toNumber } from "@/lib/money";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { DealCandidate } from "@/services/alertMatching";
import { resolveTelegramMinScore } from "@/services/appSettings";
import {
  isTelegramChannelConfigured,
  sendChannelDealAlert,
} from "@/services/telegram/bot";

/** Horas sin reenviar el mismo producto al canal. */
const DEFAULT_COOLDOWN_HOURS = 12;

export interface ChannelNotifyResult {
  attempted: boolean;
  sent: boolean;
  skipped: boolean;
  reason?: string;
  score: number;
  minScore: number;
}

function cooldownMs(hours = DEFAULT_COOLDOWN_HOURS): number {
  return hours * 60 * 60 * 1000;
}

/**
 * Envía al canal de Telegram si score >= umbral y no se notificó recientemente
 * (mismo precio o dentro de la ventana de cooldown). Marca el producto en Supabase.
 */
export async function notifyChannelDealIfEligible(
  client: TypedSupabaseClient,
  deal: DealCandidate,
  options?: {
    minScore?: number;
    cooldownHours?: number;
  },
): Promise<ChannelNotifyResult> {
  const minScore =
    options?.minScore ?? (await resolveTelegramMinScore());
  const score = deal.score ?? 0;

  if (!isTelegramChannelConfigured()) {
    return {
      attempted: false,
      sent: false,
      skipped: true,
      reason: "Telegram canal no configurado (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID).",
      score,
      minScore,
    };
  }

  if (score < minScore) {
    return {
      attempted: false,
      sent: false,
      skipped: true,
      reason: `Score ${Math.round(score)} < umbral ${minScore}.`,
      score,
      minScore,
    };
  }

  const { data: product, error: productError } = await client
    .from("products")
    .select(
      "id, last_telegram_notified_at, last_telegram_notified_price, last_telegram_notified_score",
    )
    .eq("id", deal.productId)
    .maybeSingle();

  if (productError) {
    return {
      attempted: false,
      sent: false,
      skipped: true,
      reason: productError.message,
      score,
      minScore,
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
      skipped: true,
      reason: "Ya notificado recientemente al mismo precio.",
      score,
      minScore,
    };
  }

  if (withinCooldown && !samePrice && score < (toNumber(product?.last_telegram_notified_score) ?? 0) + 5) {
    return {
      attempted: false,
      sent: false,
      skipped: true,
      reason: "En cooldown sin mejora relevante de score.",
      score,
      minScore,
    };
  }

  const { data: inserted, error: insertError } = await client
    .from("channel_notifications")
    .insert({
      product_id: deal.productId,
      score,
      old_price: deal.previousPrice,
      new_price: deal.currentPrice,
      discount_percentage: deal.discountPercentage,
      deal_level: deal.dealLevel,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      attempted: true,
      sent: false,
      skipped: false,
      reason: insertError?.message ?? "No se pudo crear channel_notifications.",
      score,
      minScore,
    };
  }

  try {
    const message = await sendChannelDealAlert(deal);
    const now = new Date().toISOString();

    await client
      .from("channel_notifications")
      .update({
        status: "sent",
        sent_at: now,
        telegram_message_id: message.message_id,
      })
      .eq("id", inserted.id);

    await client
      .from("products")
      .update({
        last_telegram_notified_at: now,
        last_telegram_notified_price: deal.currentPrice,
        last_telegram_notified_score: score,
      })
      .eq("id", deal.productId);

    return {
      attempted: true,
      sent: true,
      skipped: false,
      score,
      minScore,
    };
  } catch (error) {
    await client
      .from("channel_notifications")
      .update({ status: "failed" })
      .eq("id", inserted.id);

    return {
      attempted: true,
      sent: false,
      skipped: false,
      reason: error instanceof Error ? error.message : "Error al enviar a Telegram.",
      score,
      minScore,
    };
  }
}

export const channelNotificationsService = {
  notifyChannelDealIfEligible,
};
