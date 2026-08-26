import {
  extractAsin,
  generateAffiliateUrl,
  generateAmazonUrl,
  looksLikeAmazonUrl,
} from "@/lib/affiliate";
import { formatEuro, roundMoney } from "@/lib/money";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { scrapeAmazonProductPage } from "@/providers/price";
import {
  isTelegramConfigured,
  sendTelegramMessage,
} from "@/services/telegram/bot";

export interface UserUrlAlertsResult {
  ok: true;
  checked: number;
  priceDrops: number;
  notified: number;
  failed: number;
  skipped: number;
  finishedAt: string;
}

export { looksLikeAmazonUrl };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Cron: monitoriza alertas de usuario con URL de Amazon.
 * Si el precio baja respecto a last_known_price, notifica por Telegram.
 */
export async function runUserUrlAlerts(options?: {
  limit?: number;
  delayMs?: number;
}): Promise<UserUrlAlertsResult> {
  const client = createSupabaseServiceClient();
  const limit =
    Number.isFinite(options?.limit) && (options?.limit as number) > 0
      ? (options!.limit as number)
      : 40;
  const delayMs = options?.delayMs ?? 1_400;

  const { data: alerts, error } = await client
    .from("alerts")
    .select(
      "id, user_id, url, keyword, last_known_price, last_checked_at, max_price",
    )
    .eq("is_active", true)
    .not("url", "is", null)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(`No se pudieron leer alertas con URL: ${error.message}`);
  }

  const result: UserUrlAlertsResult = {
    ok: true,
    checked: 0,
    priceDrops: 0,
    notified: 0,
    failed: 0,
    skipped: 0,
    finishedAt: new Date().toISOString(),
  };

  const telegramReady = isTelegramConfigured();
  const rows = alerts ?? [];

  for (let index = 0; index < rows.length; index += 1) {
    const alert = rows[index]!;
    const url = alert.url?.trim() ?? "";
    if (!url) {
      result.skipped += 1;
      continue;
    }

    const asin = extractAsin(url);
    if (!asin) {
      result.failed += 1;
      console.warn(`[user-alerts] Alerta ${alert.id}: URL sin ASIN válido`);
      continue;
    }

    try {
      const pageUrl = /https?:\/\//i.test(url)
        ? url
        : generateAmazonUrl(asin);
      const quote = await scrapeAmazonProductPage(pageUrl, asin, {
        timeoutMs: 12_000,
      });
      const currentPrice = roundMoney(quote.price);
      const previousKnown =
        alert.last_known_price === null || alert.last_known_price === undefined
          ? null
          : roundMoney(Number(alert.last_known_price));

      const nowIso = new Date().toISOString();
      await client
        .from("alerts")
        .update({
          last_checked_at: nowIso,
          last_known_price: currentPrice,
        })
        .eq("id", alert.id);

      result.checked += 1;

      const isDrop =
        previousKnown !== null && currentPrice < previousKnown - 0.009;

      if (!isDrop) {
        if (index < rows.length - 1 && delayMs > 0) await sleep(delayMs);
        continue;
      }

      result.priceDrops += 1;

      if (
        alert.max_price !== null &&
        alert.max_price !== undefined &&
        currentPrice > Number(alert.max_price)
      ) {
        result.skipped += 1;
        if (index < rows.length - 1 && delayMs > 0) await sleep(delayMs);
        continue;
      }

      const { data: user, error: userError } = await client
        .from("users")
        .select("id, telegram_id")
        .eq("id", alert.user_id)
        .maybeSingle();

      if (userError || !user?.telegram_id || !telegramReady) {
        result.failed += 1;
        if (index < rows.length - 1 && delayMs > 0) await sleep(delayMs);
        continue;
      }

      const title = quote.title?.trim() || alert.keyword || `ASIN ${asin}`;
      const affiliateUrl = generateAffiliateUrl(
        quote.amazonUrl ?? generateAmazonUrl(asin),
      );
      const discountPct = Math.round(
        ((previousKnown - currentPrice) / previousKnown) * 100,
      );

      await sendTelegramMessage({
        chatId: user.telegram_id,
        text: [
          "📉 <b>Bajada en tu alerta de URL</b>",
          "",
          escapeHtml(title),
          `Antes: <s>${formatEuro(previousKnown)}</s>`,
          `Ahora: <b>${formatEuro(currentPrice)}</b> (−${discountPct}%)`,
        ].join("\n"),
        disableWebPagePreview: false,
        replyMarkup: {
          inline_keyboard: [
            [{ text: "🛒 Ver en Amazon", url: affiliateUrl }],
          ],
        },
      });

      result.notified += 1;
    } catch (error) {
      result.failed += 1;
      console.warn(
        `[user-alerts] Alerta ${alert.id}:`,
        error instanceof Error ? error.message : error,
      );
    }

    if (index < rows.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  result.finishedAt = new Date().toISOString();
  return result;
}
