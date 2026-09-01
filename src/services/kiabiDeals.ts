import { resolveCategoryIdBySlug } from "@/lib/categories";
import { composeSubcategorySlug } from "@/lib/category-taxonomy";
import { roundMoney, toNumber } from "@/lib/money";
import { formatDescriptionForStorage } from "@/lib/product-description";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveProductBuyUrl,
  syntheticAsinForRetailer,
} from "@/lib/retailers";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import {
  discoverKiabiDeals,
  hasRealKiabiDiscount,
  scrapeKiabiProductPage,
  type KiabiDiscoveredItem,
  type KiabiProductQuote,
} from "@/providers/retail/kiabi";
import { getAppSettings, resolveKiabiFeedUrlsForRun } from "@/services/appSettings";
import type { DealCandidate } from "@/services/alertMatching";
import { dealScoringService } from "@/services/deal-scoring";
import { notifyChannelDealIfEligible } from "@/services/telegram";
import { DealLevel, ProductAvailability } from "@/types";

function loadKiabiFallbackItems(): KiabiDiscoveredItem[] | null {
  const rawPath =
    process.env.KIABI_FALLBACK_ITEMS_JSON?.trim() ||
    "scripts/local-cron/.kiabi-browser-items.json";
  const path = resolve(process.cwd(), rawPath);
  if (!existsSync(path)) return null;

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as KiabiDiscoveredItem[];
  } catch {
    return null;
  }
}

function isKiabiDataDomeError(message: string): boolean {
  return /403|datadome|anti-bot|bloqueó/i.test(message);
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDiscount(current: number, reference: number | null): number {
  if (reference == null || reference <= current) return 0;
  return roundMoney(((reference - current) / reference) * 100);
}

function quoteFromDiscoveryItem(
  item: KiabiDiscoveredItem,
): KiabiProductQuote | null {
  if (item.priceHint == null || item.listPriceHint == null) return null;
  if (item.listPriceHint <= item.priceHint) return null;

  return {
    externalId: item.externalId,
    productUrl: item.productUrl,
    title: item.titleHint?.trim() || `Producto Kiabi ${item.externalId}`,
    brand: "Kiabi",
    price: roundMoney(item.priceHint),
    listPrice: roundMoney(item.listPriceHint),
    discountPercentage: computeDiscount(item.priceHint, item.listPriceHint),
    availability: "IN_STOCK",
    imageUrl: item.imageUrlHint,
  };
}

function mergeQuoteWithDiscovery(
  quote: KiabiProductQuote,
  item: KiabiDiscoveredItem,
): KiabiProductQuote {
  const fromListing = quoteFromDiscoveryItem(item);
  if (!fromListing) return quote;

  return {
    ...quote,
    title: quote.title || fromListing.title,
    price: quote.price ?? fromListing.price,
    listPrice:
      quote.listPrice != null && quote.listPrice > (quote.price ?? 0)
        ? quote.listPrice
        : fromListing.listPrice,
    discountPercentage:
      quote.discountPercentage ??
      fromListing.discountPercentage ??
      (quote.listPrice != null && quote.price != null
        ? computeDiscount(quote.price, quote.listPrice)
        : null),
    imageUrl: quote.imageUrl ?? fromListing.imageUrl ?? item.imageUrlHint,
  };
}

async function resolveKiabiQuote(
  item: KiabiDiscoveredItem,
): Promise<KiabiProductQuote> {
  try {
    const quote = await scrapeKiabiProductPage(item.productUrl, {
      timeoutMs: 18_000,
    });
    if (hasRealKiabiDiscount(quote)) {
      return mergeQuoteWithDiscovery(quote, item);
    }

    const fromListing = quoteFromDiscoveryItem(item);
    if (fromListing) return fromListing;

    return mergeQuoteWithDiscovery(quote, item);
  } catch (error) {
    const fromListing = quoteFromDiscoveryItem(item);
    if (fromListing) return fromListing;
    throw error;
  }
}

async function resolveModaCategoryId(
  client: TypedSupabaseClient,
): Promise<string | null> {
  const category = await resolveCategoryIdBySlug(
    client,
    composeSubcategorySlug("moda", "general"),
  );
  return category?.id ?? null;
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
  description: string | null;
  category_id: string | null;
}

export interface KiabiDealsRunResult {
  ok: true;
  enabled: boolean;
  finishedAt: string;
  discovery: {
    feedsFetched: number;
    candidates: number;
    feedErrors: Array<{ url: string; message: string }>;
    usedFallback?: boolean;
  };
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skippedNoDiscount: number;
  /** Ya en catálogo y omitidos (modo solo novedades). */
  skippedExisting: number;
  channelNotificationsSent: number;
  channelNotificationsSkipped: number;
  channelNotificationsQueued: number;
  errors: Array<{ externalId: string; message: string }>;
}

async function maybeNotifyKiabiDeal(
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
    telegramMinScore?: number;
  },
): Promise<"sent" | "skipped" | "failed" | "queued"> {
  const deal: DealCandidate = {
    productId: options.productId,
    asin: options.syntheticAsin,
    title: options.title,
    brand: options.brand ?? "Kiabi",
    categoryId: null,
    categoryName: "Moda",
    categorySlug: "general",
    parentCategorySlug: "moda",
    parentCategoryName: "Moda",
    retailer: "kiabi",
    currentPrice: options.currentPrice,
    previousPrice: options.previousPrice,
    discountPercentage: options.discountPercentage,
    dealLevel: options.dealLevel,
    score: options.score,
    dealLabel: options.dealLabel,
    productSlug: options.slug,
    imageUrl: options.imageUrl ?? null,
    summary: "Kiabi · rebaja verificada",
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

export async function runKiabiDealsCheck(options?: {
  limit?: number;
  feedUrls?: string[];
  notify?: boolean;
  delayMs?: number;
  /** Omite discovery y procesa solo estos candidatos (pruebas). */
  onlyItems?: KiabiDiscoveredItem[];
  /** Solo novedades: omitir productos ya en catálogo (salvo bajada de precio en listado). */
  newProductsOnly?: boolean;
  /** Umbral mínimo de score para Telegram canal (p. ej. pruebas). */
  telegramMinScore?: number;
}): Promise<KiabiDealsRunResult> {
  const finishedAt = new Date().toISOString();
  const appSettings = await getAppSettings();

  if (!appSettings.kiabiDealsEnabled) {
    return {
      ok: true,
      enabled: false,
      finishedAt,
      discovery: { feedsFetched: 0, candidates: 0, feedErrors: [] },
      processed: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      skippedNoDiscount: 0,
      skippedExisting: 0,
      channelNotificationsSent: 0,
      channelNotificationsSkipped: 0,
      channelNotificationsQueued: 0,
      errors: [],
    };
  }

  const client = createSupabaseServiceClient();
  const limit = options?.limit && options.limit > 0 ? options.limit : 12;
  const delayMs = options?.delayMs ?? 1_800;
  const shouldNotify = options?.notify ?? true;
  const minDiscount = appSettings.kiabiMinDiscountPercent;
  const kiabiTelegramMinScore =
    options?.telegramMinScore ?? appSettings.kiabiTelegramMinScore;
  const newProductsOnly =
    options?.newProductsOnly ?? appSettings.kiabiNewProductsOnly;
  const modaCategoryId = await resolveModaCategoryId(client);

  const discoveryResult = options?.onlyItems?.length
    ? {
        items: options.onlyItems,
        feedsFetched: 0,
        feedErrors: [] as Array<{ url: string; message: string }>,
        usedFallback: false,
      }
    : await discoverKiabiDeals({
        feedUrls: options?.feedUrls ?? (await resolveKiabiFeedUrlsForRun()),
        maxItems: appSettings.kiabiDiscoveryMaxItems,
        delayMs: 1_000,
      });

  let discovery = discoveryResult;
  let usedFallback = false;

  if (
    !options?.onlyItems?.length &&
    discovery.items.length === 0 &&
    discovery.feedErrors.length > 0
  ) {
    const fallback = loadKiabiFallbackItems();
    if (fallback?.length) {
      discovery = {
        ...discovery,
        items: fallback,
        usedFallback: true,
      };
      usedFallback = true;
    }
  }

  const { data: catalogRows, error: catalogError } = await client
    .from("products")
    .select(
      "id, asin, external_id, retailer, title, slug, product_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, description, category_id",
    )
    .eq("retailer", "kiabi");

  if (catalogError) {
    throw new Error(`No se pudo leer catálogo Kiabi: ${catalogError.message}`);
  }

  const catalogByExternalId = new Map(
    ((catalogRows ?? []) as CatalogRow[])
      .filter((row) => row.external_id)
      .map((row) => [row.external_id!.toUpperCase(), row] as const),
  );

  const newCandidates: KiabiDiscoveredItem[] = [];
  const existingCandidates: KiabiDiscoveredItem[] = [];
  const priceDropCandidates: KiabiDiscoveredItem[] = [];
  let skippedExisting = 0;
  const newOnly = newProductsOnly;

  for (const item of discovery.items) {
    const existing = catalogByExternalId.get(item.externalId.toUpperCase());
    if (!existing) {
      newCandidates.push(item);
      continue;
    }

    const storedPrice = toNumber(existing.current_price);
    const listingPrice = item.priceHint;
    if (
      listingPrice != null &&
      storedPrice != null &&
      listingPrice < storedPrice - 0.009
    ) {
      priceDropCandidates.push(item);
      continue;
    }

    if (newOnly) {
      skippedExisting += 1;
    } else {
      existingCandidates.push(item);
    }
  }

  let queue: KiabiDiscoveredItem[];
  if (newOnly) {
    queue = [...newCandidates, ...priceDropCandidates].slice(0, limit);
  } else {
    const newBudget = Math.min(newCandidates.length, limit);
    const updateBudget = Math.max(0, limit - newBudget);
    queue = [
      ...newCandidates.slice(0, newBudget),
      ...existingCandidates.slice(0, updateBudget),
    ];
  }

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let skippedNoDiscount = 0;
  let channelNotificationsSent = 0;
  let channelNotificationsSkipped = 0;
  let channelNotificationsQueued = 0;
  const errors: Array<{ externalId: string; message: string }> = [];

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index]!;
    processed += 1;

    try {
      const quote = await resolveKiabiQuote(item);

      if (!hasRealKiabiDiscount(quote) || quote.price == null) {
        skippedNoDiscount += 1;
        continue;
      }

      const price = roundMoney(quote.price);
      const listPrice =
        quote.listPrice != null && quote.listPrice > price
          ? roundMoney(quote.listPrice)
          : null;
      const discount = computeDiscount(price, listPrice);
      if (discount < minDiscount) {
        skippedNoDiscount += 1;
        continue;
      }

      const reference = listPrice ?? price;
      const syntheticAsin = syntheticAsinForRetailer("kiabi", quote.externalId);
      const existing = catalogByExternalId.get(quote.externalId.toUpperCase());
      const title = quote.title.trim();
      const productUrl = quote.productUrl;
      const now = new Date().toISOString();
      const scoring = dealScoringService.scoreProduct({
        currentPrice: price,
        previousPrice: reference > price ? reference : null,
        lowestPrice: existing ? toNumber(existing.lowest_price) : price,
        categorySlug: "moda",
      });

      if (!existing) {
        const slug = slugify(`${title}-${quote.externalId}`);
        const insertRow = {
          retailer: "kiabi" as const,
          external_id: quote.externalId,
          product_url: productUrl,
          asin: syntheticAsin,
          title,
          slug,
          amazon_url: productUrl,
          affiliate_url: productUrl,
          brand: quote.brand ?? "Kiabi",
          image_url: quote.imageUrl ?? null,
          description:
            formatDescriptionForStorage([], quote.description) ?? null,
          category_id: modaCategoryId,
          current_price: price,
          previous_price: reference > price ? reference : null,
          lowest_price: price,
          highest_price: Math.max(price, reference),
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
          source: "kiabi",
        });

        inserted += 1;
        catalogByExternalId.set(quote.externalId.toUpperCase(), {
          ...(insertRow as unknown as CatalogRow),
          id: insertedRow.id,
        });

        if (shouldNotify) {
          const channelMinScore = kiabiTelegramMinScore;
          const qualifiesChannel = scoring.score >= channelMinScore;
          const isDeal = scoring.level !== DealLevel.NORMAL;
          if (isDeal || qualifiesChannel) {
          const affiliateUrl = resolveProductBuyUrl(insertRow);
          const notifyResult = await maybeNotifyKiabiDeal(client, {
            productId: insertedRow.id,
            syntheticAsin,
            title,
            slug: insertedRow.slug,
            currentPrice: price,
            previousPrice: reference,
            discountPercentage: discount,
            score: scoring.score,
            dealLevel: scoring.level,
            dealLabel: scoring.label,
            productUrl,
            affiliateUrl,
            brand: quote.brand,
            imageUrl: quote.imageUrl,
            telegramMinScore: channelMinScore,
          });
          if (notifyResult === "queued") channelNotificationsQueued += 1;
          else if (notifyResult === "sent") channelNotificationsSent += 1;
          else if (notifyResult === "skipped") channelNotificationsSkipped += 1;
          }
        }
      } else {
        const storedPrice = toNumber(existing.current_price) ?? price;
        const priceChanged = Math.abs(storedPrice - price) >= 0.01;
        const previousLowest = toNumber(existing.lowest_price);
        const previousHighest = toNumber(existing.highest_price);

        const patch = {
          title,
          product_url: productUrl,
          amazon_url: productUrl,
          affiliate_url: existing.affiliate_url ?? productUrl,
          brand: quote.brand ?? existing.brand,
          image_url: quote.imageUrl ?? existing.image_url,
          ...(quote.description
            ? {
                description:
                  formatDescriptionForStorage([], quote.description) ??
                  existing.description,
              }
            : {}),
          category_id: existing.category_id ?? modaCategoryId,
          current_price: price,
          previous_price:
            reference > price
              ? reference
              : toNumber(existing.previous_price),
          lowest_price:
            previousLowest == null
              ? price
              : roundMoney(Math.min(previousLowest, price)),
          highest_price: roundMoney(
            Math.max(previousHighest ?? price, price, reference),
          ),
          discount_percentage: discount,
          availability: ProductAvailability.IN_STOCK,
          last_checked_at: now,
          updated_at: now,
        };

        const { error: updateError } = await client
          .from("products")
          .update(patch)
          .eq("id", existing.id);

        if (updateError) throw new Error(updateError.message);

        if (priceChanged) {
          await client.from("price_history").insert({
            product_id: existing.id,
            price,
            source: "kiabi",
          });
          updated += 1;

          if (shouldNotify) {
            const channelMinScore = kiabiTelegramMinScore;
            const qualifiesChannel = scoring.score >= channelMinScore;
            const isDeal = scoring.level !== DealLevel.NORMAL;
            if (isDeal || qualifiesChannel) {
            const affiliateUrl = resolveProductBuyUrl({
              ...existing,
              ...patch,
            });
            const notifyResult = await maybeNotifyKiabiDeal(client, {
              productId: existing.id,
              syntheticAsin: existing.asin,
              title,
              slug: existing.slug,
              currentPrice: price,
              previousPrice: reference,
              discountPercentage: discount,
              score: scoring.score,
              dealLevel: scoring.level,
              dealLabel: scoring.label,
              productUrl,
              affiliateUrl,
              brand: quote.brand,
              imageUrl: quote.imageUrl ?? existing.image_url,
              telegramMinScore: channelMinScore,
            });
            if (notifyResult === "queued") channelNotificationsQueued += 1;
            if (notifyResult === "sent") channelNotificationsSent += 1;
            else if (notifyResult === "skipped") channelNotificationsSkipped += 1;
            }
          }
        } else {
          unchanged += 1;
        }
      }
    } catch (error) {
      errors.push({
        externalId: item.externalId,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }

    if (index < queue.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    ok: true,
    enabled: true,
    finishedAt,
    discovery: {
      feedsFetched: discovery.feedsFetched,
      candidates: discovery.items.length,
      feedErrors: discovery.feedErrors,
      usedFallback,
    },
    processed,
    inserted,
    updated,
    unchanged,
    skippedNoDiscount,
    skippedExisting,
    channelNotificationsSent,
    channelNotificationsSkipped,
    channelNotificationsQueued,
    errors,
  };
}
