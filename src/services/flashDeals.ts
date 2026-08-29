import {
  extractAsin,
  generateAffiliateUrl,
  generateAmazonUrl,
} from "@/lib/affiliate";
import { inferAmazonCategorySlug } from "@/lib/amazon-category";
import {
  resolveCategoryIdBySlug,
} from "@/lib/categories";
import { roundMoney, toNumber } from "@/lib/money";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import {
  discoverFlashDealListings,
  type DiscoveredListingItem,
} from "@/providers/price/amazonFlashDiscovery";
import { previewAmazonProductPage } from "@/providers/price";
import { dealScoringService } from "@/services/deal-scoring";
import { notifyChannelDealIfEligible } from "@/services/telegram";
import type { DealCandidate } from "@/services/alertMatching";
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
    imageUrl?: string | null;
    summary?: string | null;
  },
): Promise<"sent" | "skipped" | "failed"> {
  const deal: DealCandidate = {
    productId: options.productId,
    asin: options.asin,
    title: options.title,
    brand: options.brand ?? null,
    categoryId: options.categoryId ?? null,
    categoryName: options.categoryName ?? null,
    categorySlug: options.categorySlug ?? null,
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
  };

  const result = await notifyChannelDealIfEligible(client, deal);
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
  products: FlashDealProductReport[];
  errors: Array<{ asin: string; message: string }>;
}

interface CatalogRow {
  id: string;
  asin: string;
  title: string;
  slug: string;
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

/**
 * Cron discovery-first:
 * 1) Lee listados flash (live / feeds / simulación)
 * 2) Compara ASINs con Supabase
 * 3) INSERT de novedades; UPDATE de precio solo si ya existen
 */
export async function runFlashDealsCheck(options?: {
  /** Máximo de candidatos del listado a enriquecer (prioriza ASINs nuevos). */
  limit?: number;
  feedUrls?: string[];
  /** ASINs/URLs inyectados como feed dinámico. */
  injectedAsins?: string[];
  /** @deprecated El catálogo completo ya no se escanea; solo coincidencias del listado. */
  includeCatalog?: boolean;
  allowSimulatedFallback?: boolean;
  notify?: boolean;
  delayMs?: number;
}): Promise<FlashDealsRunResult> {
  const client = createSupabaseServiceClient();
  const limit = options?.limit && options.limit > 0 ? options.limit : 25;
  const delayMs =
    options?.delayMs ?? (process.env.VERCEL ? 2_000 : 1_200);
  const shouldNotify = options?.notify ?? true;

  const discovery = await discoverFlashDealListings({
    feedUrls: options?.feedUrls,
    injectedAsins: options?.injectedAsins,
    maxItems: Math.max(limit * 2, 40),
    delayMs: 800,
    allowSimulatedFallback: options?.allowSimulatedFallback ?? true,
  });

  const { data: catalogRows, error: catalogError } = await client
    .from("products")
    .select(
      "id, asin, title, slug, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, description, category_id",
    );

  if (catalogError) {
    throw new Error(`No se pudo leer el catálogo: ${catalogError.message}`);
  }

  const catalogByAsin = new Map(
    ((catalogRows ?? []) as CatalogRow[]).map(
      (row) => [row.asin.toUpperCase(), row] as const,
    ),
  );

  const discovered = discovery.items;
  const newCandidates: DiscoveredListingItem[] = [];
  const existingCandidates: DiscoveredListingItem[] = [];

  for (const item of discovered) {
    if (catalogByAsin.has(item.asin)) {
      existingCandidates.push(item);
    } else {
      newCandidates.push(item);
    }
  }

  // Foco: novedades primero; el cupo restante sirve para actualizar precios.
  const newBudget = Math.min(newCandidates.length, limit);
  const updateBudget = Math.max(0, limit - newBudget);
  const queue = [
    ...newCandidates.slice(0, newBudget),
    ...existingCandidates.slice(0, updateBudget),
  ];

  const products: FlashDealProductReport[] = [];
  const errors: Array<{ asin: string; message: string }> = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let newLows = 0;
  let catalogScanned = 0;
  let channelNotificationsSent = 0;
  let channelNotificationsSkipped = 0;

  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index]!;
    catalogScanned += 1;
    const existing = catalogByAsin.get(item.asin);
    const wasNewToCatalog = !existing;

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
      let imageUrl: string | null = existing?.image_url ?? null;
      let brand: string | null = existing?.brand ?? null;
      let description: string | null = existing?.description ?? null;
      let categorySlugHint: string | undefined;
      let categoryBreadcrumbs: string[] | undefined;

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
        } catch (enrichError) {
          // Live/injected: sin ficha no insertamos. Simulación: hints ok.
          if (item.origin !== "simulated" || price == null) {
            throw enrichError;
          }
        }
      }

      if (price == null) {
        errors.push({
          asin: item.asin,
          message:
            "Sin precio del buy box Amazon ES (no se usan hints del listado).",
        });
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

      const resolvedCategorySlug =
        categorySlugHint ??
        inferAmazonCategorySlug({
          breadcrumbs: categoryBreadcrumbs,
          title,
          brand,
        }) ??
        null;
      const categoryMeta = resolvedCategorySlug
        ? await resolveCategoryIdBySlug(client, resolvedCategorySlug)
        : null;
      const scoringCategorySlug = resolvedCategorySlug ?? "general";

      if (wasNewToCatalog) {
        const slug = slugify(`${title}-${item.asin}`);
        const now = new Date().toISOString();
        const scoring = dealScoringService.scoreProduct({
          currentPrice: price,
          previousPrice: reference > price ? reference : null,
          lowestPrice: price,
          categorySlug: scoringCategorySlug,
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
            category_id: categoryMeta?.id ?? null,
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
          })
          .select("id, asin, title, slug")
          .single();

        if (insertError) {
          // Carrera / ASIN ya creado: actualizar solo precio.
          if (insertError.code === "23505" || /duplicate|unique/i.test(insertError.message)) {
            const { data: raced } = await client
              .from("products")
              .select(
                "id, asin, title, slug, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, description",
              )
              .eq("asin", item.asin)
              .maybeSingle();

            if (raced) {
              catalogByAsin.set(item.asin, raced as CatalogRow);
              // Caer al branch de update más abajo reutilizando lógica vía goto-style.
              const storedPrice = toNumber(raced.current_price) ?? price;
              const priceChanged = Math.abs(price - storedPrice) >= 0.01;
              if (priceChanged) {
                await client
                  .from("products")
                  .update({
                    current_price: price,
                    previous_price: reference,
                    discount_percentage: discount,
                    lowest_price: roundMoney(
                      Math.min(toNumber(raced.lowest_price) ?? price, price),
                    ),
                    highest_price: roundMoney(
                      Math.max(
                        toNumber(raced.highest_price) ?? price,
                        price,
                        reference,
                      ),
                    ),
                    last_checked_at: now,
                    updated_at: now,
                  })
                  .eq("id", raced.id);
                await client.from("price_history").insert({
                  product_id: raced.id,
                  price,
                  source: "amazon",
                });
                updated += 1;
                products.push({
                  asin: item.asin,
                  title: raced.title,
                  action: "updated",
                  isFlashDeal,
                  isNewLow: false,
                  currentPrice: price,
                  listPrice: reference > price ? reference : null,
                  discountPercentage: discount,
                  amazonUrl,
                  wasNewToCatalog: false,
                });
              } else {
                unchanged += 1;
              }
              continue;
            }
          }
          throw new Error(insertError.message);
        }

        await client.from("price_history").insert({
          product_id: insertedRow.id,
          price,
          source: "amazon",
        });

        catalogByAsin.set(item.asin, {
          id: insertedRow.id,
          asin: insertedRow.asin,
          title: insertedRow.title,
          slug: insertedRow.slug ?? slug,
          amazon_url: amazonUrl,
          affiliate_url: null,
          current_price: price,
          previous_price: reference,
          lowest_price: price,
          highest_price: Math.max(price, reference),
          brand,
          image_url: imageUrl,
          description,
          category_id: categoryMeta?.id ?? null,
        });

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
            categoryId: categoryMeta?.id ?? null,
            categoryName: categoryMeta?.name ?? null,
            categorySlug: scoringCategorySlug,
            imageUrl,
            summary: description || brand,
          });
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
      } else {
        // Producto ya en catálogo: solo precio / descuento / histórico.
        const storedPrice = toNumber(existing!.current_price) ?? price;
        const previousLowest = toNumber(existing!.lowest_price);
        const isNewLow =
          previousLowest === null ? true : price < previousLowest - 0.001;
        const priceChanged = Math.abs(price - storedPrice) >= 0.01;

        if (!priceChanged && !isNewLow) {
          await client
            .from("products")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", existing!.id);
          unchanged += 1;
          products.push({
            asin: item.asin,
            title: existing!.title,
            action: "unchanged",
            isFlashDeal,
            isNewLow: false,
            currentPrice: price,
            listPrice: reference > price ? reference : null,
            discountPercentage: discount,
            amazonUrl,
            imageUrl: imageUrl ?? existing!.image_url,
            wasNewToCatalog: false,
          });
        } else {
          const lowestPrice = roundMoney(
            Math.min(previousLowest ?? price, price),
          );
          const highestPrice = roundMoney(
            Math.max(
              toNumber(existing!.highest_price) ?? price,
              price,
              reference,
            ),
          );
          const scoring = dealScoringService.scoreProduct({
            currentPrice: price,
            previousPrice: reference > price ? reference : storedPrice,
            lowestPrice: previousLowest,
            categorySlug: scoringCategorySlug,
          });
          const now = new Date().toISOString();

          const { error: updateError } = await client
            .from("products")
            .update({
              current_price: price,
              previous_price: reference,
              lowest_price: lowestPrice,
              highest_price: highestPrice,
              discount_percentage: discount,
              last_checked_at: now,
              updated_at: now,
              ...(imageUrl ? { image_url: imageUrl } : {}),
              ...(brand ? { brand } : {}),
              ...(description ? { description } : {}),
              ...(!existing!.category_id && categoryMeta?.id
                ? { category_id: categoryMeta.id }
                : {}),
            })
            .eq("id", existing!.id);

          if (updateError) {
            throw new Error(updateError.message);
          }

          await client.from("price_history").insert({
            product_id: existing!.id,
            price,
            source: "amazon",
          });

          updated += 1;
          if (isNewLow) newLows += 1;

          if (shouldNotify) {
            const channelStatus = await maybeNotifyFlashChannel(client, {
              productId: existing!.id,
              asin: item.asin,
              title: existing!.title,
              currentPrice: price,
              previousPrice: reference > price ? reference : storedPrice,
              discountPercentage: discount,
              score: scoring.score,
              dealLevel: scoring.level,
              dealLabel: scoring.label,
              amazonUrl,
              affiliateUrl: existing!.affiliate_url,
              productSlug: existing!.slug,
              brand: brand ?? existing!.brand,
              categoryId: categoryMeta?.id ?? existing!.category_id,
              categoryName: categoryMeta?.name ?? null,
              categorySlug: scoringCategorySlug,
              imageUrl: imageUrl ?? existing!.image_url,
              summary:
                description ||
                existing!.description?.trim() ||
                brand ||
                existing!.brand ||
                null,
            });
            if (channelStatus === "sent") channelNotificationsSent += 1;
            if (channelStatus === "skipped") channelNotificationsSkipped += 1;
          }

          products.push({
            asin: item.asin,
            title: existing!.title,
            action: "updated",
            isFlashDeal,
            isNewLow,
            currentPrice: price,
            listPrice: reference > price ? reference : null,
            discountPercentage: discount,
            dealLabel: scoring.label,
            dealLevel: scoring.level,
            amazonUrl,
            imageUrl: imageUrl ?? existing!.image_url,
            wasNewToCatalog: false,
          });
        }
      }
    } catch (error) {
      errors.push({
        asin: item.asin,
        message: error instanceof Error ? error.message : "Error desconocido",
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
      existingAsins: existingCandidates.length,
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
    products: products.filter(
      (p) => p.action === "inserted" || p.action === "updated" || p.isFlashDeal,
    ),
    errors,
  };
}

export async function resolveAsinFromUrl(url: string): Promise<string | null> {
  return extractAsin(url);
}
