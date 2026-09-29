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
  getPublicStorageUrl,
  type TypedSupabaseClient,
} from "@/lib/supabase";
import {
  discoverCarrefourDealsWithBrowser,
  downloadCarrefourImagesWithBrowser,
  isBlockedCarrefourImageUrl,
  type CarrefourListingItem,
} from "@/providers/retail/carrefour/carrefourBrowserDiscovery";
import { resolveTelegramMinDiscountPercent } from "@/services/appSettings";
import type { DealCandidate } from "@/services/alertMatching";
import { ensureCategoryKeywordRulesLoaded } from "@/services/categoryKeywords";
import { dealScoringService } from "@/services/deal-scoring";
import { notifyMatchingUsers } from "@/services/notifications";
import { notifyChannelDealIfEligible } from "@/services/telegram";
import { DealLevel, ProductAvailability } from "@/types";

/*
 * Descubrimiento de rebajas Carrefour (no alimentación), calcado de
 * `kiabiDeals`: el listado ya trae precio, precio tachado, imagen, marca y
 * EAN, así que no se abre la ficha de cada producto.
 *
 * Configuración por env (no hay columnas en app_settings para Carrefour):
 *   CARREFOUR_DEALS_ENABLED=false        desactiva el job
 *   CARREFOUR_DEALS_MIN_DISCOUNT=15      % mínimo para guardar
 *   CARREFOUR_DEALS_PAGES_PER_FEED=5     páginas de 24 por listado
 *   CARREFOUR_BROWSER_FEED_URLS=…        listados (coma)
 */

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
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
  return `${base || "producto"}-${id}`;
}

const CATALOG_SELECT =
  "id, asin, external_id, retailer, title, slug, product_url, amazon_url, affiliate_url, current_price, previous_price, lowest_price, highest_price, brand, image_url, description, category_id";
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
  description: string | null;
  category_id: string | null;
}

/** Solo filas de los productos descubiertos (por asin sintético `CF-…`). */
async function loadCarrefourCatalogForItems(
  client: TypedSupabaseClient,
  items: CarrefourListingItem[],
): Promise<Map<string, CatalogRow>> {
  const byAsin = new Map<string, CatalogRow>();
  const asins = [
    ...new Set(
      items.map((item) =>
        syntheticAsinForRetailer("carrefour", item.externalId).toUpperCase(),
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
      throw new Error(`No se pudo leer catálogo Carrefour: ${error.message}`);
    }
    for (const row of (data ?? []) as CatalogRow[]) {
      byAsin.set(row.asin.toUpperCase(), row);
    }
  }

  return byAsin;
}

// Bucket público ya existente (blog/Instagram); las fotos van en `carrefour/`.
const IMAGE_BUCKET = "article-images";

function imageExtension(contentType: string): string {
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  return "jpg";
}

/**
 * Sube a Supabase Storage las fotos de `static.carrefour.es` (403 para
 * Telegram y vistas previas) y devuelve url original → url pública propia.
 */
async function mirrorCarrefourImages(
  client: TypedSupabaseClient,
  images: Array<{ externalId: string; imageUrl?: string | null }>,
): Promise<Map<string, string>> {
  const mirrored = new Map<string, string>();
  const pending = images.filter((image) => isBlockedCarrefourImageUrl(image.imageUrl));
  if (pending.length === 0) return mirrored;

  const downloads = await downloadCarrefourImagesWithBrowser(
    pending.map((image) => image.imageUrl!),
  );
  for (const image of pending) {
    const download = downloads.get(image.imageUrl!);
    if (!download) continue;
    const id = image.externalId.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const path = `carrefour/${id}.${imageExtension(download.contentType)}`;
    const { error } = await client.storage.from(IMAGE_BUCKET).upload(path, download.body, {
      contentType: download.contentType,
      upsert: true,
    });
    if (error) {
      console.warn(`[carrefour-deals] no se pudo subir ${path}: ${error.message}`);
      continue;
    }
    mirrored.set(image.imageUrl!, getPublicStorageUrl(IMAGE_BUCKET, path));
  }
  return mirrored;
}

/** Espeja las fotos de productos Carrefour ya guardados con `static.carrefour.es`. */
export async function backfillCarrefourProductImages(): Promise<{
  pending: number;
  mirrored: number;
}> {
  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("products")
    .select("id, external_id, asin, image_url")
    .eq("retailer", "carrefour")
    .like("image_url", "https://static.carrefour.es/%");
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const mirrored = await mirrorCarrefourImages(
    client,
    rows.map((row) => ({
      externalId: row.external_id ?? row.asin,
      imageUrl: row.image_url,
    })),
  );
  let updated = 0;
  for (const row of rows) {
    const url = row.image_url ? mirrored.get(row.image_url) : undefined;
    if (!url) continue;
    const { error: updateError } = await client
      .from("products")
      .update({ image_url: url })
      .eq("id", row.id);
    if (!updateError) updated += 1;
  }
  return { pending: rows.length, mirrored: updated };
}

async function resolveCarrefourCategoryMeta(
  client: TypedSupabaseClient,
  item: CarrefourListingItem,
) {
  const breadcrumbs = item.categoryName ? [item.categoryName] : [];
  const subcategorySlug = inferProductSubcategorySlug({
    title: item.title,
    brand: item.brand,
    breadcrumbs,
  });
  const meta = await resolveCategoryMetaForDeal(client, subcategorySlug);
  if (meta.parentSlug !== "otros") return meta;

  // Sin match por palabras clave: probar con la categoría de Carrefour.
  const parentSlug = inferCarrefourCategorySlug({
    breadcrumbs,
    productUrl: item.productUrl,
    title: item.title,
  });
  return parentSlug ? resolveCategoryMetaForDeal(client, parentSlug) : meta;
}

async function maybeNotifyCarrefourDeal(
  client: TypedSupabaseClient,
  deal: DealCandidate,
): Promise<"sent" | "skipped" | "failed" | "queued"> {
  try {
    await notifyMatchingUsers(client, deal);
  } catch (error) {
    console.warn(
      "[carrefour-deals] notifyMatchingUsers falló (alertas personales)",
      error instanceof Error ? error.message : error,
    );
  }

  const result = await notifyChannelDealIfEligible(client, deal);
  if (result.queued) return "queued";
  if (result.sent) return "sent";
  if (result.skipped) return "skipped";
  return "failed";
}

export interface CarrefourDealsRunResult {
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
  channelNotificationsSent: number;
  channelNotificationsSkipped: number;
  channelNotificationsQueued: number;
  /** Solo en dryRun: lo que se habría insertado/actualizado. */
  preview?: Array<{
    action: "insert" | "update" | "unchanged";
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

export async function runCarrefourDealsCheck(options?: {
  /** Máximo de productos a insertar/actualizar por ejecución. */
  limit?: number;
  notify?: boolean;
  /** No escribe en Supabase ni avisa: solo devuelve `preview`. */
  dryRun?: boolean;
  pagesPerFeed?: number;
  feedUrls?: string[];
  /** Omite el navegador y procesa estos productos (pruebas). */
  onlyItems?: CarrefourListingItem[];
}): Promise<CarrefourDealsRunResult> {
  const finishedAt = new Date().toISOString();
  const dryRun = options?.dryRun ?? false;
  const empty: CarrefourDealsRunResult = {
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
    channelNotificationsSent: 0,
    channelNotificationsSkipped: 0,
    channelNotificationsQueued: 0,
    errors: [],
  };

  if (process.env.CARREFOUR_DEALS_ENABLED?.trim().toLowerCase() === "false") {
    return empty;
  }

  const client = createSupabaseServiceClient();
  const limit = options?.limit && options.limit > 0 ? options.limit : 20;
  const shouldNotify = !dryRun && (options?.notify ?? true);
  const minDiscount = envNumber("CARREFOUR_DEALS_MIN_DISCOUNT", 15);
  const channelMinDiscount = await resolveTelegramMinDiscountPercent();
  await ensureCategoryKeywordRulesLoaded();

  const discovery = options?.onlyItems?.length
    ? { items: options.onlyItems, pagesFetched: 0, feedErrors: [] }
    : await discoverCarrefourDealsWithBrowser({
        feedUrls: options?.feedUrls,
        pagesPerFeed:
          options?.pagesPerFeed ?? envNumber("CARREFOUR_DEALS_PAGES_PER_FEED", 5),
      });

  const catalogByAsin = await loadCarrefourCatalogForItems(client, discovery.items);

  // Igual que Kiabi en modo novedades: primero productos nuevos, luego los
  // que ya tenemos y han bajado de precio; el resto solo cuenta como sin cambio.
  const withDiscount = discovery.items.filter(
    (item) => item.listPrice != null && item.discountPercentage >= minDiscount,
  );
  const newItems: CarrefourListingItem[] = [];
  const priceDrops: CarrefourListingItem[] = [];
  let unchanged = 0;
  for (const item of withDiscount) {
    const asin = syntheticAsinForRetailer("carrefour", item.externalId).toUpperCase();
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
  const byDiscount = (a: CarrefourListingItem, b: CarrefourListingItem) =>
    b.discountPercentage - a.discountPercentage;
  const queue = [...priceDrops.sort(byDiscount), ...newItems.sort(byDiscount)].slice(
    0,
    limit,
  );

  const result: CarrefourDealsRunResult = {
    ...empty,
    enabled: true,
    discovery: {
      pagesFetched: discovery.pagesFetched,
      candidates: discovery.items.length,
      withDiscount: withDiscount.length,
      feedErrors: discovery.feedErrors,
    },
    unchanged,
    skippedNoDiscount: discovery.items.length - withDiscount.length,
    preview: dryRun ? [] : undefined,
  };

  if (!dryRun) {
    const mirrored = await mirrorCarrefourImages(client, queue);
    for (const item of queue) {
      if (item.imageUrl) item.imageUrl = mirrored.get(item.imageUrl) ?? item.imageUrl;
    }
  }

  for (const item of queue) {
    result.processed += 1;

    try {
      const price = roundMoney(item.price);
      const reference = item.listPrice ?? price;
      const discount = item.discountPercentage;
      const syntheticAsin = syntheticAsinForRetailer("carrefour", item.externalId);
      const existing = catalogByAsin.get(syntheticAsin.toUpperCase());
      const categoryMeta = await resolveCarrefourCategoryMeta(client, item);
      const scoring = dealScoringService.scoreProduct({
        currentPrice: price,
        previousPrice: reference > price ? reference : null,
        lowestPrice: existing ? toNumber(existing.lowest_price) : price,
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
          retailer: "carrefour" as const,
          external_id: item.externalId,
          product_url: item.productUrl,
          asin: syntheticAsin,
          title: item.title,
          slug: slugifyTitleWithId(item.title, item.externalId),
          amazon_url: item.productUrl,
          affiliate_url: item.productUrl,
          brand: item.brand ?? null,
          image_url: item.imageUrl ?? null,
          category_id: categoryMeta.categoryId,
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

      const notifyResult = await maybeNotifyCarrefourDeal(client, {
        productId,
        asin: syntheticAsin,
        title: item.title,
        brand: item.brand ?? null,
        categoryId: categoryMeta.categoryId,
        categoryName: categoryMeta.subcategoryName,
        categorySlug: categoryMeta.subcategorySlug,
        parentCategorySlug: categoryMeta.parentSlug,
        parentCategoryName: categoryMeta.parentName,
        retailer: "carrefour",
        currentPrice: price,
        previousPrice: reference,
        discountPercentage: discount,
        dealLevel: scoring.level,
        score: scoring.score,
        dealLabel: scoring.label,
        productSlug: slug,
        imageUrl: item.imageUrl ?? null,
        summary: "Carrefour · rebaja verificada",
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
