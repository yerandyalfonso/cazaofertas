import * as cheerio from "cheerio";
import {
  extractAsin,
  generateAmazonUrl,
} from "@/lib/affiliate";
import {
  fetchAmazonPageHtml,
  parseAmazonPriceText,
} from "@/providers/price";
import { DEFAULT_MOCK_CATALOG } from "@/providers/price/MockPriceProvider";

export const DEFAULT_FLASH_FEED_URLS = [
  "https://www.amazon.es/gp/goldbox",
  "https://www.amazon.es/deals",
  "https://www.amazon.es/gp/goldbox?ref_=nav_cs_gb",
] as const;

export interface DiscoveredListingItem {
  asin: string;
  amazonUrl: string;
  titleHint?: string;
  priceHint?: number;
  listPriceHint?: number;
  sourceUrl: string;
  /** Origen: listado live de Amazon o simulación / feed inyectado. */
  origin: "live" | "simulated" | "injected";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectAsinsFromHtml(
  html: string,
  sourceUrl: string,
): DiscoveredListingItem[] {
  const $ = cheerio.load(html);
  const byAsin = new Map<string, DiscoveredListingItem>();

  const upsert = (asinRaw: string, extras?: Partial<DiscoveredListingItem>) => {
    const asin = asinRaw.toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) return;
    const existing = byAsin.get(asin);
    byAsin.set(asin, {
      asin,
      amazonUrl: extras?.amazonUrl ?? existing?.amazonUrl ?? generateAmazonUrl(asin),
      sourceUrl,
      origin: extras?.origin ?? existing?.origin ?? "live",
      titleHint: extras?.titleHint ?? existing?.titleHint,
      priceHint: extras?.priceHint ?? existing?.priceHint,
      listPriceHint: extras?.listPriceHint ?? existing?.listPriceHint,
    });
  };

  $('a[href*="/dp/"], a[href*="/gp/product/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const asin = extractAsin(href);
    if (!asin) return;

    const card = $(el).closest(
      "[data-asin], .DealCard-module__card, .octopus-pc-item, .a-carousel-card, li",
    );
    const titleHint =
      $(el).attr("aria-label")?.trim() ||
      card.find("img[alt]").attr("alt")?.trim() ||
      $(el).text().replace(/\s+/g, " ").trim().slice(0, 160) ||
      undefined;

    const priceText =
      card.find(".a-price .a-offscreen").first().text() ||
      card.find(".a-price").first().text();
    const listText =
      card.find(".a-price.a-text-price .a-offscreen").first().text() ||
      card.find("[data-a-strike='true']").first().text();

    upsert(asin, {
      origin: "live",
      titleHint: titleHint && titleHint.length > 3 ? titleHint : undefined,
      priceHint: parseAmazonPriceText(priceText) ?? undefined,
      listPriceHint: parseAmazonPriceText(listText) ?? undefined,
      amazonUrl: href.startsWith("http")
        ? href.split("?")[0]!
        : generateAmazonUrl(asin),
    });
  });

  $("[data-asin]").each((_, el) => {
    const asin = ($(el).attr("data-asin") ?? "").trim().toUpperCase();
    if (asin) upsert(asin, { origin: "live" });
  });

  for (const match of html.matchAll(/"asin"\s*:\s*"([A-Z0-9]{10})"/gi)) {
    upsert(match[1]!, { origin: "live" });
  }
  for (const match of html.matchAll(/\/dp\/([A-Z0-9]{10})/gi)) {
    upsert(match[1]!, { origin: "live" });
  }

  return [...byAsin.values()];
}

/** Listado simulado de chollos cuando Amazon bloquea o no hay feeds live. */
export function buildSimulatedFlashListings(
  maxItems = 12,
): DiscoveredListingItem[] {
  return DEFAULT_MOCK_CATALOG.filter(
    (item) =>
      item.previousPrice != null &&
      item.previousPrice > item.price &&
      (item.previousPrice - item.price) / item.previousPrice >= 0.1,
  )
    .slice(0, maxItems)
    .map((item) => ({
      asin: item.asin.toUpperCase(),
      amazonUrl: item.amazonUrl ?? generateAmazonUrl(item.asin),
      titleHint: item.title,
      priceHint: item.price,
      listPriceHint: item.previousPrice,
      sourceUrl: "simulated://amazon.es/gp/goldbox",
      origin: "simulated" as const,
    }));
}

export function listingsFromInjectedAsins(
  asins: string[],
): DiscoveredListingItem[] {
  const items: DiscoveredListingItem[] = [];
  for (const raw of asins) {
    const asin = extractAsin(raw)?.toUpperCase();
    if (!asin) continue;
    items.push({
      asin,
      amazonUrl: raw.includes("http") ? raw.trim() : generateAmazonUrl(asin),
      sourceUrl: "injected://feed",
      origin: "injected",
    });
  }
  return items;
}

/**
 * Escanea listados públicos (Gold Box / Deals), feeds inyectados o simulación.
 */
export async function discoverFlashDealListings(options?: {
  feedUrls?: string[];
  /** ASINs o URLs inyectados (feeds dinámicos / tests). */
  injectedAsins?: string[];
  maxItems?: number;
  delayMs?: number;
  timeoutMs?: number;
  /** Si los feeds live fallan o vienen vacíos, usar listado simulado. */
  allowSimulatedFallback?: boolean;
}): Promise<{
  feedsFetched: number;
  feedErrors: Array<{ url: string; message: string }>;
  usedSimulation: boolean;
  items: DiscoveredListingItem[];
}> {
  const maxItems = options?.maxItems ?? 40;
  const delayMs = options?.delayMs ?? 900;
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const allowSimulatedFallback = options?.allowSimulatedFallback ?? true;

  const merged = new Map<string, DiscoveredListingItem>();
  const feedErrors: Array<{ url: string; message: string }> = [];
  let feedsFetched = 0;
  let usedSimulation = false;

  for (const item of listingsFromInjectedAsins(options?.injectedAsins ?? [])) {
    merged.set(item.asin, item);
  }

  const feedUrls = [
    ...new Set(
      (options?.feedUrls?.length
        ? options.feedUrls
        : [...DEFAULT_FLASH_FEED_URLS]
      )
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ];

  for (let index = 0; index < feedUrls.length; index += 1) {
    const url = feedUrls[index]!;
    try {
      const html = await fetchAmazonPageHtml(url, { timeoutMs });
      feedsFetched += 1;
      for (const item of collectAsinsFromHtml(html, url)) {
        if (!merged.has(item.asin)) {
          merged.set(item.asin, item);
        }
      }
    } catch (error) {
      feedErrors.push({
        url,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }

    if (index < feedUrls.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  if (merged.size === 0 && allowSimulatedFallback) {
    usedSimulation = true;
    for (const item of buildSimulatedFlashListings(maxItems)) {
      merged.set(item.asin, item);
    }
  }

  return {
    feedsFetched,
    feedErrors,
    usedSimulation,
    items: [...merged.values()].slice(0, maxItems),
  };
}
