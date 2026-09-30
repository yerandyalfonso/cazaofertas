import { inferCarrefourCategorySlug } from "@/lib/carrefour-category";
import { resolveCategoryMetaForDeal } from "@/lib/categories";
import { roundMoney, toNumber } from "@/lib/money";
import { inferProductSubcategorySlug } from "@/lib/product-category-inference";
import {
  resolveProductBuyUrl,
  syntheticAsinForRetailer,
} from "@/lib/retailers";
import {
  createSupabaseServiceClient,
  type TypedSupabaseClient,
} from "@/lib/supabase";
import {
  discoverPcComponentesDeals,
  type PcComponentesListingItem,
} from "@/providers/browser/pccomponentesDiscovery";
import { resolveTelegramMinDiscountPercent } from "@/services/appSettings";
import { getRetailerDealSettings } from "@/services/retailerDealSettings";
import type { DealCandidate } from "@/services/alertMatching";
import { ensureCategoryKeywordRulesLoaded } from "@/services/categoryKeywords";
import { dealScoringService } from "@/services/deal-scoring";
import { notifyMatchingUsers } from "@/services/notifications";
import { notifyChannelDealIfEligible } from "@/services/telegram";
import { DealLevel, ProductAvailability } from "@/types";

/*
 * Descubrimiento de rebajas PcComponentes, calcado de `mediamarktDeals`: cada
 * tarjeta del listado ya trae precio, PVPR tachado, imagen, marca, categoría
 * y vendedor, así que no se abre la ficha de cada producto. Cloudflare exige
 * Google Chrome con ventana e IP residencial: job solo del Mac.
 *
 * El tachado es el PVPR (precio recomendado del fabricante), no un precio
 * anterior de la tienda: por eso el aviso dice «rebaja sobre PVPR».
 *
 * Configuración: admin → Ajustes (`retailerDealSettings`); si no se ha
 * guardado nada allí, estas variables de entorno:
 *   PCCOMPONENTES_DEALS_ENABLED=false        desactiva el job
 *   PCCOMPONENTES_DEALS_MIN_DISCOUNT=15      % mínimo para guardar
 *   PCCOMPONENTES_DEALS_PAGES_PER_FEED=2     páginas de ~40 por listado
 *   PCCOMPONENTES_DEALS_INCLUDE_MARKETPLACE=1  incluir vendedores externos
 *   PCCOMPONENTES_FEED_URLS=…                listados (coma)
 */

function categoryNames(item: PcComponentesListingItem): string[] {
  return item.categoryName ? [item.categoryName] : [];
}

function slugifyTitleWithId(title: string, externalId: string): string {
  const base = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const id = externalId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${base || "producto"}-pcc-${id}`;
}

const CATALOG_SELECT =
  "id, asin, external_id, retailer, title, slug, product_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, category_id";
const CATALOG_LOOKUP_CHUNK = 100;

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

/** Solo filas de los productos descubiertos (por asin sintético `PCC-…`). */
async function loadPcComponentesCatalogForItems(
  client: TypedSupabaseClient,
  items: PcComponentesListingItem[],
): Promise<Map<string, CatalogRow>> {
  const byAsin = new Map<string, CatalogRow>();
  const asins = [
    ...new Set(
      items.map((item) =>
        syntheticAsinForRetailer("pccomponentes", item.externalId).toUpperCase(),
      ),
    ),
  ];

  for (let offset = 0; offset < asins.length; offset += CATALOG_LOOKUP_CHUNK) {
    const chunk = asins.slice(offset, offset + CATALOG_LOOKUP_CHUNK);
    const { data, error } = await client
      .from("products")
      .select(CATALOG_SELECT)
      .in("asin", chunk);
    if (error) {
      throw new Error(`No se pudo leer catálogo PcComponentes: ${error.message}`);
    }
    for (const row of (data ?? []) as CatalogRow[]) {
      byAsin.set(row.asin.toUpperCase(), row);
    }
  }

  return byAsin;
}

async function resolvePcComponentesCategoryMeta(
  client: TypedSupabaseClient,
  item: PcComponentesListingItem,
) {
  const subcategorySlug = inferProductSubcategorySlug({
    title: item.title,
    brand: item.brand,
    breadcrumbs: categoryNames(item),
  });
  const meta = await resolveCategoryMetaForDeal(client, subcategorySlug);
  if (meta.parentSlug !== "otros") return meta;

  // Sin match por palabras clave: probar con la ruta de categorías de la tienda.
  const parentSlug = inferCarrefourCategorySlug({
    breadcrumbs: categoryNames(item),
    feedUrl: item.sourceUrl,
    productUrl: item.productUrl,
    title: item.title,
  });
  return parentSlug ? resolveCategoryMetaForDeal(client, parentSlug) : meta;
}

async function maybeNotifyPcComponentesDeal(
  client: TypedSupabaseClient,
  deal: DealCandidate,
): Promise<"sent" | "skipped" | "failed" | "queued"> {
  try {
    await notifyMatchingUsers(client, deal);
  } catch (error) {
    console.warn(
      "[pccomponentes-deals] notifyMatchingUsers falló (alertas personales)",
      error instanceof Error ? error.message : error,
    );
  }

  const result = await notifyChannelDealIfEligible(client, deal);
  if (result.queued) return "queued";
  if (result.sent) return "sent";
  if (result.skipped) return "skipped";
  return "failed";
}

export interface PcComponentesDealsRunResult {
  ok: true;
  enabled: boolean;
  dryRun: boolean;
  finishedAt: string;
  discovery: {
    pagesFetched: number;
    candidates: number;
    withDiscount: number;
    feedErrors: Array<{ url: string; message: string }>;
  };
  processed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  skippedNoDiscount: number;
  skippedMarketplace: number;
  channelNotificationsSent: number;
  channelNotificationsSkipped: number;
  channelNotificationsQueued: number;
  /** Solo en dryRun: lo que se habría insertado/actualizado. */
  preview?: Array<{
    action: "insert" | "update";
    externalId: string;
    title: string;
    price: number;
    listPrice: number | null;
    discount: number;
    storedPrice: number | null;
    category: string;
    dealLevel: DealLevel;
  }>;
  errors: Array<{ externalId: string; message: string }>;
}

export async function runPcComponentesDealsCheck(options?: {
  /** Máximo de productos a insertar/actualizar por ejecución. */
  limit?: number;
  notify?: boolean;
  /** No escribe en Supabase ni avisa: solo devuelve `preview`. */
  dryRun?: boolean;
  pagesPerFeed?: number;
  feedUrls?: string[];
}): Promise<PcComponentesDealsRunResult> {
  const finishedAt = new Date().toISOString();
  const dryRun = options?.dryRun ?? false;
  const empty: PcComponentesDealsRunResult = {
    ok: true,
    enabled: false,
    dryRun,
    finishedAt,
    discovery: { pagesFetched: 0, candidates: 0, withDiscount: 0, feedErrors: [] },
    processed: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skippedNoDiscount: 0,
    skippedMarketplace: 0,
    channelNotificationsSent: 0,
    channelNotificationsSkipped: 0,
    channelNotificationsQueued: 0,
    errors: [],
  };

  const settings = await getRetailerDealSettings("pccomponentes");
  if (!settings.enabled) {
    return empty;
  }

  const client = createSupabaseServiceClient();
  const limit = options?.limit && options.limit > 0 ? options.limit : 20;
  const shouldNotify = !dryRun && (options?.notify ?? true);
  const minDiscount = settings.minDiscountPercent;
  // Vendedores externos: precios y tachados menos fiables; fuera por defecto.
  const includeMarketplace = settings.includeMarketplace;
  const channelMinDiscount = await resolveTelegramMinDiscountPercent();
  await ensureCategoryKeywordRulesLoaded();

  const discovery = await discoverPcComponentesDeals({
    feedUrls: options?.feedUrls ?? (settings.feedUrls.length ? settings.feedUrls : undefined),
    pagesPerFeed: options?.pagesPerFeed ?? settings.pagesPerFeed,
  });

  const ownItems = includeMarketplace
    ? discovery.items
    : discovery.items.filter((item) => !item.marketplace);
  const catalogByAsin = await loadPcComponentesCatalogForItems(client, ownItems);

  // Primero los que ya tenemos y han bajado de precio, luego los nuevos; el
  // resto solo cuenta como sin cambio.
  const withDiscount = ownItems.filter(
    (item) => item.listPrice != null && item.discountPercentage >= minDiscount,
  );
  const newItems: PcComponentesListingItem[] = [];
  const priceDrops: PcComponentesListingItem[] = [];
  let unchanged = 0;
  for (const item of withDiscount) {
    const asin = syntheticAsinForRetailer("pccomponentes", item.externalId).toUpperCase();
    const existing = catalogByAsin.get(asin);
    if (!existing) {
      newItems.push(item);
      continue;
    }
    const storedPrice = toNumber(existing.current_price);
    if (storedPrice != null && item.price < storedPrice - 0.009) {
      priceDrops.push(item);
    } else {
      unchanged += 1;
    }
  }
  // Mayor descuento primero para que el límite se quede con lo mejor.
  const byDiscount = (a: PcComponentesListingItem, b: PcComponentesListingItem) =>
    b.discountPercentage - a.discountPercentage;
  const queue = [...priceDrops.sort(byDiscount), ...newItems.sort(byDiscount)].slice(
    0,
    limit,
  );

  const result: PcComponentesDealsRunResult = {
    ...empty,
    enabled: true,
    discovery: {
      pagesFetched: discovery.pagesFetched,
      candidates: discovery.items.length,
      withDiscount: withDiscount.length,
      feedErrors: discovery.feedErrors,
    },
    unchanged,
    skippedNoDiscount: ownItems.length - withDiscount.length,
    skippedMarketplace: discovery.items.length - ownItems.length,
    preview: dryRun ? [] : undefined,
  };

  for (const item of queue) {
    result.processed += 1;

    try {
      const price = roundMoney(item.price);
      const reference = item.listPrice ?? price;
      const discount = item.discountPercentage;
      const syntheticAsin = syntheticAsinForRetailer("pccomponentes", item.externalId);
      const existing = catalogByAsin.get(syntheticAsin.toUpperCase());
      const categoryMeta = await resolvePcComponentesCategoryMeta(client, item);
      const scoring = dealScoringService.scoreProduct({
        currentPrice: price,
        previousPrice: reference > price ? reference : null,
        // Producto nuevo: sin historial no hay mínimo con el que comparar (con
        // el precio actual como mínimo, todo lo nuevo salía «Chollazo»).
        lowestPrice: existing ? toNumber(existing.lowest_price) : null,
        categorySlug: categoryMeta.parentSlug,
      });
      const now = new Date().toISOString();

      if (dryRun) {
        result.preview!.push({
          action: existing ? "update" : "insert",
          externalId: item.externalId,
          title: item.title,
          price,
          listPrice: item.listPrice,
          discount,
          storedPrice: existing ? toNumber(existing.current_price) : null,
          category: `${categoryMeta.parentSlug}/${categoryMeta.subcategorySlug}`,
          dealLevel: scoring.level,
        });
        continue;
      }

      let productId: string;
      let slug: string;
      let buyUrl: string;

      if (!existing) {
        const insertRow = {
          retailer: "pccomponentes" as const,
          external_id: item.externalId,
          product_url: item.productUrl,
          asin: syntheticAsin,
          title: item.title,
          slug: slugifyTitleWithId(item.title, item.externalId),
          amazon_url: item.productUrl,
          affiliate_url: item.productUrl,
          brand: item.brand,
          image_url: item.imageUrl,
          category_id: categoryMeta.categoryId,
          current_price: price,
          previous_price: reference > price ? reference : null,
          previous_price_observed_at: reference > price ? now : null,
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
          if (/duplicate key|products_slug_key|products_asin_key/i.test(insertError.message)) {
            result.unchanged += 1;
            continue;
          }
          throw new Error(insertError.message);
        }

        result.inserted += 1;
        productId = insertedRow.id;
        slug = insertedRow.slug;
        buyUrl = resolveProductBuyUrl(insertRow);
      } else {
        const previousLowest = toNumber(existing.lowest_price);
        const previousHighest = toNumber(existing.highest_price);
        const patch = {
          title: item.title,
          product_url: item.productUrl,
          amazon_url: item.productUrl,
          affiliate_url: existing.affiliate_url ?? item.productUrl,
          brand: item.brand ?? existing.brand,
          image_url: item.imageUrl ?? existing.image_url,
          category_id: existing.category_id ?? categoryMeta.categoryId,
          current_price: price,
          previous_price:
            reference > price ? reference : toNumber(existing.previous_price),
          ...(reference > price ? { previous_price_observed_at: now } : {}),
          lowest_price:
            previousLowest == null ? price : roundMoney(Math.min(previousLowest, price)),
          highest_price: roundMoney(Math.max(previousHighest ?? price, price, reference)),
          discount_percentage: discount,
          availability: ProductAvailability.IN_STOCK,
          is_active: true,
          last_checked_at: now,
          updated_at: now,
        };

        const { error: updateError } = await client
          .from("products")
          .update(patch)
          .eq("id", existing.id);
        if (updateError) throw new Error(updateError.message);

        result.updated += 1;
        productId = existing.id;
        slug = existing.slug;
        buyUrl = resolveProductBuyUrl({ ...existing, ...patch });
      }

      if (!shouldNotify) continue;
      const qualifiesChannel = discount >= channelMinDiscount;
      if (scoring.level === DealLevel.NORMAL && !qualifiesChannel) continue;

      const notifyResult = await maybeNotifyPcComponentesDeal(client, {
        productId,
        asin: syntheticAsin,
        title: item.title,
        brand: item.brand,
        categoryId: categoryMeta.categoryId,
        categoryName: categoryMeta.subcategoryName,
        categorySlug: categoryMeta.subcategorySlug,
        parentCategorySlug: categoryMeta.parentSlug,
        parentCategoryName: categoryMeta.parentName,
        retailer: "pccomponentes",
        currentPrice: price,
        previousPrice: reference,
        discountPercentage: discount,
        dealLevel: scoring.level,
        score: scoring.score,
        dealLabel: scoring.label,
        productSlug: slug,
        imageUrl: item.imageUrl,
        summary: "PcComponentes · rebaja sobre PVPR",
        affiliateUrl: buyUrl,
        nearHistoricalLow: scoring.level === DealLevel.HISTORICAL_LOW,
      });
      if (notifyResult === "queued") result.channelNotificationsQueued += 1;
      else if (notifyResult === "sent") result.channelNotificationsSent += 1;
      else if (notifyResult === "skipped") result.channelNotificationsSkipped += 1;
    } catch (error) {
      result.errors.push({
        externalId: item.externalId,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  return result;
}
