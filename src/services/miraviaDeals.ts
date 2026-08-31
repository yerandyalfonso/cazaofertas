import { inferAmazonCategorySlug } from "@/lib/amazon-category";
import { resolveCategoryIdBySlug } from "@/lib/categories";
import { roundMoney, toNumber } from "@/lib/money";
import {
  resolveProductBuyUrl,
  syntheticAsinForRetailer,
} from "@/lib/retailers";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import {
  discoverMiraviaDeals,
  type MiraviaDiscoveredItem,
} from "@/providers/retail/miravia";
import type { DealCandidate } from "@/services/alertMatching";
import { dealScoringService } from "@/services/deal-scoring";
import { notifyChannelDealIfEligible } from "@/services/telegram";
import { DealLevel, ProductAvailability } from "@/types";

function miraviaDealsEnabled(): boolean {
  const raw = process.env.MIRAVIA_DEALS_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  // Por defecto ON: misma cadencia que flash Amazon (cron local).
  if (raw === undefined || raw === "") return true;
  return raw === "1" || raw === "true" || raw === "on";
}

function minMiraviaDiscountPercent(): number {
  const raw = Number(process.env.MIRAVIA_MIN_DISCOUNT_PERCENT ?? "15");
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

function miraviaDiscoveryMaxItems(): number {
  const raw = Number(process.env.MIRAVIA_DISCOVERY_MAX_ITEMS ?? "40");
  return Number.isFinite(raw) && raw > 0 ? raw : 40;
}

function miraviaInsertLimitDefault(): number {
  const raw = Number(process.env.MIRAVIA_FLASH_LIMIT ?? "2");
  return Number.isFinite(raw) && raw > 0 ? Math.min(5, raw) : 2;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function computeDiscount(current: number, reference: number | null): number {
  if (reference == null || reference <= current) return 0;
  return roundMoney(((reference - current) / reference) * 100);
}

interface CatalogRow {
  id: string;
  asin: string;
  external_id: string | null;
  retailer: string;
  title: string;
  slug: string;
  product_url: string | null;
  amazon_url: string;
  affiliate_url: string | null;
  current_price: number | string;
  previous_price: number | string | null;
  lowest_price: number | string | null;
  highest_price: number | string | null;
  brand: string | null;
  image_url: string | null;
  category_id: string | null;
}

export interface MiraviaDealsRunResult {
  ok: true;
  enabled: boolean;
  finishedAt: string;
  discovery: {
    feedsFetched: number;
    candidates: number;
    feedErrors: Array<{ url: string; message: string }>;
  };
  processed: number;
  inserted: number;
  skippedExisting: number;
  skippedNoDiscount: number;
  channelNotificationsSent: number;
  channelNotificationsSkipped: number;
  channelNotificationsQueued: number;
  errors: Array<{ externalId: string; message: string }>;
}

async function maybeNotifyMiraviaDeal(
  client: TypedSupabaseClient,
  options: {
    productId: string;
    syntheticAsin: string;
    title: string;
    slug: string;
    currentPrice: number;
    previousPrice: number;
    discountPercentage: number;
    score: number;
    dealLevel: DealLevel;
    dealLabel: string;
    productUrl: string;
    affiliateUrl: string;
    brand?: string | null;
    imageUrl?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    categorySlug?: string | null;
    telegramMinScore?: number;
  },
): Promise<"sent" | "skipped" | "failed" | "queued"> {
  const deal: DealCandidate = {
    productId: options.productId,
    asin: options.syntheticAsin,
    title: options.title,
    brand: options.brand ?? "Miravia",
    categoryId: options.categoryId ?? null,
    categoryName: options.categoryName ?? null,
    categorySlug: options.categorySlug ?? null,
    currentPrice: options.currentPrice,
    previousPrice: options.previousPrice,
    discountPercentage: options.discountPercentage,
    dealLevel: options.dealLevel,
    score: options.score,
    dealLabel: options.dealLabel,
    productSlug: options.slug,
    imageUrl: options.imageUrl ?? null,
    summary: "Miravia · oferta flash",
    affiliateUrl: options.affiliateUrl,
    nearHistoricalLow: options.dealLevel === DealLevel.HISTORICAL_LOW,
  };

  const result = await notifyChannelDealIfEligible(client, deal, {
    minScore: options.telegramMinScore,
  });
  if (result.queued) return "queued";
  if (result.sent) return "sent";
  if (result.skipped) return "skipped";
  return "failed";
}

/**
 * Descubre ofertas flash de Miravia e inserta novedades en catálogo.
 * Pensado para correr junto al cron flash de Amazon (cada ~3 min).
 */
export async function runMiraviaDealsCheck(options?: {
  limit?: number;
  feedUrls?: string[];
  notify?: boolean;
  telegramMinScore?: number;
  onlyItems?: MiraviaDiscoveredItem[];
}): Promise<MiraviaDealsRunResult> {
  const finishedAt = new Date().toISOString();

  if (!miraviaDealsEnabled()) {
    return {
      ok: true,
      enabled: false,
      finishedAt,
      discovery: { feedsFetched: 0, candidates: 0, feedErrors: [] },
      processed: 0,
      inserted: 0,
      skippedExisting: 0,
      skippedNoDiscount: 0,
      channelNotificationsSent: 0,
      channelNotificationsSkipped: 0,
      channelNotificationsQueued: 0,
      errors: [],
    };
  }

  const client = createSupabaseServiceClient();
  const limit =
    options?.limit && options.limit > 0
      ? options.limit
      : miraviaInsertLimitDefault();
  const shouldNotify = options?.notify ?? true;
  const minDiscount = minMiraviaDiscountPercent();

  const discovery = options?.onlyItems?.length
    ? {
        items: options.onlyItems,
        feedsFetched: 0,
        feedErrors: [] as Array<{ url: string; message: string }>,
      }
    : await discoverMiraviaDeals({
        feedUrls:
          options?.feedUrls ??
          process.env.MIRAVIA_FEED_URLS?.split(/[,\n]/)
            .map((url) => url.trim())
            .filter(Boolean),
        maxItems: miraviaDiscoveryMaxItems(),
        minDiscountPercent: minDiscount,
        delayMs: 600,
      });

  const { data: catalogRows, error: catalogError } = await client
    .from("products")
    .select(
      "id, asin, external_id, retailer, title, slug, product_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, category_id",
    )
    .eq("retailer", "miravia");

  if (catalogError) {
    throw new Error(
      `No se pudo leer catálogo Miravia: ${catalogError.message}`,
    );
  }

  const catalogByExternalId = new Map(
    ((catalogRows ?? []) as CatalogRow[])
      .filter((row) => row.external_id)
      .map((row) => [row.external_id!, row] as const),
  );

  const newCandidates: MiraviaDiscoveredItem[] = [];
  let skippedExisting = 0;

  for (const item of discovery.items) {
    if (catalogByExternalId.has(item.externalId)) {
      skippedExisting += 1;
      continue;
    }
    newCandidates.push(item);
  }

  const queue = newCandidates.slice(0, limit);

  let processed = 0;
  let inserted = 0;
  let skippedNoDiscount = 0;
  let channelNotificationsSent = 0;
  let channelNotificationsSkipped = 0;
  let channelNotificationsQueued = 0;
  const errors: Array<{ externalId: string; message: string }> = [];

  for (const item of queue) {
    processed += 1;

    try {
      if (item.priceHint == null) {
        skippedNoDiscount += 1;
        continue;
      }

      const price = roundMoney(item.priceHint);
      let listPrice =
        item.listPriceHint != null && item.listPriceHint > price
          ? roundMoney(item.listPriceHint)
          : null;

      let discount = computeDiscount(price, listPrice);
      if (discount < minDiscount && (item.discountHint ?? 0) >= minDiscount) {
        discount = roundMoney(item.discountHint!);
        if (listPrice == null) {
          listPrice = roundMoney(price / (1 - discount / 100));
        }
      }

      if (discount < minDiscount || listPrice == null || listPrice <= price) {
        skippedNoDiscount += 1;
        continue;
      }

      const title =
        item.titleHint?.trim() || `Producto Miravia ${item.externalId}`;
      const productUrl = item.productUrl;
      const syntheticAsin = syntheticAsinForRetailer("miravia", item.externalId);
      const categorySlug = inferAmazonCategorySlug({ title });
      const categoryMeta = await resolveCategoryIdBySlug(client, categorySlug);

      const scoring = dealScoringService.scoreProduct({
        currentPrice: price,
        previousPrice: listPrice,
        lowestPrice: price,
        categorySlug: categorySlug ?? undefined,
      });

      const now = new Date().toISOString();
      const slug = slugify(`${title}-${item.externalId}`);
      const insertRow = {
        retailer: "miravia" as const,
        external_id: item.externalId,
        product_url: productUrl,
        asin: syntheticAsin,
        title,
        slug,
        amazon_url: productUrl,
        affiliate_url: productUrl,
        brand: "Miravia",
        image_url: item.imageUrlHint ?? null,
        description: null,
        category_id: categoryMeta?.id ?? null,
        current_price: price,
        previous_price: listPrice,
        lowest_price: price,
        highest_price: Math.max(price, listPrice),
        discount_percentage: discount,
        currency: "EUR",
        availability: ProductAvailability.IN_STOCK,
        is_active: true,
        last_checked_at: now,
        updated_at: now,
      };

      const { data: insertedRow, error: insertError } = await client
        .from("products")
        .insert(insertRow)
        .select("id, slug")
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      await client.from("price_history").insert({
        product_id: insertedRow.id,
        price,
        source: "miravia",
      });

      inserted += 1;
      catalogByExternalId.set(item.externalId, {
        ...(insertRow as unknown as CatalogRow),
        id: insertedRow.id,
      });

      if (shouldNotify) {
        const channelMinScore = options?.telegramMinScore ?? 75;
        const qualifiesChannel = scoring.score >= channelMinScore;
        const isDeal = scoring.level !== DealLevel.NORMAL;
        if (isDeal || qualifiesChannel) {
          const affiliateUrl = resolveProductBuyUrl(insertRow);

          const notifyResult = await maybeNotifyMiraviaDeal(client, {
            productId: insertedRow.id,
            syntheticAsin,
            title,
            slug: insertedRow.slug,
            currentPrice: price,
            previousPrice: listPrice,
            discountPercentage: discount,
            score: scoring.score,
            dealLevel: scoring.level,
            dealLabel: scoring.label,
            productUrl,
            affiliateUrl,
            brand: "Miravia",
            imageUrl: item.imageUrlHint,
            categoryId: categoryMeta?.id ?? null,
            categoryName: categoryMeta?.name ?? null,
            categorySlug: categoryMeta?.slug ?? categorySlug,
            telegramMinScore: channelMinScore,
          });
          if (notifyResult === "queued") channelNotificationsQueued += 1;
          else if (notifyResult === "sent") channelNotificationsSent += 1;
          else if (notifyResult === "skipped") {
            channelNotificationsSkipped += 1;
          }
        }
      }
    } catch (error) {
      errors.push({
        externalId: item.externalId,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  return {
    ok: true,
    enabled: true,
    finishedAt: new Date().toISOString(),
    discovery: {
      feedsFetched: discovery.feedsFetched,
      candidates: discovery.items.length,
      feedErrors: discovery.feedErrors,
    },
    processed,
    inserted,
    skippedExisting,
    skippedNoDiscount,
    channelNotificationsSent,
    channelNotificationsSkipped,
    channelNotificationsQueued,
    errors,
  };
}
