import { roundMoney, toNumber } from "@/lib/money";
import { marketplaceAbsoluteUrl } from "@/lib/site";
import type { TypedSupabaseClient } from "@/lib/supabase";
import {
  findMatchingAlerts,
  type DealCandidate,
} from "@/services/alertMatching";
import {
  escapeHtml,
  isTelegramConfigured,
  sendDealAlertMessage,
  sendTelegramMessage,
} from "@/services/telegram/bot";

/** Avisos sueltos por alerta en 24 h; el resto se agrupa en un resumen. */
export const ALERT_MAX_NOTIFICATIONS_PER_24H = 10;
const CAP_WINDOW_MS = 24 * 3_600_000;
const DIGEST_MAX_ITEMS = 10;

export interface NotificationDispatchResult {
  matched: number;
  created: number;
  skippedDuplicates: number;
  capped: number;
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
    .in("status", ["sent", "pending", "capped", "capped_digest_sent"]);

  if (error) {
    throw new Error(`Error al comprobar notificaciones: ${error.message}`);
  }

  return (data ?? []).some(
    (row) => roundMoney(Number(row.new_price)) === roundMoney(newPrice),
  );
}

async function isAlertOverDailyCap(
  client: TypedSupabaseClient,
  alertId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - CAP_WINDOW_MS).toISOString();
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("alert_id", alertId)
    .eq("status", "sent")
    .gte("sent_at", since);
  if (error) {
    throw new Error(`Error al contar avisos de la alerta: ${error.message}`);
  }
  return (count ?? 0) >= ALERT_MAX_NOTIFICATIONS_PER_24H;
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
    capped: 0,
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

    // Tope diario por alerta (las de producto/URL no se limitan): el
    // excedente queda como `capped` y sale agrupado en sendCappedAlertDigests.
    const overCap =
      !match.alert.product_id &&
      (await isAlertOverDailyCap(client, match.alert.id));

    const { data: inserted, error: insertError } = await client
      .from("notifications")
      .insert({
        user_id: match.user.id,
        product_id: deal.productId,
        alert_id: match.alert.id,
        old_price: deal.previousPrice,
        new_price: deal.currentPrice,
        discount_percentage: deal.discountPercentage,
        status: overCap ? "capped" : "pending",
      })
      .select("id")
      .single();

    if (overCap) {
      if (insertError || !inserted) result.failed += 1;
      else result.capped += 1;
      continue;
    }

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

export interface CappedDigestResult {
  alerts: number;
  items: number;
  sent: number;
  failed: number;
}

interface CappedRow {
  id: string;
  alert_id: string | null;
  discount_percentage: number | string | null;
  new_price: number | string;
  products: { title: string; slug: string } | null;
  users: { telegram_id: number | null } | null;
  alerts: {
    brand: string | null;
    categories: { name: string } | null;
  } | null;
}

function describeAlert(row: CappedRow): string {
  const parts = [
    row.alerts?.categories?.name,
    row.alerts?.brand?.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "tu alerta";
}

/**
 * Envía un único mensaje por alerta con los avisos que superaron el tope
 * diario (`capped`), ordenados por descuento. Corre en el cron user-alerts.
 */
export async function sendCappedAlertDigests(
  client: TypedSupabaseClient,
): Promise<CappedDigestResult> {
  const result: CappedDigestResult = { alerts: 0, items: 0, sent: 0, failed: 0 };

  const { data, error } = await client
    .from("notifications")
    .select(
      "id, alert_id, discount_percentage, new_price, products(title, slug), users(telegram_id), alerts(brand, categories(name))",
    )
    .eq("status", "capped")
    .limit(1000);
  if (error) {
    throw new Error(`No se pudieron leer avisos agrupados: ${error.message}`);
  }

  const byAlert = new Map<string, CappedRow[]>();
  for (const row of (data ?? []) as unknown as CappedRow[]) {
    const key = row.alert_id ?? "none";
    byAlert.set(key, [...(byAlert.get(key) ?? []), row]);
  }

  for (const rows of byAlert.values()) {
    result.alerts += 1;
    result.items += rows.length;
    const ids = rows.map((row) => row.id);
    const chatId = rows[0]?.users?.telegram_id;

    if (!isTelegramConfigured() || chatId == null) {
      await client
        .from("notifications")
        .update({ status: "skipped_no_telegram" })
        .in("id", ids);
      result.failed += 1;
      continue;
    }

    const top = [...rows]
      .sort(
        (a, b) =>
          (toNumber(b.discount_percentage) ?? 0) -
          (toNumber(a.discount_percentage) ?? 0),
      )
      .slice(0, DIGEST_MAX_ITEMS);

    const lines = [
      `🔔 <b>${rows.length} chollos más para ${escapeHtml(describeAlert(rows[0]!))}</b>`,
      `Tu alerta superó ${ALERT_MAX_NOTIFICATIONS_PER_24H} avisos en 24 h; aquí van agrupados:`,
      "",
      ...top.map((row) => {
        const discount = Math.round(toNumber(row.discount_percentage) ?? 0);
        const price = roundMoney(Number(row.new_price)).toFixed(2).replace(".", ",");
        const title = escapeHtml((row.products?.title ?? "Producto").slice(0, 70));
        const link = row.products?.slug
          ? marketplaceAbsoluteUrl(`/oferta/${row.products.slug}`)
          : null;
        const label = link ? `<a href="${escapeHtml(link)}">${title}</a>` : title;
        return `• -${discount}% · ${price} € · ${label}`;
      }),
    ];
    if (rows.length > top.length) {
      lines.push("", `…y ${rows.length - top.length} más.`);
    }

    try {
      await sendTelegramMessage({ chatId, text: lines.join("\n") });
      await client
        .from("notifications")
        .update({
          status: "capped_digest_sent",
          sent_at: new Date().toISOString(),
        })
        .in("id", ids);
      result.sent += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

export const notificationsService = {
  notifyMatchingUsers,
  sendCappedAlertDigests,
};
