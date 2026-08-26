import { generateAffiliateUrl } from "@/lib/affiliate";
import { calculateDiscountPercentage, requireNumber, roundMoney, toNumber } from "@/lib/money";
import { computeMovingAverages } from "@/lib/price-history";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import type { DealCandidate } from "@/services/alertMatching";
import { dealScoringService } from "@/services/deal-scoring";
import {
  notifyMatchingUsers,
  type NotificationDispatchResult,
} from "@/services/notifications";
import {
  notifyChannelDealIfEligible,
  type ChannelNotifyResult,
} from "@/services/telegram";
import { productHasMonitorableUrl } from "@/services/products";
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
  scoring: DealScoringResult;
  notifications: NotificationDispatchResult;
  channel?: ChannelNotifyResult;
}

export interface PriceDetectionStats {
  processed: number;
  updated: number;
  unchanged: number;
  dealsDetected: number;
  alertsMatched: number;
  notificationsCreated: number;
  notificationsSent: number;
  notificationsSkipped: number;
  channelNotificationsSent: number;
  channelNotificationsSkipped: number;
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
}

interface ProductWithCategory extends ProductRow {
  categories: CategoryEmbed | CategoryEmbed[] | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function categoryOf(product: ProductWithCategory): CategoryEmbed | null {
  const category = product.categories;
  if (Array.isArray(category)) {
    return category[0] ?? null;
  }
  return category;
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

export async function runPriceDetection(
  options: RunPriceDetectionOptions = {},
): Promise<PriceDetectionStats> {
  const client = options.client ?? createSupabaseServiceClient();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const source = options.source ?? "mock";
  const shouldNotify = options.notify ?? true;

  const { data: products, error: productsError } = await client
    .from("products")
    .select("*, categories(id, slug, name)")
    .eq("is_active", true);

  if (productsError) {
    throw new Error(`No se pudieron leer productos: ${productsError.message}`);
  }

  const allowList = options.asinAllowList
    ? new Set(options.asinAllowList.map((asin) => asin.toUpperCase()))
    : null;

  const activeProducts = ((products ?? []) as ProductWithCategory[]).filter(
    (product) => {
      if (options.onlyWithAmazonUrl && !productHasMonitorableUrl(product)) {
        return false;
      }
      if (allowList && !allowList.has(product.asin.toUpperCase())) {
        return false;
      }
      return true;
    },
  );
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
    dealsDetected: 0,
    alertsMatched: 0,
    notificationsCreated: 0,
    notificationsSent: 0,
    notificationsSkipped: 0,
    channelNotificationsSent: 0,
    channelNotificationsSkipped: 0,
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
        stats.errors.push({
          asin: product.asin,
          message: "El proveedor no devolvió precio para este ASIN.",
        });
        continue;
      }

      try {
        const storedPrice = requireNumber(product.current_price);
        const nextPrice = roundMoney(quote.price);

        if (nextPrice === storedPrice) {
          const { error: touchError } = await client
            .from("products")
            .update({
              last_checked_at: new Date().toISOString(),
              availability: availabilityFrom(quote.availability),
            })
            .eq("id", product.id);

          if (touchError) {
            throw new Error(touchError.message);
          }

          stats.unchanged += 1;
          continue;
        }

        const previousPrice = storedPrice;
        const discountPercentage = calculateDiscountPercentage(
          previousPrice,
          nextPrice,
        );
        const previousLowest = toNumber(product.lowest_price);
        const previousHighest = toNumber(product.highest_price);
        const lowestPrice =
          previousLowest === null
            ? nextPrice
            : roundMoney(Math.min(previousLowest, nextPrice));
        const highestPrice =
          previousHighest === null
            ? nextPrice
            : roundMoney(Math.max(previousHighest, nextPrice));

        const category = categoryOf(product);
        const scoringContext = await loadScoringContext(
          client,
          product.id,
          previousPrice,
        );
        const scoring = dealScoringService.score({
          currentPrice: nextPrice,
          previousPrice,
          lowestPrice: previousLowest,
          discountPercentage,
          categorySlug: category?.slug ?? "general",
          priceChangeCount30d: scoringContext.priceChangeCount30d,
          previousPriceAgeHours: scoringContext.previousPriceAgeHours,
        });

        const now = new Date().toISOString();
        const { error: updateError } = await client
          .from("products")
          .update({
            previous_price: previousPrice,
            current_price: nextPrice,
            lowest_price: lowestPrice,
            highest_price: highestPrice,
            discount_percentage: discountPercentage,
            currency: quote.currency,
            availability: availabilityFrom(quote.availability),
            last_checked_at: now,
            updated_at: now,
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
        const qualifiesChannel = scoring.score >= 75;

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
            currentPrice: nextPrice,
            previousPrice,
            discountPercentage,
            dealLevel: scoring.level,
            score: scoring.score,
            dealLabel: dealScoringService.getLabel(scoring.level),
            productSlug: product.slug,
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
          };

          if (isDeal) {
            notifications = await notifyMatchingUsers(client, deal);
            stats.alertsMatched += notifications.matched;
            stats.notificationsCreated += notifications.created;
            stats.notificationsSent += notifications.sent;
            stats.notificationsSkipped += notifications.skippedDuplicates;
          }

          channel = await notifyChannelDealIfEligible(client, deal);
          if (channel.sent) {
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
