import { roundMoney } from "@/lib/money";
import type { TypedSupabaseClient } from "@/lib/supabase";
import {
  findMatchingAlerts,
  type DealCandidate,
} from "@/services/alertMatching";
import {
  isTelegramConfigured,
  sendDealAlertMessage,
} from "@/services/telegram/bot";

export interface NotificationDispatchResult {
  matched: number;
  created: number;
  skippedDuplicates: number;
  sent: number;
  failed: number;
}

async function hasDuplicateNotification(
  client: TypedSupabaseClient,
  userId: string,
  productId: string,
  newPrice: number,
): Promise<boolean> {
  const { data, error } = await client
    .from("notifications")
    .select("id, new_price, status")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .in("status", ["sent", "pending"]);

  if (error) {
    throw new Error(`Error al comprobar notificaciones: ${error.message}`);
  }

  return (data ?? []).some(
    (row) => roundMoney(Number(row.new_price)) === roundMoney(newPrice),
  );
}

export async function notifyMatchingUsers(
  client: TypedSupabaseClient,
  deal: DealCandidate,
  options?: { excludeAlertId?: string },
): Promise<NotificationDispatchResult> {
  const matches = await findMatchingAlerts(client, deal, options);
  const result: NotificationDispatchResult = {
    matched: matches.length,
    created: 0,
    skippedDuplicates: 0,
    sent: 0,
    failed: 0,
  };

  const telegramReady = isTelegramConfigured();

  for (const match of matches) {
    const isDuplicate = await hasDuplicateNotification(
      client,
      match.user.id,
      deal.productId,
      deal.currentPrice,
    );

    if (isDuplicate) {
      result.skippedDuplicates += 1;
      continue;
    }

    const { data: inserted, error: insertError } = await client
      .from("notifications")
      .insert({
        user_id: match.user.id,
        product_id: deal.productId,
        alert_id: match.alert.id,
        old_price: deal.previousPrice,
        new_price: deal.currentPrice,
        discount_percentage: deal.discountPercentage,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      result.failed += 1;
      continue;
    }

    result.created += 1;

    if (!telegramReady || match.user.telegram_id === null) {
      await client
        .from("notifications")
        .update({ status: "skipped_no_telegram" })
        .eq("id", inserted.id);
      result.failed += 1;
      continue;
    }

    try {
      await sendDealAlertMessage({
        chatId: match.user.telegram_id,
        deal,
      });

      await client
        .from("notifications")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", inserted.id);

      result.sent += 1;
    } catch {
      await client
        .from("notifications")
        .update({ status: "failed" })
        .eq("id", inserted.id);
      result.failed += 1;
    }
  }

  return result;
}

export const notificationsService = {
  notifyMatchingUsers,
};
