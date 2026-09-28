import { roundMoney } from "@/lib/money";
import { alertRecipient } from "@/services/testUsers";
import type { TypedSupabaseClient } from "@/lib/supabase";
import {
  findMatchingAlerts,
  type DealCandidate,
} from "@/services/alertMatching";
import {
  isTelegramConfigured,
  sendDealAlertMessage,
} from "@/services/telegram/bot";

/** Sin repetir otra variante (talla/color) del mismo padre al mismo usuario. */
const VARIANT_WINDOW_MS = 24 * 3_600_000;

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
    .select("id, new_price, status, sent_at")
    .eq("user_id", userId)
    .eq("product_id", productId)
    .in("status", ["sent", "pending"]);

  if (error) {
    throw new Error(`Error al comprobar notificaciones: ${error.message}`);
  }

  // Mismo precio, o uno que solo baja céntimos (<2 %) respecto a lo ya avisado
  // en los últimos 7 días: no se repite (precios que oscilan 11,35 ↔ 11,34).
  const recentSince = Date.now() - 7 * 24 * 3_600_000;
  return (data ?? []).some((row) => {
    const notified = roundMoney(Number(row.new_price));
    if (notified === roundMoney(newPrice)) return true;
    const recent = !row.sent_at || new Date(row.sent_at).getTime() >= recentSince;
    return recent && newPrice >= notified * 0.98;
  });
}

/** ¿Ya avisamos a este usuario de otra variante (talla/color) del mismo padre? */
async function hasRecentSiblingNotification(
  client: TypedSupabaseClient,
  userId: string,
  productId: string,
  parentAsin: string,
): Promise<boolean> {
  const { data: siblings } = await client
    .from("products")
    .select("id")
    .eq("parent_asin", parentAsin)
    .neq("id", productId)
    .limit(500);
  const siblingIds = (siblings ?? []).map((row) => row.id);
  if (siblingIds.length === 0) return false;

  const since = new Date(Date.now() - VARIANT_WINDOW_MS).toISOString();
  const { count } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("product_id", siblingIds)
    .eq("status", "sent")
    .gte("sent_at", since);
  return (count ?? 0) > 0;
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

    const parentAsin = deal.variants?.parentAsin;
    if (
      isDuplicate ||
      (parentAsin &&
        (await hasRecentSiblingNotification(
          client,
          match.user.id,
          deal.productId,
          parentAsin,
        )))
    ) {
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

    const recipient = alertRecipient(match.user);
    if (!telegramReady || !recipient) {
      await client
        .from("notifications")
        .update({ status: "skipped_no_telegram" })
        .eq("id", inserted.id);
      result.failed += 1;
      continue;
    }

    try {
      await sendDealAlertMessage({
        chatId: recipient.chatId,
        deal: recipient.testLabel
          ? { ...deal, title: `${recipient.testLabel} · ${deal.title}` }
          : deal,
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
