import * as cheerio from "cheerio";
import {
  DEFAULT_CARREFOUR_DEAL_FEED_URLS,
  isCarrefourFoodContext,
} from "@/lib/carrefour-category";
import { roundMoney } from "@/lib/money";
import { parseAmazonPriceText } from "@/providers/price";
import {
  extractCarrefourSku,
  fetchCarrefourHtml,
  normalizeCarrefourProductUrl,
} from "@/providers/retail/carrefour/carrefourHttp";
import type { CarrefourDiscoveredItem } from "@/providers/retail/carrefour/types";

export { DEFAULT_CARREFOUR_DEAL_FEED_URLS };

function parseEuroPrices(text: string): number[] {
  const values: number[] = [];
  const matches = text.match(/(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*€/g) ?? [];
  for (const token of matches) {
    const value = parseAmazonPriceText(token);
    if (value != null) values.push(roundMoney(value));
  }
  return values;
}

function upsertItem(
  map: Map<string, CarrefourDiscoveredItem>,
  item: CarrefourDiscoveredItem,
): void {
  const key = item.externalId.toUpperCase();
  const existing = map.get(key);
  if (!existing) {
    map.set(key, item);
    return;
  }

  map.set(key, {
    ...existing,
    titleHint: existing.titleHint ?? item.titleHint,
    priceHint: existing.priceHint ?? item.priceHint,
    listPriceHint: existing.listPriceHint ?? item.listPriceHint,
    imageUrlHint: existing.imageUrlHint ?? item.imageUrlHint,
  });
}

export function parseCarrefourListingHtml(
  html: string,
  sourceUrl: string,
): CarrefourDiscoveredItem[] {
  if (isCarrefourFoodContext({ feedUrl: sourceUrl })) {
    return [];
  }

  const $ = cheerio.load(html);
  const map = new Map<string, CarrefourDiscoveredItem>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href || !/\/p(?:\?|$)/i.test(href) && !/skuId=/i.test(href)) return;

    let absolute: string;
    try {
      absolute = normalizeCarrefourProductUrl(
        new URL(href, "https://www.carrefour.es").toString(),
      );
    } catch {
      return;
    }

    const externalId = extractCarrefourSku(absolute);
    if (!externalId) return;

    if (isCarrefourFoodContext({ productUrl: absolute })) return;

    const card = $(el).closest("article, li, div");
    const cardText = card.text().replace(/\s+/g, " ");
    const prices = parseEuroPrices(cardText);
    const titleHint =
      $(el).attr("title")?.trim() ||
      $(el).text().replace(/\s+/g, " ").trim() ||
      card.find("h2, h3, [class*='title']").first().text().trim() ||
      undefined;

    const imageUrlHint =
      card.find("img").first().attr("src")?.trim() ||
      card.find("img").first().attr("data-src")?.trim() ||
      undefined;

    const priceHint = prices[0];
    const listPriceHint =
      prices.length > 1 && prices[prices.length - 1] > (priceHint ?? 0)
        ? prices[prices.length - 1]
        : undefined;

    upsertItem(map, {
      externalId,
      productUrl: absolute,
      sourceUrl,
      titleHint: titleHint && titleHint.length > 3 ? titleHint.slice(0, 180) : undefined,
      priceHint,
      listPriceHint,
      imageUrlHint,
    });
  });

  return [...map.values()];
}

export async function discoverCarrefourDeals(options?: {
  feedUrls?: string[];
  timeoutMs?: number;
  maxItems?: number;
}): Promise<{
  items: CarrefourDiscoveredItem[];
  feedsFetched: number;
  feedErrors: Array<{ url: string; message: string }>;
}> {
  const feedUrls =
    options?.feedUrls?.length
      ? options.feedUrls
      : process.env.CARREFOUR_FEED_URLS?.split(",")
          .map((value) => value.trim())
          .filter(Boolean) ?? [...DEFAULT_CARREFOUR_DEAL_FEED_URLS];

  const maxItems = options?.maxItems ?? 100;
  const map = new Map<string, CarrefourDiscoveredItem>();
  const feedErrors: Array<{ url: string; message: string }> = [];
  let feedsFetched = 0;

  for (const feedUrl of feedUrls) {
    if (isCarrefourFoodContext({ feedUrl })) continue;

    try {
      const html = await fetchCarrefourHtml(feedUrl, {
        timeoutMs: options?.timeoutMs,
        referer: "https://www.carrefour.es/",
      });
      feedsFetched += 1;
      for (const item of parseCarrefourListingHtml(html, feedUrl)) {
        upsertItem(map, item);
        if (map.size >= maxItems) break;
      }
    } catch (error) {
      feedErrors.push({
        url: feedUrl,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }

    if (map.size >= maxItems) break;
  }

  return {
    items: [...map.values()].slice(0, maxItems),
    feedsFetched,
    feedErrors,
  };
}
