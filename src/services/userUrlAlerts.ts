import { primePriceFields } from "@/lib/primePrice";
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
import { scrapeMediaMarktProductPage } from "@/providers/retail/mediamarkt";
import {
  closeSharedBrowser,
  scrapeAliexpressProductPage,
  scrapeCarrefourProductPage,
  scrapePcComponentesProductPage,
} from "@/providers/browser";
import { ensureProductFromUrl } from "@/services/products";
import { alertRecipient } from "@/services/testUsers";
import { retailerLabel } from "@/lib/retailers";
import { AMAZON_FOREIGN_DELIVERY_ERROR } from "@/providers/price/AmazonHtmlPriceProvider";
import { DealLevel, ProductAvailability } from "@/types";
import {
  isTelegramConfigured,
  sendTelegramMessage,
  sendDealAlertMessage,
  buildOfferActionMarkup,
} from "@/services/telegram/bot";
import { notifyChannelDealIfEligible } from "@/services/telegram";
import { notifyMatchingUsers } from "@/services/notifications";
import { dealScoringService } from "@/services/deal-scoring";
import type { DealCandidate } from "@/services/alertMatching";

export interface UserUrlAlertsResult {
  ok: true;
  checked: number;
  priceDrops: number;
  notified: number;
  failed: number;
  skipped: number;
  /** Motivos de fallos y omisiones: «motivo» → número de alertas. */
  reasons: Record<string, number>;
  /** Alertas desactivadas por fallar ≥12 veces durante ≥3 días. */
  deactivated: number;
  /** Hasta 6 ejemplos (motivo + enlace) para diagnosticar. */
  examples: Array<{ reason: string; url: string; detail?: string }>;
  finishedAt: string;
}

function isForeignDeliveryError(message: string): boolean {
  return message.includes(AMAZON_FOREIGN_DELIVERY_ERROR);
}

/** Bajada mínima para avisar en una alerta de URL. */
const MIN_DROP_PERCENT = 2;
const MIN_DROP_EUR = 0.1;

const BROKEN_ALERT_MIN_FAILURES = 12;
const BROKEN_ALERT_MIN_AGE_MS = 3 * 24 * 3_600_000;

/** Agrupa el mensaje de error en un motivo legible (para contar y avisar). */
function reasonFromError(message: string): string {
  if (isForeignDeliveryError(message)) {
    return "Amazon sin precio para envío fuera de España (IP del servidor)";
  }
  if (isRetailBlockedError(message)) return "Bloqueo anti-bot de la tienda";
  if (/timeout|timed out|aborted|ETIMEDOUT/i.test(message)) return "Tiempo de espera agotado";
  if (/\b404\b|not found|no encontrado/i.test(message)) return "Producto no encontrado (404)";
  if (/\b5\d\d\b/.test(message)) return "Error del servidor de la tienda (5xx)";
  if (/ENOTFOUND|ECONNRESET|ECONNREFUSED|fetch failed|socket/i.test(message)) return "Error de red";
  return `Otro error: ${message.slice(0, 80)}`;
}

interface RetailQuote {
  price: number | null;
  previousPrice: number | null;
  title: string | null;
  productUrl: string;
  availability: ProductAvailability;
  /** Oferta Prime (sin Prime cuesta `regularPrice`). */
  primeOnly?: boolean;
  regularPrice?: number | null;
}

/**
 * Tiendas cuya ficha bloquea el anti-bot (Kiabi/DataDome) pero cuyo precio ya
 * refresca otro job (kiabi-deals). Para sus alertas se usa el precio del
 * catálogo si es reciente, en vez de leer la ficha.
 */
const CATALOG_PRICE_RETAILERS: ProductRetailer[] = ["kiabi"];
const CATALOG_PRICE_MAX_AGE_MS = 24 * 3_600_000;

async function quoteFromFreshCatalog(
  client: ReturnType<typeof createSupabaseServiceClient>,
  retailer: ProductRetailer,
  productId: string | null,
  pageUrl: string,
): Promise<RetailQuote | null> {
  if (!productId || !CATALOG_PRICE_RETAILERS.includes(retailer)) return null;
  const { data } = await client
    .from("products")
    .select("current_price, previous_price, title, product_url, availability, last_checked_at")
    .eq("id", productId)
    .maybeSingle();
  if (!data?.last_checked_at) return null;
  if (Date.now() - new Date(data.last_checked_at).getTime() > CATALOG_PRICE_MAX_AGE_MS) return null;
  return {
    price: toNumber(data.current_price),
    previousPrice: toNumber(data.previous_price),
    title: data.title,
    productUrl: data.product_url || pageUrl,
    availability: (data.availability as ProductAvailability) ?? ProductAvailability.IN_STOCK,
  };
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
      primeOnly: quote.primeOnly,
      regularPrice: quote.regularPrice ?? null,
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

  if (retailer === "mediamarkt") {
    const quote = await scrapeMediaMarktProductPage(pageUrl, { timeoutMs });
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
   * PcComponentes, Carrefour y MediaMarkt (exigen IP residencial y solo corren desde el
   * cron local del Mac vía `runUserUrlAlerts({ retailers: [...] })`).
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
    ["amazon", "kiabi", "miravia", "aliexpress"];

  const { data: alerts, error } = await client
    .from("alerts")
    .select(
      "id, user_id, url, keyword, product_id, last_known_price, last_checked_at, max_price, fail_count, first_failed_at, last_notified_price",
    )
    .eq("is_active", true)
    .not("url", "is", null)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    // Margen para saltar alertas de tiendas que revisa la otra corrida
    // (Carrefour/PcComponentes solo desde el Mac): no se mueven de la cola
    // y, sin margen, ocupaban huecos del lote en cada ejecución.
    .limit(limit + 200);

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
    reasons: {},
    deactivated: 0,
    examples: [],
    finishedAt: new Date().toISOString(),
  };
  // Una alerta que falla u omite también pasa al final de la cola: si no,
  // las bloqueadas (p. ej. Kiabi) ocupan siempre la cabeza del lote.
  const moveToBack = async (alertId: string) => {
    await client
      .from("alerts")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", alertId);
  };
  /**
   * Fallo real (no bloqueos ni «fuera de España»): suma al contador y, tras
   * ≥12 fallos durante ≥3 días, desactiva la alerta y avisa al usuario.
   */
  const recordRealFailure = async (
    row: { id: string; user_id: string; url: string | null; keyword: string | null; product_id: string | null; last_known_price: number | string | null; fail_count: number | null; first_failed_at: string | null },
  ) => {
    const count = (row.fail_count ?? 0) + 1;
    const firstFailedAt = row.first_failed_at ?? new Date().toISOString();
    const ageMs = Date.now() - new Date(firstFailedAt).getTime();
    const deactivate = count >= BROKEN_ALERT_MIN_FAILURES && ageMs >= BROKEN_ALERT_MIN_AGE_MS;
    await client
      .from("alerts")
      .update({
        fail_count: count,
        first_failed_at: firstFailedAt,
        ...(deactivate ? { is_active: false } : {}),
      })
      .eq("id", row.id);
    if (!deactivate) return;
    result.deactivated += 1;
    try {
      const { data: user } = await client
        .from("users")
        .select("id, telegram_id, telegram_username, is_test")
        .eq("id", row.user_id)
        .maybeSingle();
      const recipient = user ? alertRecipient(user) : null;
      if (!recipient || !isTelegramConfigured()) return;
      const { data: product } = row.product_id
        ? await client
            .from("products")
            .select("title, retailer, current_price")
            .eq("id", row.product_id)
            .maybeSingle()
        : { data: null };
      const name = product?.title?.trim() || row.keyword?.trim();
      const store = retailerLabel(product?.retailer ?? (row.url ? detectRetailerFromUrl(row.url) : null));
      const lastPrice = toNumber(row.last_known_price) ?? toNumber(product?.current_price ?? null);
      await sendTelegramMessage({
        chatId: recipient.chatId,
        text: [
          ...(recipient.testLabel ? [escapeHtml(recipient.testLabel)] : []),
          "🔕 <b>Alerta desactivada</b>",
          "",
          "Ya no podemos seguir el precio de este producto:",
          "",
          `📦 ${escapeHtml((name || "Producto sin nombre").slice(0, 120))}`,
          `🏪 ${escapeHtml(store)}${lastPrice !== null ? ` · último precio: ${formatEuro(lastPrice)}` : ""}`,
          ...(row.url ? [`🔗 ${escapeHtml(row.url)}`] : []),
          "",
          "Si aún te interesa, crea una alerta nueva con el enlace del producto.",
        ].join("\n"),
        disableWebPagePreview: true,
      });
    } catch (error) {
      console.warn(`[user-alerts] Alerta ${row.id}: no se pudo avisar de la desactivación`, error);
    }
  };
  const note = (
    kind: "failed" | "skipped",
    reason: string,
    url: string,
    detail?: string,
  ) => {
    result[kind] += 1;
    const key = `${reason} (${kind === "failed" ? "fallida" : "omitida"})`;
    result.reasons[key] = (result.reasons[key] ?? 0) + 1;
    if (result.examples.length < 6) result.examples.push({ reason, url, detail });
  };

  const telegramReady = isTelegramConfigured();
  const rows = (alerts ?? [])
    .filter((row) => {
      const rowUrl = row.url?.trim();
      if (!rowUrl) return true;
      return allowedRetailers.includes(detectRetailerFromUrl(rowUrl) ?? "amazon");
    })
    .slice(0, limit);

  for (let index = 0; index < rows.length; index += 1) {
    const alert = rows[index]!;
    const url = alert.url?.trim() ?? "";
    if (!url) {
      note("skipped", "Alerta sin URL", "");
      continue;
    }

    const retailer = detectRetailerFromUrl(url) ?? "amazon";
    if (!alertRetailerSupported(retailer)) {
      note("failed", `Tienda sin revisión automática (${retailer})`, url);
      await moveToBack(alert.id);
      await recordRealFailure(alert);
      console.warn(
        `[user-alerts] Alerta ${alert.id}: ${retailer} no soporta chequeo automático`,
      );
      continue;
    }

    const externalId = extractExternalId(retailer, url);
    if (!externalId) {
      note("failed", "URL sin identificador de producto", url);
      await moveToBack(alert.id);
      await recordRealFailure(alert);
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
          const ensureMessage =
            ensureError instanceof Error ? ensureError.message : String(ensureError);
          // Agotado: no se crea la ficha; la revisión de abajo lo anota como
          // «Producto agotado» y se vincula cuando vuelva a haber stock.
          if (!/agotado/i.test(ensureMessage)) {
            const reason = "No se pudo crear/vincular el producto (se sigue revisando)";
            result.reasons[reason] = (result.reasons[reason] ?? 0) + 1;
            console.warn(
              `[user-alerts] Alerta ${alert.id}: no se pudo enlazar producto`,
              ensureMessage,
            );
          }
        }
      }

      const quote =
        (await quoteFromFreshCatalog(client, retailer, productId, pageUrl)) ??
        (await fetchRetailQuote(retailer, pageUrl, externalId, 12_000));

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
        note(
          "skipped",
          quote.availability === ProductAvailability.OUT_OF_STOCK
            ? "Producto agotado"
            : "Sin precio en la página",
          url,
        );
        if (index < rows.length - 1 && delayMs > 0) await sleep(delayMs);
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
          fail_count: 0,
          first_failed_at: null,
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
                ...primePriceFields(quote),
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

      // Se avisa solo con bajadas de verdad (≥2 % y ≥0,10 €) y no se repite la
      // misma: la referencia es el último precio avisado mientras la oferta
      // siga (si el precio vuelve a subir ≥5 %, se olvida).
      let lastNotified = toNumber(alert.last_notified_price ?? null);
      if (lastNotified !== null && currentPrice >= lastNotified * 1.05) {
        lastNotified = null;
        await client.from("alerts").update({ last_notified_price: null }).eq("id", alert.id);
      }
      const reference =
        lastNotified !== null && previousKnown !== null
          ? Math.min(lastNotified, previousKnown)
          : (lastNotified ?? previousKnown);
      const isDrop =
        reference !== null &&
        reference - currentPrice >= MIN_DROP_EUR &&
        ((reference - currentPrice) / reference) * 100 >= MIN_DROP_PERCENT;

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
        note("skipped", "Bajada por encima del precio máximo de la alerta", url);
        if (index < rows.length - 1 && delayMs > 0) await sleep(delayMs);
        continue;
      }

      const { data: user, error: userError } = await client
        .from("users")
        .select("id, telegram_id, telegram_username, is_test")
        .eq("id", alert.user_id)
        .maybeSingle();
      const recipient = user ? alertRecipient(user) : null;

      if (userError || !recipient || !telegramReady) {
        note(
          "failed",
          !telegramReady
            ? "Telegram sin configurar"
            : "Usuario sin chat de Telegram (o sin chat de admin para pruebas)",
          url,
        );
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
        ((reference - currentPrice) / reference) * 100,
      );

      type LinkedProductRow = {
        slug: string;
        brand: string | null;
        image_url: string | null;
        description: string | null;
        deal_expires_at: string | null;
        lowest_price: number | string | null;
        category_id: string | null;
        categories: {
          id: string;
          slug: string;
          name: string;
          parent: { id: string; slug: string; name: string } | null;
        } | null;
      };

      let productSlug: string | null = null;
      let linkedProduct: LinkedProductRow | null = null;
      if (productId) {
        const { data: linked } = await client
          .from("products")
          .select(
            "slug, brand, image_url, description, deal_expires_at, lowest_price, category_id, categories(id, slug, name, parent:parent_id(id, slug, name))",
          )
          .eq("id", productId)
          .maybeSingle();
        linkedProduct = linked as LinkedProductRow | null;
        productSlug = linkedProduct?.slug ?? null;
      }

      // Mismo formato que el resto de alertas (foto + ficha + botones) cuando
      // hay producto vinculado; si no, texto con la vista previa del enlace.
      let deal: DealCandidate | null = null;
      if (productId) {
        const category = linkedProduct?.categories ?? null;
        const scoring = dealScoringService.scoreProduct({
          currentPrice,
          previousPrice: reference,
          lowestPrice: Math.min(
            currentPrice,
            toNumber(linkedProduct?.lowest_price) ?? currentPrice,
          ),
          categorySlug: category?.parent?.slug ?? category?.slug ?? "otros",
        });

        deal = {
          productId,
          asin,
          title,
          brand: linkedProduct?.brand ?? null,
          categoryId: category?.id ?? linkedProduct?.category_id ?? null,
          categoryName: category?.name ?? null,
          categorySlug: category?.slug ?? null,
          parentCategorySlug: category?.parent?.slug ?? null,
          parentCategoryName: category?.parent?.name ?? null,
          retailer,
          currentPrice,
          previousPrice: reference,
          discountPercentage: discountPct,
          dealLevel: scoring.level,
          score: scoring.score,
          dealLabel: scoring.label,
          affiliateUrl,
          nearHistoricalLow: scoring.level === DealLevel.HISTORICAL_LOW,
          productSlug,
          imageUrl: linkedProduct?.image_url ?? null,
          summary: linkedProduct?.description?.trim() || null,
          expiresAt: linkedProduct?.deal_expires_at ?? null,
        };
      }

      if (deal) {
        await sendDealAlertMessage({
          chatId: recipient.chatId,
          deal: {
            ...deal,
            primeOnly: quote.primeOnly,
            regularPrice: quote.regularPrice ?? null,
            ...(recipient.testLabel
              ? { title: `${recipient.testLabel} · ${deal.title}` }
              : {}),
          },
        });
      } else {
        await sendTelegramMessage({
          chatId: recipient.chatId,
          text: [
            ...(recipient.testLabel ? [escapeHtml(recipient.testLabel)] : []),
            "📉 <b>Bajada en tu alerta de URL</b>",
            "",
            escapeHtml(title),
            `Antes: <s>${formatEuro(reference)}</s>`,
            `Ahora: <b>${formatEuro(currentPrice)}</b> (−${discountPct}%)`,
            ...(quote.primeOnly
              ? [
                  `⭐ Precio de oferta Prime${
                    quote.regularPrice ? ` · sin Prime: ${formatEuro(quote.regularPrice)}` : ""
                  }`,
                ]
              : []),
          ].join("\n"),
          disableWebPagePreview: false,
          replyMarkup: buildOfferActionMarkup({
            affiliateUrl,
            productSlug,
          }),
        });
      }

      result.notified += 1;
      await client
        .from("alerts")
        .update({ last_notified_price: currentPrice })
        .eq("id", alert.id);

      // Misma oferta detectada por una alerta de usuario: también se ofrece
      // al canal/grupo/Facebook/Instagram y a las alertas de categoría/marca/
      // keyword de otros usuarios, si cumple sus propios umbrales. El
      // cooldown de `notifyChannelDealIfEligible` (pendiente + 12h al mismo
      // precio) evita reenvíos duplicados si el descubrimiento normal ya
      // publicó este mismo producto.
      // Los usuarios de prueba no propagan ofertas al canal ni a redes.
      if (deal && !recipient.testLabel) {
        try {
          await notifyMatchingUsers(client, deal, { excludeAlertId: alert.id });
          await notifyChannelDealIfEligible(client, deal);
        } catch (broadcastError) {
          console.warn(
            `[user-alerts] Alerta ${alert.id}: no se pudo ofrecer al canal/otras alertas`,
            broadcastError instanceof Error
              ? broadcastError.message
              : broadcastError,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Bloqueo anti-bot de la tienda (DataDome, Cloudflare, 403…): transitorio,
      // no es un fallo real de la alerta. No lo contamos como "failed" para no
      // disparar avisos ruidosos al admin en cada ciclo.
      // Bloqueos y «sin precio por envío fuera de España» son omisiones
      // (transitorias / dependen de la IP), no fallos de la alerta.
      note(
        isRetailBlockedError(message) || isForeignDeliveryError(message) ? "skipped" : "failed",
        reasonFromError(message),
        url,
        message.slice(0, 160),
      );
      await moveToBack(alert.id);
      if (!isRetailBlockedError(message) && !isForeignDeliveryError(message)) {
        await recordRealFailure(alert);
      }
      console.warn(`[user-alerts] Alerta ${alert.id}:`, message);
    }

    if (index < rows.length - 1 && delayMs > 0) await sleep(delayMs);
  }

  await closeSharedBrowser();
  result.finishedAt = new Date().toISOString();
  return result;
}
