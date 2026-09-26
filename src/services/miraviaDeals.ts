import { resolveCategoryMetaForDeal } from "@/lib/categories";
import { inferProductSubcategorySlug } from "@/lib/product-category-inference";
import { roundMoney, toNumber } from "@/lib/money";
import {
  resolveProductBuyUrl,
  syntheticAsinForRetailer,
} from "@/lib/retailers";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import { getAppSettings, resolveMiraviaFeedUrlsForRun } from "@/services/appSettings";
import { ensureCategoryKeywordRulesLoaded } from "@/services/categoryKeywords";
import {
  discoverMiraviaDeals,
  isPlaceholderMiraviaTitle,
  scrapeMiraviaProductPage,
  type MiraviaDiscoveredItem,
} from "@/providers/retail/miravia";
import type { DealCandidate } from "@/services/alertMatching";
import { dealScoringService } from "@/services/deal-scoring";
import { notifyChannelDealIfEligible } from "@/services/telegram";
import { notifyMatchingUsers } from "@/services/notifications";
import { DealLevel, ProductAvailability } from "@/types";

/** Slug estable: el externalId siempre queda al final (no se trunca). */
function slugifyTitleWithId(title: string, externalId: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const id = externalId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${base || "producto"}-${id}`;
}

const CATALOG_SELECT =
  "id, asin, external_id, retailer, title, slug, product_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, category_id";
const CATALOG_LOOKUP_CHUNK = 100;

/** Solo filas de los IDs descubiertos (evita descargar todo el catálogo Miravia). */
async function loadMiraviaCatalogForItems(
  client: TypedSupabaseClient,
  items: MiraviaDiscoveredItem[],
): Promise<CatalogRow[]> {
  if (items.length === 0) return [];

  const byId = new Map<string, CatalogRow>();
  const externalIds = [
    ...new Set(
      items
        .map((item) => item.externalId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const asins = [
    ...new Set(
      externalIds.map((id) =>
        syntheticAsinForRetailer("miravia", id).toUpperCase(),
      ),
    ),
  ];

  for (let offset = 0; offset < externalIds.length; offset += CATALOG_LOOKUP_CHUNK) {
    const chunk = externalIds.slice(offset, offset + CATALOG_LOOKUP_CHUNK);
    const { data, error } = await client
      .from("products")
      .select(CATALOG_SELECT)
      .eq("retailer", "miravia")
      .in("external_id", chunk);
    if (error) {
      throw new Error(`No se pudo leer catálogo Miravia: ${error.message}`);
    }
    for (const row of (data ?? []) as CatalogRow[]) {
      byId.set(row.id, row);
    }
  }

  for (let offset = 0; offset < asins.length; offset += CATALOG_LOOKUP_CHUNK) {
    const chunk = asins.slice(offset, offset + CATALOG_LOOKUP_CHUNK);
    const { data, error } = await client
      .from("products")
      .select(CATALOG_SELECT)
      .eq("retailer", "miravia")
      .in("asin", chunk);
    if (error) {
      throw new Error(`No se pudo leer catálogo Miravia: ${error.message}`);
    }
    for (const row of (data ?? []) as CatalogRow[]) {
      byId.set(row.id, row);
    }
  }

  return [...byId.values()];
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
  updated: number;
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
    parentCategorySlug?: string | null;
    parentCategoryName?: string | null;
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
    parentCategorySlug: options.parentCategorySlug ?? null,
    parentCategoryName: options.parentCategoryName ?? null,
    retailer: "miravia",
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

  try {
    await notifyMatchingUsers(client, deal);
  } catch (error) {
    console.warn(
      "[miravia-deals] notifyMatchingUsers falló (alertas personales)",
      error instanceof Error ? error.message : error,
    );
  }

  const result = await notifyChannelDealIfEligible(client, deal);
  if (result.queued) return "queued";
  if (result.sent) return "sent";
  if (result.skipped) return "skipped";
  return "failed";
}

/**
 * Descubre ofertas flash de Miravia e inserta novedades en catálogo.
 * Preferible en cron propio (p. ej. cada 30–60 min), no en cada pasada Amazon.
 */
export async function runMiraviaDealsCheck(options?: {
  /** Máximo de productos *nuevos* a insertar. */
  limit?: number;
  /** Máximo de productos ya en catálogo a actualizar (bajadas). */
  updateLimit?: number;
  feedUrls?: string[];
  notify?: boolean;
  telegramMinScore?: number;
  onlyItems?: MiraviaDiscoveredItem[];
}): Promise<MiraviaDealsRunResult> {
  const finishedAt = new Date().toISOString();
  const appSettings = await getAppSettings();

  if (!appSettings.miraviaDealsEnabled) {
    return {
      ok: true,
      enabled: false,
      finishedAt,
      discovery: { feedsFetched: 0, candidates: 0, feedErrors: [] },
      processed: 0,
      inserted: 0,
      updated: 0,
      skippedExisting: 0,
      skippedNoDiscount: 0,
      channelNotificationsSent: 0,
      channelNotificationsSkipped: 0,
      channelNotificationsQueued: 0,
      errors: [],
    };
  }

  const client = createSupabaseServiceClient();
  await ensureCategoryKeywordRulesLoaded();
  const insertLimit =
    options?.limit && options.limit > 0
      ? options.limit
      : appSettings.miraviaFlashLimit;
  const updateLimit =
    options?.updateLimit && options.updateLimit > 0
      ? options.updateLimit
      : appSettings.miraviaFlashUpdateLimit;
  const shouldNotify = options?.notify ?? true;
  const minDiscount = appSettings.miraviaMinDiscountPercent;

  const discovery = options?.onlyItems?.length
    ? {
        items: options.onlyItems,
        feedsFetched: 0,
        feedErrors: [] as Array<{ url: string; message: string }>,
      }
    : await discoverMiraviaDeals({
        feedUrls:
          options?.feedUrls ?? (await resolveMiraviaFeedUrlsForRun()),
        maxItems: appSettings.miraviaDiscoveryMaxItems,
        minDiscountPercent: minDiscount,
        delayMs: 600,
      });

  const catalogRows = await loadMiraviaCatalogForItems(client, discovery.items);

  const catalogByExternalId = new Map(
    catalogRows
      .filter((row) => row.external_id)
      .map((row) => [row.external_id!, row] as const),
  );
  const catalogByAsin = new Map(
    catalogRows.map((row) => [row.asin.toUpperCase(), row] as const),
  );

  function resolveDealPrices(item: MiraviaDiscoveredItem): {
    price: number;
    listPrice: number;
    discount: number;
  } | null {
    if (item.priceHint == null) return null;
    const price = roundMoney(item.priceHint);
    const listPrice =
      item.listPriceHint != null && item.listPriceHint > price
        ? roundMoney(item.listPriceHint)
        : null;
    const discount = computeDiscount(price, listPrice);
    // Solo aceptar descuento real precio/lista; no inventar lista desde badge %.
    if (discount < minDiscount || listPrice == null || listPrice <= price) {
      return null;
    }
    return { price, listPrice, discount };
  }

  const newCandidates: MiraviaDiscoveredItem[] = [];
  const existingCandidates: Array<{
    item: MiraviaDiscoveredItem;
    row: CatalogRow;
  }> = [];
  let skippedExistingUnchanged = 0;

  for (const item of discovery.items) {
    const syntheticAsin = syntheticAsinForRetailer("miravia", item.externalId);
    const existing =
      catalogByExternalId.get(item.externalId) ??
      catalogByAsin.get(syntheticAsin.toUpperCase());
    if (!existing) {
      newCandidates.push(item);
      continue;
    }
    // Mantener índices sincronizados si se encontró solo por ASIN.
    if (item.externalId && !catalogByExternalId.has(item.externalId)) {
      catalogByExternalId.set(item.externalId, existing);
    }
    const prices = resolveDealPrices(item);
    if (!prices) {
      skippedExistingUnchanged += 1;
      continue;
    }
    const stored = toNumber(existing.current_price);
    // Solo actualizar/notificar cuando el feed muestra bajada real vs catálogo.
    const dropped =
      stored == null || stored - prices.price >= 0.5;
    if (!dropped) {
      skippedExistingUnchanged += 1;
      continue;
    }
    existingCandidates.push({ item, row: existing });
  }

  // Priorizar las bajadas más grandes.
  existingCandidates.sort((a, b) => {
    const pa = resolveDealPrices(a.item)?.price ?? 0;
    const pb = resolveDealPrices(b.item)?.price ?? 0;
    const sa = toNumber(a.row.current_price) ?? pa;
    const sb = toNumber(b.row.current_price) ?? pb;
    return sb - pb - (sa - pa);
  });

  const insertQueue = newCandidates.slice(0, insertLimit);
  const updateQueue = existingCandidates.slice(0, updateLimit);

  let processed = 0;
  let inserted = 0;
  let updated = 0;
  let skippedNoDiscount = 0;
  let channelNotificationsSent = 0;
  let channelNotificationsSkipped = 0;
  let channelNotificationsQueued = 0;
  const errors: Array<{ externalId: string; message: string }> = [];

  for (const item of insertQueue) {
    processed += 1;

    try {
      const prices = resolveDealPrices(item);
      if (!prices) {
        skippedNoDiscount += 1;
        continue;
      }
      let { price, listPrice, discount } = prices;

      // Verificar ficha: el feed a veces trae céntimos/badge mal parseados.
      let pageTitle: string | null = null;
      try {
        const quote = await scrapeMiraviaProductPage(item.productUrl, {
          timeoutMs: 14_000,
        });
        if (!isPlaceholderMiraviaTitle(quote.title)) pageTitle = quote.title;
        if (quote.price != null && quote.price > 0) {
          price = roundMoney(quote.price);
          if (quote.listPrice != null && quote.listPrice > price) {
            listPrice = roundMoney(quote.listPrice);
          }
          discount = computeDiscount(price, listPrice);
          if (discount < minDiscount || listPrice <= price) {
            skippedNoDiscount += 1;
            continue;
          }
        }
      } catch {
        /* mantener precios del feed */
      }

      // Sin nombre (ni en el listado ni en la ficha) no se da de alta: saldría
      // como «Producto Miravia <id>» en la web y en los canales.
      const title = item.titleHint?.trim() || pageTitle;
      if (!title) {
        errors.push({ externalId: item.externalId, message: "Sin título" });
        continue;
      }
      const productUrl = item.productUrl;
      const syntheticAsin = syntheticAsinForRetailer("miravia", item.externalId);
      const subcategorySlug = inferProductSubcategorySlug({ title });
      const categoryMeta = await resolveCategoryMetaForDeal(
        client,
        subcategorySlug,
      );

      const scoring = dealScoringService.scoreProduct({
        currentPrice: price,
        previousPrice: listPrice,
        lowestPrice: price,
        categorySlug: categoryMeta.parentSlug,
      });

      const now = new Date().toISOString();
      const slug = slugifyTitleWithId(title, item.externalId);
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
        category_id: categoryMeta.categoryId,
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

      let insertedRow: { id: string; slug: string } | null = null;
      const { data: created, error: insertError } = await client
        .from("products")
        .insert(insertRow)
        .select("id, slug")
        .single();

      if (insertError) {
        const isDuplicate =
          /duplicate key|products_slug_key|products_asin_key/i.test(
            insertError.message,
          );
        if (!isDuplicate) throw new Error(insertError.message);

        // Ya existe (catálogo incompleto, slug viejo truncado, etc.): reutilizar.
        const { data: byAsin } = await client
          .from("products")
          .select(
            "id, asin, external_id, retailer, title, slug, product_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, category_id",
          )
          .eq("asin", syntheticAsin)
          .maybeSingle();
        const { data: byExternal } = byAsin
          ? { data: null }
          : await client
              .from("products")
              .select(
                "id, asin, external_id, retailer, title, slug, product_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, category_id",
              )
              .eq("external_id", item.externalId)
              .eq("retailer", "miravia")
              .maybeSingle();
        const { data: bySlug } =
          byAsin || byExternal
            ? { data: null }
            : await client
                .from("products")
                .select(
                  "id, asin, external_id, retailer, title, slug, product_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, category_id",
                )
                .eq("slug", slug)
                .maybeSingle();

        const existingRow = byAsin ?? byExternal ?? bySlug;
        if (!existingRow) {
          throw new Error(insertError.message);
        }

        const { error: repairError } = await client
          .from("products")
          .update({
            external_id: item.externalId,
            asin: syntheticAsin,
            title,
            // Solo cambiar slug si el existente no es el nuestro o ya es el nuevo.
            ...(existingRow.slug === slug ||
            existingRow.asin === syntheticAsin ||
            existingRow.external_id === item.externalId
              ? { slug }
              : {}),
            product_url: productUrl,
            amazon_url: productUrl,
            affiliate_url: productUrl,
            current_price: price,
            previous_price: listPrice,
            discount_percentage: discount,
            lowest_price: roundMoney(
              Math.min(toNumber(existingRow.lowest_price) ?? price, price),
            ),
            highest_price: roundMoney(
              Math.max(
                toNumber(existingRow.highest_price) ?? price,
                price,
                listPrice,
              ),
            ),
            image_url: item.imageUrlHint ?? existingRow.image_url,
            category_id: categoryMeta.categoryId ?? existingRow.category_id,
            availability: ProductAvailability.IN_STOCK,
            is_active: true,
            last_checked_at: now,
            updated_at: now,
          })
          .eq("id", existingRow.id);

        if (repairError) {
          // Si el slug nuevo choca, reintentar sin cambiar slug.
          if (/products_slug_key|duplicate key/i.test(repairError.message)) {
            const { error: retryError } = await client
              .from("products")
              .update({
                external_id: item.externalId,
                asin: syntheticAsin,
                title,
                product_url: productUrl,
                amazon_url: productUrl,
                affiliate_url: productUrl,
                current_price: price,
                previous_price: listPrice,
                discount_percentage: discount,
                lowest_price: roundMoney(
                  Math.min(toNumber(existingRow.lowest_price) ?? price, price),
                ),
                highest_price: roundMoney(
                  Math.max(
                    toNumber(existingRow.highest_price) ?? price,
                    price,
                    listPrice,
                  ),
                ),
                image_url: item.imageUrlHint ?? existingRow.image_url,
                category_id: categoryMeta.categoryId ?? existingRow.category_id,
                availability: ProductAvailability.IN_STOCK,
                is_active: true,
                last_checked_at: now,
                updated_at: now,
              })
              .eq("id", existingRow.id);
            if (retryError) throw new Error(retryError.message);
          } else {
            throw new Error(repairError.message);
          }
        }

        insertedRow = {
          id: existingRow.id,
          slug: existingRow.slug === slug ? slug : existingRow.slug,
        };
        catalogByExternalId.set(item.externalId, {
          ...(existingRow as CatalogRow),
          ...insertRow,
          id: existingRow.id,
          slug: insertedRow.slug,
        });
        catalogByAsin.set(syntheticAsin.toUpperCase(), {
          ...(existingRow as CatalogRow),
          ...insertRow,
          id: existingRow.id,
          slug: insertedRow.slug,
        });
        updated += 1;
      } else {
        insertedRow = created;
        inserted += 1;
        catalogByExternalId.set(item.externalId, {
          ...(insertRow as unknown as CatalogRow),
          id: insertedRow.id,
        });
        catalogByAsin.set(syntheticAsin.toUpperCase(), {
          ...(insertRow as unknown as CatalogRow),
          id: insertedRow.id,
        });

      }

      if (shouldNotify && insertedRow) {
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
          categoryId: categoryMeta.categoryId,
          categoryName: categoryMeta.subcategoryName,
          categorySlug: categoryMeta.subcategorySlug,
          parentCategorySlug: categoryMeta.parentSlug,
          parentCategoryName: categoryMeta.parentName,
        });
        if (notifyResult === "queued") channelNotificationsQueued += 1;
        else if (notifyResult === "sent") channelNotificationsSent += 1;
        else if (notifyResult === "skipped") {
          channelNotificationsSkipped += 1;
        }
      }
    } catch (error) {
      errors.push({
        externalId: item.externalId,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  for (const { item, row } of updateQueue) {
    processed += 1;
    try {
      const prices = resolveDealPrices(item);
      if (!prices) {
        skippedNoDiscount += 1;
        continue;
      }
      const { price, listPrice, discount } = prices;
      const storedCurrent = toNumber(row.current_price);
      const previousForNotify =
        storedCurrent != null && storedCurrent > price
          ? storedCurrent
          : listPrice;
      const now = new Date().toISOString();
      const lowest =
        toNumber(row.lowest_price) == null
          ? price
          : roundMoney(Math.min(toNumber(row.lowest_price)!, price));
      const highest = roundMoney(
        Math.max(
          toNumber(row.highest_price) ?? price,
          price,
          listPrice,
          storedCurrent ?? price,
        ),
      );

      const scoring = dealScoringService.scoreProduct({
        currentPrice: price,
        previousPrice: previousForNotify,
        lowestPrice: lowest,
        categorySlug: undefined,
      });

      const { error: updateError } = await client
        .from("products")
        .update({
          current_price: price,
          previous_price: previousForNotify,
          discount_percentage: discount,
          lowest_price: lowest,
          highest_price: highest,
          availability: ProductAvailability.IN_STOCK,
          last_checked_at: now,
          updated_at: now,
          ...(item.imageUrlHint ? { image_url: item.imageUrlHint } : {}),
          ...(item.titleHint?.trim() ? { title: item.titleHint.trim() } : {}),
          product_url: item.productUrl,
          amazon_url: item.productUrl,
          affiliate_url: item.productUrl,
        })
        .eq("id", row.id);

      if (updateError) throw new Error(updateError.message);

      updated += 1;

      if (shouldNotify) {
        const dropPct =
          previousForNotify > price
            ? ((previousForNotify - price) / previousForNotify) * 100
            : 0;
        const subcategorySlug = inferProductSubcategorySlug({
          title: item.titleHint ?? row.title,
        });
        const categoryMeta = await resolveCategoryMetaForDeal(
          client,
          subcategorySlug,
        );
        const notifyResult = await maybeNotifyMiraviaDeal(client, {
          productId: row.id,
          syntheticAsin: row.asin,
          title: item.titleHint?.trim() || row.title,
          slug: row.slug,
          currentPrice: price,
          previousPrice: previousForNotify,
          discountPercentage: Math.max(discount, roundMoney(dropPct)),
          score: scoring.score,
          dealLevel: scoring.level,
          dealLabel: scoring.label,
          productUrl: item.productUrl,
          affiliateUrl: resolveProductBuyUrl({
            retailer: "miravia",
            product_url: item.productUrl,
            amazon_url: item.productUrl,
            affiliate_url: item.productUrl,
            asin: row.asin,
          }),
          brand: row.brand ?? "Miravia",
          imageUrl: item.imageUrlHint ?? row.image_url,
          categoryId: categoryMeta.categoryId ?? row.category_id,
          categoryName: categoryMeta.subcategoryName,
          categorySlug: categoryMeta.subcategorySlug,
          parentCategorySlug: categoryMeta.parentSlug,
          parentCategoryName: categoryMeta.parentName,
        });
        if (notifyResult === "queued") channelNotificationsQueued += 1;
        else if (notifyResult === "sent") channelNotificationsSent += 1;
        else if (notifyResult === "skipped") {
          channelNotificationsSkipped += 1;
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
    updated,
    skippedExisting: skippedExistingUnchanged,
    skippedNoDiscount,
    channelNotificationsSent,
    channelNotificationsSkipped,
    channelNotificationsQueued,
    errors,
  };
}
