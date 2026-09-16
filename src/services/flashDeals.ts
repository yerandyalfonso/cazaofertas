import {
  extractAsin,
  generateAffiliateUrl,
  generateAmazonUrl,
} from "@/lib/affiliate";
import {
  resolveCategoryMetaForDeal,
} from "@/lib/categories";
import { inferProductSubcategorySlug } from "@/lib/product-category-inference";
import { roundMoney } from "@/lib/money";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import { ensureCategoryKeywordRulesLoaded } from "@/services/categoryKeywords";
import {
  discoverFlashDealListings,
  type DiscoveredListingItem,
} from "@/providers/price/amazonFlashDiscovery";
import { previewAmazonProductPage } from "@/providers/price";
import { dealScoringService } from "@/services/deal-scoring";
import {
  getAppSettings,
  resolveAmazonFlashFeedUrlsForRun,
} from "@/services/appSettings";
import { notifyChannelDealIfEligible } from "@/services/telegram";
import type { DealCandidate } from "@/services/alertMatching";
import {
  addFlashAsinCooldown,
  getActiveFlashAsinCooldowns,
} from "@/services/flashAsinCooldown";
import { DealLevel, ProductAvailability } from "@/types";

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

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

function computeDiscount(
  current: number,
  reference: number | null,
): number | null {
  if (reference == null || reference <= current) return null;
  return roundMoney(((reference - current) / reference) * 100);
}

async function maybeNotifyFlashChannel(
  client: TypedSupabaseClient,
  options: {
    productId: string;
    asin: string;
    title: string;
    currentPrice: number;
    previousPrice: number;
    discountPercentage: number;
    score: number;
    dealLevel: DealLevel;
    dealLabel: string;
    amazonUrl: string;
    affiliateUrl?: string | null;
    productSlug?: string | null;
    brand?: string | null;
    categoryId?: string | null;
    categoryName?: string | null;
    categorySlug?: string | null;
    parentCategorySlug?: string | null;
    parentCategoryName?: string | null;
    imageUrl?: string | null;
    summary?: string | null;
    expiresAt?: string | null;
  },
): Promise<"sent" | "skipped" | "failed" | "queued"> {
  const deal: DealCandidate = {
    productId: options.productId,
    asin: options.asin,
    title: options.title,
    brand: options.brand ?? null,
    categoryId: options.categoryId ?? null,
    categoryName: options.categoryName ?? null,
    categorySlug: options.categorySlug ?? null,
    parentCategorySlug: options.parentCategorySlug ?? null,
    parentCategoryName: options.parentCategoryName ?? null,
    retailer: "amazon",
    currentPrice: options.currentPrice,
    previousPrice: options.previousPrice,
    discountPercentage: options.discountPercentage,
    dealLevel: options.dealLevel,
    score: options.score,
    dealLabel: options.dealLabel,
    productSlug: options.productSlug ?? null,
    imageUrl: options.imageUrl ?? null,
    summary: options.summary ?? null,
    affiliateUrl: generateAffiliateUrl({
      amazon_url: options.amazonUrl,
      affiliate_url: options.affiliateUrl,
      asin: options.asin,
    }),
    nearHistoricalLow: options.dealLevel === DealLevel.HISTORICAL_LOW,
    expiresAt: options.expiresAt ?? null,
  };

  const result = await notifyChannelDealIfEligible(client, deal);
  if (result.queued) return "queued";
  if (result.sent) return "sent";
  if (result.skipped) return "skipped";
  return "failed";
}

export interface FlashDealProductReport {
  asin: string;
  title: string;
  action: "inserted" | "updated" | "unchanged" | "skipped";
  isFlashDeal: boolean;
  isNewLow: boolean;
  currentPrice: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  dealLabel?: string;
  dealLevel?: string;
  amazonUrl: string;
  imageUrl?: string | null;
  wasNewToCatalog: boolean;
}

export interface FlashDealsRunResult {
  ok: true;
  finishedAt: string;
  focus: "discovery-insert";
  discovery: {
    feedsFetched: number;
    candidates: number;
    newAsins: number;
    existingAsins: number;
    usedSimulation: boolean;
    feedErrors: Array<{ url: string; message: string }>;
  };
  /** Productos del listado procesados (no el catálogo completo). */
  catalogScanned: number;
  flashDealsDetected: number;
  inserted: number;
  updated: number;
  unchanged: number;
  newLows: number;
  channelNotificationsSent: number;
  channelNotificationsSkipped: number;
  channelNotificationsQueued: number;
  /** ASINs en cooldown (sin buy box / OOS previos). */
  skippedCooldown: number;
  /** Sin precio usable tras scrapear la ficha. */
  skippedNoPrice: number;
  products: FlashDealProductReport[];
  errors: Array<{ asin: string; message: string }>;
}

const ASIN_LOOKUP_CHUNK = 100;

/** Solo comprueba existencia: no descarga el catálogo completo (egress). */
async function fetchExistingAsins(
  client: TypedSupabaseClient,
  asins: string[],
): Promise<Set<string>> {
  const existing = new Set<string>();
  const unique = [...new Set(asins.map((asin) => asin.toUpperCase()).filter(Boolean))];
  for (let offset = 0; offset < unique.length; offset += ASIN_LOOKUP_CHUNK) {
    const chunk = unique.slice(offset, offset + ASIN_LOOKUP_CHUNK);
    const { data, error } = await client
      .from("products")
      .select("asin")
      .in("asin", chunk);
    if (error) {
      throw new Error(`No se pudo comprobar ASINs existentes: ${error.message}`);
    }
    for (const row of data ?? []) {
      if (row.asin) existing.add(String(row.asin).toUpperCase());
    }
  }
  return existing;
}

/**
 * Descubridor flash:
 * 1) Lee Gold Box / Deals + departamentos de /events/deals (rotados)
 * 2) Compara ASINs con Supabase
 * 3) Solo INSERT de novedades (+ cola Telegram si score alto)
 *
 * Los productos que ya están en catálogo NO se re-chequean aquí:
 * eso lo hace el cron de precios (`check-prices`).
 */
export async function runFlashDealsCheck(options?: {
  /** Máximo de ASINs *nuevos* a enriquecer e insertar. */
  limit?: number;
  feedUrls?: string[];
  /** ASINs/URLs inyectados como feed dinámico. */
  injectedAsins?: string[];
  /** @deprecated Ignorado: el catálogo existente no se re-escanea. */
  includeCatalog?: boolean;
  allowSimulatedFallback?: boolean;
  notify?: boolean;
  delayMs?: number;
}): Promise<FlashDealsRunResult> {
  const client = createSupabaseServiceClient();
  await ensureCategoryKeywordRulesLoaded();
  const appSettings = await getAppSettings();
  const limit =
    options?.limit && options.limit > 0
      ? options.limit
      : appSettings.amazonFlashInsertLimit;
  const delayMs =
    options?.delayMs ?? (process.env.VERCEL ? 2_000 : 1_200);
  const shouldNotify = options?.notify ?? true;

  const feedUrls =
    options?.feedUrls ?? (await resolveAmazonFlashFeedUrlsForRun());

  const discovery = await discoverFlashDealListings({
    feedUrls,
    injectedAsins: options?.injectedAsins,
    maxItems: Math.max(limit * 4, 60),
    delayMs: 800,
    allowSimulatedFallback: options?.allowSimulatedFallback ?? true,
  });

  const discovered = discovery.items;
  const catalogByAsin = await fetchExistingAsins(
    client,
    discovered.map((item) => item.asin),
  );

  const newCandidates: DiscoveredListingItem[] = [];
  let existingAsins = 0;

  for (const item of discovered) {
    if (catalogByAsin.has(item.asin.toUpperCase())) {
      existingAsins += 1;
    } else {
      newCandidates.push(item);
    }
  }

  const cooldowns = await getActiveFlashAsinCooldowns();
  const eligible: DiscoveredListingItem[] = [];
  let skippedCooldown = 0;
  for (const item of newCandidates) {
    if (cooldowns.has(item.asin)) {
      skippedCooldown += 1;
      continue;
    }
    eligible.push(item);
  }
  shuffleInPlace(eligible);

  // Solo ASINs nuevos (fuera de cooldown). Los ya en BD los vigila check-prices.
  const queue = eligible.slice(0, limit);

  const products: FlashDealProductReport[] = [];
  const errors: Array<{ asin: string; message: string }> = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let newLows = 0;
  let catalogScanned = 0;
  let channelNotificationsSent = 0;
  let channelNotificationsSkipped = 0;
  let channelNotificationsQueued = 0;
  let skippedNoPrice = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index]!;
    catalogScanned += 1;
    // Defensa: ASIN indexado entre discovery y este paso → lo deja check-prices.
    if (catalogByAsin.has(item.asin.toUpperCase())) {
      unchanged += 1;
      continue;
    }

    try {
      let title =
        item.titleHint?.trim() || `Producto Amazon ${item.asin}`;
      // Hints del listado Gold Box NO son fuente de verdad (pueden ir sin IVA
      // o ser de otra oferta). Solo simulación puede insertar con hints.
      let price = item.origin === "simulated" ? (item.priceHint ?? null) : null;
      let listPrice =
        item.origin === "simulated" ? (item.listPriceHint ?? null) : null;
      let amazonUrl = item.amazonUrl || generateAmazonUrl(item.asin);
      let isFlashDeal = item.origin !== "live" || Boolean(listPrice && price);
      let imageUrl: string | null = null;
      let brand: string | null = null;
      let description: string | null = null;
      let categorySlugHint: string | undefined;
      let categoryBreadcrumbs: string[] | undefined;
      let dealExpiresAt: string | null = null;

      const needsLiveEnrichment = item.origin !== "simulated" || price == null;

      if (needsLiveEnrichment) {
        try {
          const preview = await previewAmazonProductPage(amazonUrl, {
            timeoutMs: 18_000,
          });
          if (preview.price != null) price = preview.price;
          if (preview.listPrice != null) listPrice = preview.listPrice;
          if (preview.title?.trim()) title = preview.title.trim();
          amazonUrl = preview.amazonUrl || amazonUrl;
          isFlashDeal = preview.isFlashDeal || isFlashDeal;
          if (preview.imageUrl) imageUrl = preview.imageUrl;
          if (preview.brand) brand = preview.brand;
          if (preview.description) description = preview.description;
          if (preview.categorySlug) categorySlugHint = preview.categorySlug;
          if (preview.breadcrumbs?.length) {
            categoryBreadcrumbs = preview.breadcrumbs;
          }
          if (preview.dealExpiresAt) dealExpiresAt = preview.dealExpiresAt;

          if (
            price == null &&
            preview.availability === ProductAvailability.OUT_OF_STOCK
          ) {
            await addFlashAsinCooldown(item.asin, {
              hours: 24,
              reason: "out-of-stock",
            });
            skippedNoPrice += 1;
            console.warn(
              `[flash] ${item.asin}: agotado / sin buy box → cooldown 24 h`,
            );
            continue;
          }
        } catch (enrichError) {
          // Live/injected: sin ficha no insertamos. Simulación: hints ok.
          if (item.origin !== "simulated" || price == null) {
            throw enrichError;
          }
        }
      }

      if (price == null && item.origin !== "simulated") {
        // Último recurso: precio del listado (Amazon ES suele llevar IVA).
        if (item.priceHint != null && item.priceHint > 0) {
          price = item.priceHint;
          if (
            listPrice == null &&
            item.listPriceHint != null &&
            item.listPriceHint > item.priceHint
          ) {
            listPrice = item.listPriceHint;
          }
          console.warn(
            `[flash] ${item.asin}: buy box vacío; usando hint del listado (${price} €)`,
          );
        }
      }

      if (price == null) {
        await addFlashAsinCooldown(item.asin, {
          hours: 12,
          reason: "no-buybox",
        });
        skippedNoPrice += 1;
        console.warn(
          `[flash] ${item.asin}: sin precio buy box → cooldown 12 h (sin alerta Telegram)`,
        );
        continue;
      }

      const discountPercentage =
        computeDiscount(price, listPrice) ??
        (listPrice == null ? null : 0);

      if (listPrice == null || listPrice <= price) {
        // Sin tachado: usar un margen mínimo simbólico solo si venía de flash simulado.
        if (item.origin === "simulated" && item.listPriceHint) {
          listPrice = item.listPriceHint;
        }
      }

      const reference =
        listPrice != null && listPrice > price ? listPrice : price;
      const discount =
        computeDiscount(price, reference) ?? discountPercentage ?? 0;

      isFlashDeal =
        isFlashDeal ||
        discount >= 15 ||
        item.origin === "simulated" ||
        item.origin === "live";

      const subcategorySlug = inferProductSubcategorySlug({
        breadcrumbs: categoryBreadcrumbs,
        title,
        brand,
        feedCategorySlug: item.expectedCategorySlug ?? categorySlugHint ?? null,
      });
      const categoryMeta = await resolveCategoryMetaForDeal(
        client,
        subcategorySlug,
      );

      const slug = slugify(`${title}-${item.asin}`);
      const now = new Date().toISOString();
      const scoring = dealScoringService.scoreProduct({
        currentPrice: price,
        previousPrice: reference > price ? reference : null,
        lowestPrice: price,
        categorySlug: categoryMeta.parentSlug,
      });

      const { error: slugCleanupError } = await client
        .from("products")
        .delete()
        .eq("slug", slug)
        .neq("asin", item.asin);

      if (slugCleanupError) {
        throw new Error(slugCleanupError.message);
      }

      const { data: insertedRow, error: insertError } = await client
        .from("products")
        .insert({
          asin: item.asin,
          title,
          slug,
          amazon_url: amazonUrl,
          affiliate_url: generateAffiliateUrl({
            amazon_url: amazonUrl,
            asin: item.asin,
          }),
          brand,
          image_url: imageUrl,
          description,
          category_id: categoryMeta.categoryId,
          current_price: price,
          previous_price: reference,
          lowest_price: price,
          highest_price: Math.max(price, reference),
          discount_percentage: discount,
          currency: "EUR",
          availability: ProductAvailability.IN_STOCK,
          is_active: true,
          last_checked_at: now,
          updated_at: now,
          deal_expires_at: dealExpiresAt,
        })
        .select("id, asin, title, slug")
        .single();

      if (insertError) {
        // Carrera / ASIN ya creado: lo vigila check-prices, no re-chequeamos aquí.
        if (
          insertError.code === "23505" ||
          /duplicate|unique/i.test(insertError.message)
        ) {
          unchanged += 1;
          continue;
        }
        throw new Error(insertError.message);
      }

      await client.from("price_history").insert({
        product_id: insertedRow.id,
        price,
        source: "amazon",
      });

      catalogByAsin.add(item.asin.toUpperCase());

      inserted += 1;
      newLows += 1;

      if (shouldNotify) {
        const channelStatus = await maybeNotifyFlashChannel(client, {
          productId: insertedRow.id,
          asin: item.asin,
          title: insertedRow.title,
          currentPrice: price,
          previousPrice: reference,
          discountPercentage: discount,
          score: scoring.score,
          dealLevel: scoring.level,
          dealLabel: scoring.label,
          amazonUrl,
          productSlug: slug,
          brand,
          categoryId: categoryMeta.categoryId,
          categoryName: categoryMeta.subcategoryName,
          categorySlug: categoryMeta.subcategorySlug,
          parentCategorySlug: categoryMeta.parentSlug,
          parentCategoryName: categoryMeta.parentName,
          imageUrl,
          summary: description || brand,
          expiresAt: dealExpiresAt,
        });
        if (channelStatus === "queued") channelNotificationsQueued += 1;
        if (channelStatus === "sent") channelNotificationsSent += 1;
        if (channelStatus === "skipped") channelNotificationsSkipped += 1;
      }

      products.push({
        asin: item.asin,
        title: insertedRow.title,
        action: "inserted",
        isFlashDeal,
        isNewLow: true,
        currentPrice: price,
        listPrice: reference > price ? reference : null,
        discountPercentage: discount,
        dealLabel: scoring.label,
        dealLevel: scoring.level,
        amazonUrl,
        imageUrl,
        wasNewToCatalog: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      errors.push({
        asin: item.asin,
        message,
      });
      await addFlashAsinCooldown(item.asin, {
        hours: 6,
        reason: "enrich-error",
      });
    }

    if (index < queue.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    ok: true,
    finishedAt: new Date().toISOString(),
    focus: "discovery-insert",
    discovery: {
      feedsFetched: discovery.feedsFetched,
      candidates: discovered.length,
      newAsins: newCandidates.length,
      existingAsins,
      usedSimulation: discovery.usedSimulation,
      feedErrors: discovery.feedErrors,
    },
    catalogScanned,
    flashDealsDetected: products.filter((p) => p.isFlashDeal).length,
    inserted,
    updated,
    unchanged,
    newLows,
    channelNotificationsSent,
    channelNotificationsSkipped,
    channelNotificationsQueued,
    skippedCooldown,
    skippedNoPrice,
    products: products.filter(
      (p) => p.action === "inserted" || p.action === "updated" || p.isFlashDeal,
    ),
    errors,
  };
}

export async function resolveAsinFromUrl(url: string): Promise<string | null> {
  return extractAsin(url);
}
