import { generateAffiliateUrl } from "@/lib/affiliate";
import { calculateDiscountPercentage, requireNumber, roundMoney, toNumber } from "@/lib/money";
import {
  buildOutOfStockUpdate,
  inStockAvailabilityPatch,
} from "@/lib/out-of-stock-policy";
import { computeMovingAverages } from "@/lib/price-history";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import { resolveParentSlug } from "@/lib/category-taxonomy";
import type { DealCandidate } from "@/services/alertMatching";
import { dealScoringService } from "@/services/deal-scoring";
import { resolveTelegramMinDiscountPercent } from "@/services/appSettings";
import {
  notifyMatchingUsers,
  type NotificationDispatchResult,
} from "@/services/notifications";
import {
  notifyChannelDealIfEligible,
  type ChannelNotifyResult,
} from "@/services/telegram";
import { productHasMonitorableUrl } from "@/services/products";
import { clearAsinScrapeFailure } from "@/services/asinScrapeFailures";
import {
  MockPriceProvider,
  type MockPriceMode,
} from "@/providers/price";
import {
  DealLevel,
  ProductAvailability,
  type DealScoringResult,
  type PriceProvider,
  type PriceSource,
} from "@/types";
import type { ProductRow } from "@/types/database";

const DEFAULT_BATCH_SIZE = 25;

/** Avanza rotación aunque falle el scrape (si no, el ASIN queda siempre el primero). */
async function touchLastCheckedOnScrapeMiss(
  client: TypedSupabaseClient,
  productId: string,
  nowIso: string,
): Promise<void> {
  await client
    .from("products")
    .update({ last_checked_at: nowIso, updated_at: nowIso })
    .eq("id", productId);
}

async function refreshProductAverages(
  client: TypedSupabaseClient,
  productId: string,
): Promise<void> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);

  const { data, error } = await client
    .from("price_history")
    .select("price, timestamp")
    .eq("product_id", productId)
    .gte("timestamp", since.toISOString())
    .order("timestamp", { ascending: false })
    .limit(500);

  if (error) {
    console.warn("[priceDetection] averages", error.message);
    return;
  }

  const points = (data ?? []).map((row) => ({
    price: toNumber(row.price) ?? 0,
    timestamp: row.timestamp,
  }));
  const { averagePrice30d, averagePrice90d } = computeMovingAverages(points);

  const { error: updateError } = await client
    .from("products")
    .update({
      average_price_30d: averagePrice30d,
      average_price_90d: averagePrice90d,
    })
    .eq("id", productId);

  if (updateError) {
    console.warn("[priceDetection] average update", updateError.message);
  }
}

export interface DetectedDeal {
  productId: string;
  asin: string;
  title: string;
  amazonUrl?: string;
  imageUrl?: string | null;
  scoring: DealScoringResult;
  notifications: NotificationDispatchResult;
  channel?: ChannelNotifyResult;
}

export interface PriceDetectionStats {
  processed: number;
  updated: number;
  unchanged: number;
  unavailable: number;
  deactivated: number;
  dealsDetected: number;
  alertsMatched: number;
  notificationsCreated: number;
  notificationsSent: number;
  notificationsSkipped: number;
  channelNotificationsSent: number;
  channelNotificationsSkipped: number;
  channelNotificationsQueued: number;
  errors: Array<{ asin: string; message: string }>;
  deals: DetectedDeal[];
}

export interface RunPriceDetectionOptions {
  provider?: PriceProvider;
  mode?: MockPriceMode;
  batchSize?: number;
  source?: PriceSource;
  client?: TypedSupabaseClient;
  notify?: boolean;
  /** Solo productos con amazon_url (o ASIN resoluble a URL). */
  onlyWithAmazonUrl?: boolean;
  /** Si se indica, solo se procesan estos ASINs. */
  asinAllowList?: string[];
}

interface CategoryEmbed {
  id: string;
  slug: string;
  name: string;
  parent?: CategoryEmbed | CategoryEmbed[] | null;
}

interface ProductWithCategory extends ProductRow {
  categories: CategoryEmbed | CategoryEmbed[] | null;
}

function parentCategoryOf(
  category: CategoryEmbed | null,
): CategoryEmbed | null {
  if (!category?.parent) return null;
  return Array.isArray(category.parent)
    ? (category.parent[0] ?? null)
    : category.parent;
}

function categoryOf(product: ProductWithCategory): CategoryEmbed | null {
  const category = product.categories;
  if (Array.isArray(category)) {
    return category[0] ?? null;
  }
  return category;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function availabilityFrom(value: string | undefined): ProductAvailability {
  if (
    value === ProductAvailability.OUT_OF_STOCK ||
    value === ProductAvailability.PREORDER ||
    value === ProductAvailability.UNKNOWN
  ) {
    return value;
  }
  return ProductAvailability.IN_STOCK;
}

/**
 * Referencia para UI/descuento:
 * 1) lista Amazon del quote (precio recomendado)
 * 2) previous_price guardado si sigue por encima del actual
 * 3) current anterior (caída vs última lectura)
 */
function resolveReferencePrice(options: {
  nextPrice: number;
  amazonList: number | null;
  storedPrevious: number | null;
  storedCurrent: number;
}): number {
  const { nextPrice, amazonList, storedPrevious, storedCurrent } = options;
  if (amazonList !== null && amazonList > nextPrice) {
    return roundMoney(amazonList);
  }
  if (storedPrevious !== null && storedPrevious > nextPrice) {
    return roundMoney(storedPrevious);
  }
  if (storedCurrent > nextPrice) {
    return roundMoney(storedCurrent);
  }
  return nextPrice;
}

async function loadScoringContext(
  client: TypedSupabaseClient,
  productId: string,
  previousPrice: number,
): Promise<{ priceChangeCount30d: number; previousPriceAgeHours: number | null }> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const { data, error } = await client
    .from("price_history")
    .select("price, timestamp")
    .eq("product_id", productId)
    .gte("timestamp", since.toISOString())
    .order("timestamp", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const history = data ?? [];
  let changes = 0;
  let lastPrice: number | null = null;

  for (const row of [...history].reverse()) {
    const price = requireNumber(row.price);
    if (lastPrice !== null && price !== lastPrice) {
      changes += 1;
    }
    lastPrice = price;
  }

  const matchingPrevious = history.find(
    (row) => requireNumber(row.price) === previousPrice,
  );

  const previousPriceAgeHours = matchingPrevious
    ? (Date.now() - new Date(matchingPrevious.timestamp).getTime()) / 3_600_000
    : null;

  return {
    priceChangeCount30d: changes,
    previousPriceAgeHours,
  };
}

function emptyNotificationStats(): NotificationDispatchResult {
  return {
    matched: 0,
    created: 0,
    skippedDuplicates: 0,
    sent: 0,
    failed: 0,
  };
}

/** Rellena imagen/marca si el scrape las trae y en BD faltan. */
function mediaBackfillPatch(
  product: ProductWithCategory,
  quote: { imageUrl?: string; brand?: string },
): { image_url?: string; brand?: string } {
  const patch: { image_url?: string; brand?: string } = {};
  if (!product.image_url?.trim() && quote.imageUrl?.trim()) {
    patch.image_url = quote.imageUrl.trim();
  }
  if (!product.brand?.trim() && quote.brand?.trim()) {
    patch.brand = quote.brand.trim();
  }
  return patch;
}

const PRICE_PRODUCT_SELECT =
  "id, asin, title, slug, brand, image_url, description, retailer, amazon_url, affiliate_url, product_url, current_price, previous_price, lowest_price, highest_price, discount_percentage, category_id, availability, out_of_stock_at, is_active, deal_expires_at, categories(id, slug, name, parent:parent_id(id, slug, name))";

const ASIN_LOOKUP_CHUNK = 100;

export async function runPriceDetection(
  options: RunPriceDetectionOptions = {},
): Promise<PriceDetectionStats> {
  const client = options.client ?? createSupabaseServiceClient();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const source = options.source ?? "mock";
  const shouldNotify = options.notify ?? true;
  const telegramMinDiscount = await resolveTelegramMinDiscountPercent();

  const allowList = options.asinAllowList
    ? [...new Set(options.asinAllowList.map((asin) => asin.toUpperCase()).filter(Boolean))]
    : null;

  let products: ProductWithCategory[] = [];

  if (allowList && allowList.length > 0) {
    const byId = new Map<string, ProductWithCategory>();
    for (let offset = 0; offset < allowList.length; offset += ASIN_LOOKUP_CHUNK) {
      const chunk = allowList.slice(offset, offset + ASIN_LOOKUP_CHUNK);
      const { data, error } = await client
        .from("products")
        .select(PRICE_PRODUCT_SELECT)
        .eq("is_active", true)
        .in("asin", chunk);
      if (error) {
        throw new Error(`No se pudieron leer productos: ${error.message}`);
      }
      for (const row of (data ?? []) as ProductWithCategory[]) {
        byId.set(row.id, row);
      }
    }
    products = [...byId.values()];
  } else {
    // Sin allow-list (tests/mock): ventana acotada, nunca el catálogo entero.
    const { data, error: productsError } = await client
      .from("products")
      .select(PRICE_PRODUCT_SELECT)
      .eq("is_active", true)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(Math.min(Math.max(batchSize * 4, 25), 100));

    if (productsError) {
      throw new Error(`No se pudieron leer productos: ${productsError.message}`);
    }
    products = (data ?? []) as ProductWithCategory[];
  }

  const allowSet = allowList ? new Set(allowList) : null;

  const activeProducts = products.filter((product) => {
    if (options.onlyWithAmazonUrl && !productHasMonitorableUrl(product)) {
      return false;
    }
    if (allowSet && !allowSet.has(product.asin.toUpperCase())) {
      return false;
    }
    return true;
  });
  const provider =
    options.provider ??
    new MockPriceProvider({
      mode: options.mode ?? "random",
      catalog: activeProducts.map((product) => ({
        asin: product.asin,
        price: requireNumber(product.current_price),
        title: product.title,
        brand: product.brand ?? undefined,
        imageUrl: product.image_url ?? undefined,
      })),
    });

  const stats: PriceDetectionStats = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    unavailable: 0,
    deactivated: 0,
    dealsDetected: 0,
    alertsMatched: 0,
    notificationsCreated: 0,
    notificationsSent: 0,
    notificationsSkipped: 0,
    channelNotificationsSent: 0,
    channelNotificationsSkipped: 0,
    channelNotificationsQueued: 0,
    errors: [],
    deals: [],
  };

  for (const batch of chunk(activeProducts, batchSize)) {
    const quotes = await provider.getProducts(batch.map((product) => product.asin));
    const quotesByAsin = new Map(quotes.map((quote) => [quote.asin, quote]));

    for (const product of batch) {
      stats.processed += 1;
      const quote = quotesByAsin.get(product.asin);

      if (!quote) {
        const nowMiss = new Date().toISOString();
        await touchLastCheckedOnScrapeMiss(client, product.id, nowMiss);
        stats.errors.push({
          asin: product.asin,
          message: "El proveedor no devolvió precio para este ASIN.",
        });
        continue;
      }

      const now = new Date().toISOString();

      if (
        quote.price === null &&
        quote.availability === ProductAvailability.OUT_OF_STOCK
      ) {
        const oosPatch = buildOutOfStockUpdate(
          product,
          now,
          mediaBackfillPatch(product, quote),
        );
        const { error: unavailableError } = await client
          .from("products")
          .update(oosPatch)
          .eq("id", product.id);

        if (unavailableError) {
          stats.errors.push({
            asin: product.asin,
            message: unavailableError.message,
          });
        } else {
          await clearAsinScrapeFailure(product.asin);
          stats.unavailable += 1;
          if (oosPatch.is_active === false) {
            stats.deactivated += 1;
          }
        }
        continue;
      }

      if (quote.price === null) {
        await touchLastCheckedOnScrapeMiss(client, product.id, now);
        stats.errors.push({
          asin: product.asin,
          message: "El proveedor no devolvió precio para este ASIN.",
        });
        continue;
      }

      try {
        await clearAsinScrapeFailure(product.asin);
        const storedPrice = requireNumber(product.current_price);
        const nextPrice = roundMoney(quote.price);
        const amazonList = toNumber(quote.previousPrice ?? null);
        const storedPrevious = toNumber(product.previous_price);
        const referencePrice = resolveReferencePrice({
          nextPrice,
          amazonList,
          storedPrevious,
          storedCurrent: storedPrice,
        });
        const discountPercentage =
          quote.discountPercentage != null &&
          Number.isFinite(quote.discountPercentage) &&
          quote.discountPercentage > 0
            ? roundMoney(quote.discountPercentage)
            : calculateDiscountPercentage(referencePrice, nextPrice);
        const priceChanged = nextPrice !== storedPrice;

        // Aunque el precio no cambie, refrescar referencia Amazon + descuento.
        if (!priceChanged) {
          const availability = availabilityFrom(quote.availability);
          const { error: touchError } = await client
            .from("products")
            .update({
              previous_price:
                referencePrice > nextPrice ? referencePrice : storedPrevious,
              discount_percentage: discountPercentage,
              last_checked_at: now,
              availability,
              updated_at: now,
              ...inStockAvailabilityPatch(availability),
              ...mediaBackfillPatch(product, quote),
            })
            .eq("id", product.id);

          if (touchError) {
            throw new Error(touchError.message);
          }

          stats.unchanged += 1;
          continue;
        }

        const previousLowest = toNumber(product.lowest_price);
        const previousHighest = toNumber(product.highest_price);
        const lowestPrice =
          previousLowest === null
            ? nextPrice
            : roundMoney(Math.min(previousLowest, nextPrice));
        const highestPrice =
          previousHighest === null
            ? Math.max(nextPrice, referencePrice)
            : roundMoney(
                Math.max(previousHighest, nextPrice, referencePrice),
              );

        const category = categoryOf(product);
        const parentCategory = parentCategoryOf(category);
        const parentSlug =
          parentCategory?.slug ??
          (category?.slug ? resolveParentSlug(category.slug) : null);
        const scoringContext = await loadScoringContext(
          client,
          product.id,
          storedPrice,
        );
        const scoring = dealScoringService.score({
          currentPrice: nextPrice,
          previousPrice: referencePrice > nextPrice ? referencePrice : storedPrice,
          lowestPrice: previousLowest,
          discountPercentage,
          categorySlug: parentSlug ?? "otros",
          priceChangeCount30d: scoringContext.priceChangeCount30d,
          previousPriceAgeHours: scoringContext.previousPriceAgeHours,
        });

        const availability = availabilityFrom(quote.availability);
        const { error: updateError } = await client
          .from("products")
          .update({
            previous_price:
              referencePrice > nextPrice ? referencePrice : storedPrice,
            current_price: nextPrice,
            lowest_price: lowestPrice,
            highest_price: highestPrice,
            discount_percentage: discountPercentage,
            currency: quote.currency,
            availability,
            last_checked_at: now,
            updated_at: now,
            ...inStockAvailabilityPatch(availability),
            ...mediaBackfillPatch(product, quote),
            ...(quote.dealExpiresAt
              ? { deal_expires_at: quote.dealExpiresAt }
              : {}),
          })
          .eq("id", product.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        const { error: historyError } = await client.from("price_history").insert({
          product_id: product.id,
          price: nextPrice,
          source,
        });

        if (historyError) {
          throw new Error(historyError.message);
        }

        await refreshProductAverages(client, product.id);

        stats.updated += 1;

        const isDeal = scoring.level !== DealLevel.NORMAL;
        const qualifiesChannel =
          scoring.discountPercentage >= telegramMinDiscount;

        if (!isDeal && !qualifiesChannel) {
          continue;
        }

        let notifications = emptyNotificationStats();
        let channel: ChannelNotifyResult | undefined;

        if (shouldNotify) {
          const deal: DealCandidate = {
            productId: product.id,
            asin: product.asin,
            title: product.title,
            brand: product.brand,
            categoryId: category?.id ?? product.category_id,
            categoryName: category?.name ?? null,
            categorySlug: category?.slug ?? null,
            parentCategorySlug: parentSlug ?? null,
            parentCategoryName: parentCategory?.name ?? null,
            retailer: product.retailer,
            currentPrice: nextPrice,
            previousPrice:
              referencePrice > nextPrice ? referencePrice : storedPrice,
            discountPercentage,
            dealLevel: scoring.level,
            score: scoring.score,
            dealLabel: dealScoringService.getLabel(scoring.level),
            productSlug: product.slug,
            imageUrl: product.image_url ?? quote.imageUrl ?? null,
            summary:
              product.description?.trim() ||
              [product.brand, category?.name].filter(Boolean).join(" · ") ||
              null,
            affiliateUrl:
              generateAffiliateUrl({
                amazon_url: product.amazon_url,
                affiliate_url: product.affiliate_url,
                asin: product.asin,
              }),
            nearHistoricalLow:
              scoring.level === DealLevel.HISTORICAL_LOW ||
              scoring.reasons.some((reason) =>
                reason.toLowerCase().includes("mínimo histórico"),
              ),
            expiresAt: quote.dealExpiresAt ?? product.deal_expires_at,
          };

          if (isDeal) {
            notifications = await notifyMatchingUsers(client, deal);
            stats.alertsMatched += notifications.matched;
            stats.notificationsCreated += notifications.created;
            stats.notificationsSent += notifications.sent;
            stats.notificationsSkipped += notifications.skippedDuplicates;
          }

          channel = await notifyChannelDealIfEligible(client, deal);
          if (channel.queued) {
            stats.channelNotificationsQueued += 1;
          } else if (channel.sent) {
            stats.channelNotificationsSent += 1;
          } else if (channel.skipped) {
            stats.channelNotificationsSkipped += 1;
          }
        }

        if (isDeal) {
          stats.dealsDetected += 1;
        }
        stats.deals.push({
          productId: product.id,
          asin: product.asin,
          title: product.title,
          amazonUrl: product.amazon_url,
          imageUrl: product.image_url,
          scoring,
          notifications,
          channel,
        });
      } catch (error) {
        stats.errors.push({
          asin: product.asin,
          message: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }
  }

  return stats;
}

export const priceDetectionService = {
  run: runPriceDetection,
};
