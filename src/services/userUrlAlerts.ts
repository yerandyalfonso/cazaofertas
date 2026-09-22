import { formatEuro, roundMoney, toNumber } from "@/lib/money";
import { buildOutOfStockUpdate } from "@/lib/out-of-stock-policy";
import { isRetailBlockedError } from "@/lib/retail-url-utils";
import {
  alertRetailerSupported,
  detectRetailerFromUrl,
  extractExternalId,
  getRetailerDefinition,
  resolveProductBuyUrl,
  syntheticAsinForRetailer,
  type ProductRetailer,
} from "@/lib/retailers";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { scrapeAmazonProductPage } from "@/providers/price";
import { scrapeKiabiProductPage } from "@/providers/retail/kiabi";
import { scrapeMiraviaProductPage } from "@/providers/retail/miravia";
import {
  closeSharedBrowser,
  scrapeAliexpressProductPage,
  scrapeCarrefourProductPage,
  scrapePcComponentesProductPage,
} from "@/providers/browser";
import { ensureProductFromUrl } from "@/services/products";
import { ProductAvailability } from "@/types";
import {
  isTelegramConfigured,
  sendTelegramMessage,
  buildOfferActionMarkup,
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

interface RetailQuote {
  price: number | null;
  previousPrice: number | null;
  title: string | null;
  productUrl: string;
  availability: ProductAvailability;
}

/** Ficha de producto normalizada, sea la tienda que sea. */
async function fetchRetailQuote(
  retailer: ProductRetailer,
  pageUrl: string,
  externalId: string,
  timeoutMs: number,
): Promise<RetailQuote> {
  if (retailer === "amazon") {
    const quote = await scrapeAmazonProductPage(pageUrl, externalId, {
      timeoutMs,
    });
    return {
      price: quote.price,
      previousPrice: quote.previousPrice ?? null,
      title: quote.title ?? null,
      productUrl: quote.amazonUrl ?? pageUrl,
      availability: quote.availability,
    };
  }

  if (retailer === "kiabi") {
    const quote = await scrapeKiabiProductPage(pageUrl, { timeoutMs });
    return {
      price: quote.price,
      previousPrice: quote.listPrice ?? null,
      title: quote.title ?? null,
      productUrl: quote.productUrl,
      availability:
        quote.availability === "IN_STOCK"
          ? ProductAvailability.IN_STOCK
          : quote.availability === "OUT_OF_STOCK"
            ? ProductAvailability.OUT_OF_STOCK
            : ProductAvailability.UNKNOWN,
    };
  }

  if (retailer === "miravia") {
    const quote = await scrapeMiraviaProductPage(pageUrl, { timeoutMs });
    return {
      price: quote.price,
      previousPrice: quote.listPrice ?? null,
      title: quote.title ?? null,
      productUrl: quote.productUrl,
      availability:
        quote.availability === "IN_STOCK"
          ? ProductAvailability.IN_STOCK
          : quote.availability === "OUT_OF_STOCK"
            ? ProductAvailability.OUT_OF_STOCK
            : ProductAvailability.UNKNOWN,
    };
  }

  // Tiendas solo alcanzables vía navegador headless (Cloudflare Turnstile /
  // ficha renderizada por JS). Nunca usadas por el recheck masivo de ofertas.
  if (retailer === "aliexpress") {
    const quote = await scrapeAliexpressProductPage(pageUrl, { timeoutMs });
    return {
      price: quote.price,
      previousPrice: quote.listPrice,
      title: quote.title,
      productUrl: quote.productUrl,
      availability:
        quote.availability === "IN_STOCK"
          ? ProductAvailability.IN_STOCK
          : quote.availability === "OUT_OF_STOCK"
            ? ProductAvailability.OUT_OF_STOCK
            : ProductAvailability.UNKNOWN,
    };
  }

  if (retailer === "carrefour") {
    const quote = await scrapeCarrefourProductPage(pageUrl, { timeoutMs });
    return {
      price: quote.price,
      previousPrice: quote.listPrice,
      title: quote.title,
      productUrl: quote.productUrl,
      availability:
        quote.availability === "IN_STOCK"
          ? ProductAvailability.IN_STOCK
          : quote.availability === "OUT_OF_STOCK"
            ? ProductAvailability.OUT_OF_STOCK
            : ProductAvailability.UNKNOWN,
    };
  }

  if (retailer === "pccomponentes") {
    const quote = await scrapePcComponentesProductPage(pageUrl, { timeoutMs });
    return {
      price: quote.price,
      previousPrice: quote.listPrice,
      title: quote.title,
      productUrl: quote.productUrl,
      availability:
        quote.availability === "IN_STOCK"
          ? ProductAvailability.IN_STOCK
          : quote.availability === "OUT_OF_STOCK"
            ? ProductAvailability.OUT_OF_STOCK
            : ProductAvailability.UNKNOWN,
    };
  }

  throw new Error(
    `${getRetailerDefinition(retailer).label} aún no soporta el chequeo de alertas.`,
  );
}

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
 * Cron: monitoriza alertas de usuario con URL (Amazon, Kiabi, Miravia).
 * Si el precio baja respecto a last_known_price, notifica por Telegram.
 */
export async function runUserUrlAlerts(options?: {
  limit?: number;
  delayMs?: number;
  /**
   * Tiendas a comprobar en esta corrida. Por defecto, todas menos
   * PcComponentes (que exige IP residencial y solo corre desde el cron
   * local del Mac vía `runUserUrlAlerts({ retailers: ["pccomponentes"] })`).
   */
  retailers?: ProductRetailer[];
}): Promise<UserUrlAlertsResult> {
  const client = createSupabaseServiceClient();
  const limit =
    Number.isFinite(options?.limit) && (options?.limit as number) > 0
      ? (options!.limit as number)
      : 40;
  const delayMs = options?.delayMs ?? 1_400;
  const allowedRetailers: ProductRetailer[] =
    options?.retailers ??
    ["amazon", "kiabi", "miravia", "aliexpress", "carrefour"];

  const { data: alerts, error } = await client
    .from("alerts")
    .select(
      "id, user_id, url, keyword, product_id, last_known_price, last_checked_at, max_price",
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

    const retailer = detectRetailerFromUrl(url) ?? "amazon";
    if (!allowedRetailers.includes(retailer)) {
      // No es esta corrida la que cubre esta tienda (p. ej. PcComponentes
      // solo se revisa desde el cron del Mac). No cuenta como fallo.
      result.skipped += 1;
      continue;
    }
    if (!alertRetailerSupported(retailer)) {
      result.failed += 1;
      console.warn(
        `[user-alerts] Alerta ${alert.id}: ${retailer} no soporta chequeo automático`,
      );
      continue;
    }

    const externalId = extractExternalId(retailer, url);
    if (!externalId) {
      result.failed += 1;
      console.warn(`[user-alerts] Alerta ${alert.id}: URL sin identificador válido`);
      continue;
    }
    const asin = syntheticAsinForRetailer(retailer, externalId);

    try {
      const pageUrl = url;

      let productId = alert.product_id;
      if (!productId) {
        try {
          const ensured = await ensureProductFromUrl(client, pageUrl, {
            retailer,
          });
          productId = ensured.id;
          await client
            .from("alerts")
            .update({ product_id: productId })
            .eq("id", alert.id);
        } catch (ensureError) {
          console.warn(
            `[user-alerts] Alerta ${alert.id}: no se pudo enlazar producto`,
            ensureError instanceof Error ? ensureError.message : ensureError,
          );
        }
      }

      const quote = await fetchRetailQuote(retailer, pageUrl, externalId, 12_000);

      if (quote.price === null) {
        const nowIso = new Date().toISOString();
        await client
          .from("alerts")
          .update({
            last_checked_at: nowIso,
            ...(productId ? { product_id: productId } : {}),
          })
          .eq("id", alert.id);

        if (
          productId &&
          quote.availability === ProductAvailability.OUT_OF_STOCK
        ) {
          const { data: productRow } = await client
            .from("products")
            .select("availability, out_of_stock_at, is_active")
            .eq("id", productId)
            .maybeSingle();

          await client
            .from("products")
            .update(buildOutOfStockUpdate(productRow ?? {}, nowIso))
            .eq("id", productId);
        }
        continue;
      }

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
          ...(productId ? { product_id: productId } : {}),
        })
        .eq("id", alert.id);

      if (productId) {
        const { data: product } = await client
          .from("products")
          .select(
            "id, current_price, previous_price, lowest_price, highest_price",
          )
          .eq("id", productId)
          .maybeSingle();

        if (product) {
          const stored = toNumber(product.current_price);
          const lowest = toNumber(product.lowest_price) ?? currentPrice;
          const highest = toNumber(product.highest_price) ?? currentPrice;
          const priceChanged =
            stored == null || Math.abs(currentPrice - stored) >= 0.01;

          if (priceChanged) {
            const previous =
              stored != null
                ? stored
                : quote.previousPrice != null
                  ? roundMoney(quote.previousPrice)
                  : currentPrice;
            const discount =
              previous > currentPrice
                ? roundMoney(((previous - currentPrice) / previous) * 100)
                : 0;

            await client
              .from("products")
              .update({
                current_price: currentPrice,
                previous_price: previous,
                lowest_price: roundMoney(Math.min(lowest, currentPrice)),
                highest_price: roundMoney(
                  Math.max(highest, currentPrice, previous),
                ),
                discount_percentage: discount,
                last_checked_at: nowIso,
                updated_at: nowIso,
                is_active: true,
              })
              .eq("id", productId);

          }
        }
      }

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

      const title = quote.title?.trim() || alert.keyword || `${retailer} ${asin}`;
      const affiliateUrl = resolveProductBuyUrl({
        retailer,
        asin,
        product_url: quote.productUrl,
        amazon_url: quote.productUrl,
      });
      const discountPct = Math.round(
        ((previousKnown - currentPrice) / previousKnown) * 100,
      );

      let productSlug: string | null = null;
      if (productId) {
        const { data: linked } = await client
          .from("products")
          .select("slug")
          .eq("id", productId)
          .maybeSingle();
        productSlug = linked?.slug ?? null;
      }

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
        replyMarkup: buildOfferActionMarkup({
          affiliateUrl,
          productSlug,
        }),
      });

      result.notified += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Bloqueo anti-bot de la tienda (DataDome, Cloudflare, 403…): transitorio,
      // no es un fallo real de la alerta. No lo contamos como "failed" para no
      // disparar avisos ruidosos al admin en cada ciclo.
      if (isRetailBlockedError(message)) {
        result.skipped += 1;
      } else {
        result.failed += 1;
      }
      console.warn(`[user-alerts] Alerta ${alert.id}:`, message);
    }

    if (index < rows.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  await closeSharedBrowser();
  result.finishedAt = new Date().toISOString();
  return result;
}
