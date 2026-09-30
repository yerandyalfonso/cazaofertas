import { roundMoney } from "@/lib/money";
import {
  categoryNamesFromCore,
  listApolloProductIds,
  pricesFromFeature,
  readApolloEntity,
  type ApolloCoreFeature,
  type ApolloMediaAssets,
  type ApolloOnlineStatus,
  type ApolloPriceFeature,
} from "@/providers/retail/mediamarkt/mediamarktApollo";
import { fetchMediaMarktHtml } from "@/providers/retail/mediamarkt/mediamarktProductPage";
import type { MediaMarktListingItem } from "@/providers/retail/mediamarkt/types";

const MEDIAMARKT_ORIGIN = "https://www.mediamarkt.es";

/**
 * Listados por defecto (12 productos por página, `?page=N`). La página de
 * «campañas y ofertas» no sirve: es una landing sin rejilla de productos.
 */
export const DEFAULT_MEDIAMARKT_FEED_URLS = [
  "https://www.mediamarkt.es/es/category/port%C3%A1tiles-153.html",
  "https://www.mediamarkt.es/es/category/smartphones-263.html",
  "https://www.mediamarkt.es/es/category/televisores-399.html",
  "https://www.mediamarkt.es/es/category/auriculares-498.html",
  "https://www.mediamarkt.es/es/category/aspiradores-y-robots-aspirador-102642.html",
  "https://www.mediamarkt.es/es/category/peque%C3%B1os-electrodom%C3%A9sticos-6201.html",
  "https://www.mediamarkt.es/es/category/accesorios-gaming-1251.html",
  "https://www.mediamarkt.es/es/category/altavoces-inal%C3%A1mbricos-462.html",
];

/** Productos de un listado, con precio y tachado ya leídos del estado Apollo. */
export function parseMediaMarktListingHtml(
  html: string,
  sourceUrl: string,
): MediaMarktListingItem[] {
  const items: MediaMarktListingItem[] = [];
  for (const externalId of listApolloProductIds(html)) {
    const apolloId = `Media:es:${externalId}`;
    const core = readApolloEntity<ApolloCoreFeature>(html, "CofrCoreFeature", apolloId);
    const priceFeature = readApolloEntity<ApolloPriceFeature>(
      html,
      "CofrPriceFeature",
      apolloId,
    );
    const { price, listPrice } = pricesFromFeature(priceFeature);
    if (!core?.productName || !core.urlRelative || price == null) continue;

    const status = readApolloEntity<ApolloOnlineStatus>(
      html,
      "CofrOnlineStatusFeature",
      apolloId,
    );
    if (status && !status.isAvailableAndBuyable) continue;

    const media = readApolloEntity<ApolloMediaAssets>(
      html,
      "CofrMediaAssetsFeature",
      apolloId,
    );
    const productUrl = new URL(core.urlRelative, MEDIAMARKT_ORIGIN);
    productUrl.search = "";

    items.push({
      externalId,
      productUrl: productUrl.toString(),
      title: core.productName.trim(),
      brand: core.manufacturerName?.trim() || null,
      // Sin sufijo es el PNG original (~1 MB); este es el tamaño de la ficha.
      imageUrl: media?.productMainImage?.link
        ? `${media.productMainImage.link}/fee_786_587_png`
        : null,
      gtin: core.ean ?? null,
      price,
      listPrice,
      discountPercentage:
        listPrice != null ? roundMoney(((listPrice - price) / listPrice) * 100) : 0,
      categoryNames: categoryNamesFromCore(html, core),
      marketplace: Boolean(core.isProductOfTypeMarketplace),
      sourceUrl,
    });
  }
  return items;
}

function pageUrl(feedUrl: string, page: number): string {
  if (page <= 1) return feedUrl;
  const url = new URL(feedUrl);
  url.searchParams.set("page", String(page));
  return url.toString();
}

export async function discoverMediaMarktDeals(options?: {
  feedUrls?: string[];
  pagesPerFeed?: number;
  delayMs?: number;
  timeoutMs?: number;
}): Promise<{
  items: MediaMarktListingItem[];
  pagesFetched: number;
  feedErrors: Array<{ url: string; message: string }>;
}> {
  const feedUrls = options?.feedUrls?.length
    ? options.feedUrls
    : (process.env.MEDIAMARKT_FEED_URLS?.split(",").map((url) => url.trim()).filter(Boolean) ??
      []);
  const feeds = feedUrls.length ? feedUrls : DEFAULT_MEDIAMARKT_FEED_URLS;
  const pagesPerFeed = Math.max(1, options?.pagesPerFeed ?? 3);
  const delayMs = options?.delayMs ?? 1_500;

  const byId = new Map<string, MediaMarktListingItem>();
  const feedErrors: Array<{ url: string; message: string }> = [];
  let pagesFetched = 0;

  for (const feed of feeds) {
    for (let page = 1; page <= pagesPerFeed; page += 1) {
      const url = pageUrl(feed, page);
      try {
        const { html } = await fetchMediaMarktHtml(url, { timeoutMs: options?.timeoutMs });
        pagesFetched += 1;
        const items = parseMediaMarktListingHtml(html, url);
        for (const item of items) {
          if (!byId.has(item.externalId)) byId.set(item.externalId, item);
        }
        if (items.length === 0) break;
      } catch (error) {
        feedErrors.push({
          url,
          message: error instanceof Error ? error.message : String(error),
        });
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { items: [...byId.values()], pagesFetched, feedErrors };
}
