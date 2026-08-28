import * as cheerio from "cheerio";
import { existsSync, readFileSync } from "node:fs";
import {
  extractKiabiProductId,
  isKiabiProductUrl,
  normalizeKiabiProductUrl,
} from "@/lib/retailers";
import { withRetry } from "@/lib/retry";
import { parseAmazonPriceText } from "@/providers/price";
import type { KiabiDiscoveredItem } from "@/providers/retail/kiabi/types";

export const DEFAULT_KIABI_DEAL_FEED_URLS = [
  "https://www.kiabi.es/promociones_464410",
] as const;

const KIABI_ORIGIN = "https://www.kiabi.es";
const KIABI_STATIC_ORIGIN = "https://static.kiabi.es";

const KIABI_CATEGORY_GRAPHQL_HASH =
  "c88392512eaca888eda84589615ba434c1eb23cf0b56bc760054f63c250164ae";

interface KiabiPageInfo {
  currentPage: number;
  totalElements: number;
  totalPages: number;
}

interface KiabiApiProduct {
  productUrl?: string;
  productLabel?: string;
  display?: {
    price?: { salePrice?: number; listPrice?: number };
    images?: { productImagesSource?: string[] };
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlockedHtml(html: string): boolean {
  return (
    /captcha-delivery\.com/i.test(html) ||
    /Please enable JS and disable any ad blocker/i.test(html) ||
    html.length < 800
  );
}

function kiabiCookieHeader(): string | undefined {
  const inline = process.env.KIABI_COOKIE_HEADER?.trim();
  if (inline) return inline;

  const path = process.env.KIABI_COOKIES_FILE?.trim();
  if (!path || !existsSync(path)) return undefined;

  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return undefined;

  // Una línea tipo cabecera Cookie o formato Netscape (name=value por línea).
  if (raw.includes("\t") && raw.includes(".kiabi")) {
    return raw
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const parts = line.split("\t");
        const name = parts[parts.length - 2];
        const value = parts[parts.length - 1];
        return name && value ? `${name}=${value}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }

  return raw.replace(/\s+/g, " ");
}

function kiabiFetchHeaders(
  options: { referer?: string; accept?: string; fetchDest?: string; fetchMode?: string } = {},
): Record<string, string> {
  const cookie = kiabiCookieHeader();
  return {
    Accept:
      options.accept ??
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Referer: options.referer ?? `${KIABI_ORIGIN}/`,
    "Sec-Fetch-Dest": options.fetchDest ?? "document",
    "Sec-Fetch-Mode": options.fetchMode ?? "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

export async function fetchKiabiHtml(
  url: string,
  options: { timeoutMs?: number; referer?: string } = {},
): Promise<string> {
  return withRetry(
    async () => {
      const timeoutMs = options.timeoutMs ?? 18_000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: kiabiFetchHeaders({ referer: options.referer }),
          redirect: "follow",
        });

        if (!response.ok) {
          throw new Error(`Kiabi HTTP ${response.status} para ${url}`);
        }

        const html = await response.text();
        if (isBlockedHtml(html)) {
          throw new Error(
            "Kiabi bloqueó la petición (anti-bot). Ejecuta el cron desde tu Mac con IP residencial.",
          );
        }

        return html;
      } finally {
        clearTimeout(timer);
      }
    },
    { attempts: 3, delayMs: 800 },
  );
}

function categorySlugFromFeedUrl(feedUrl: string): string {
  const path = new URL(feedUrl).pathname.replace(/^\//, "");
  return path.split("?")[0] ?? path;
}

function extractNextDataJson(html: string): Record<string, unknown> | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapKiabiApiProduct(
  product: KiabiApiProduct,
  sourceUrl: string,
): KiabiDiscoveredItem | null {
  const href = product.productUrl?.trim();
  if (!href) return null;

  const absolute = absoluteKiabiUrl(href);
  if (!absolute || !isKiabiProductUrl(absolute)) return null;

  const externalId = extractKiabiProductId(absolute);
  if (!externalId) return null;

  const salePrice = product.display?.price?.salePrice;
  const listPrice = product.display?.price?.listPrice;
  const imagePath = product.display?.images?.productImagesSource?.[0];

  return {
    externalId,
    productUrl: absolute,
    sourceUrl,
    titleHint: product.productLabel?.replace(/\s+/g, " ").trim() || undefined,
    priceHint: typeof salePrice === "number" ? salePrice : undefined,
    listPriceHint:
      typeof listPrice === "number" &&
      typeof salePrice === "number" &&
      listPrice > salePrice
        ? listPrice
        : undefined,
    imageUrlHint: normalizeKiabiImageUrl(
      imagePath ? new URL(imagePath, KIABI_STATIC_ORIGIN).toString() : undefined,
    ),
  };
}

export function parseKiabiNextDataHtml(
  html: string,
  sourceUrl: string,
): {
  items: KiabiDiscoveredItem[];
  pageInfo: KiabiPageInfo | null;
  categorySlug: string;
} {
  const categorySlug = categorySlugFromFeedUrl(sourceUrl);
  const nextData = extractNextDataJson(html);
  if (!nextData) {
    return { items: [], pageInfo: null, categorySlug };
  }

  const pageProps = nextData.props as
    | { pageProps?: Record<string, unknown> }
    | undefined;
  const category = (
    pageProps?.pageProps?.queryProductResponse as
      | { category?: { items?: KiabiApiProduct[]; pageInfo?: KiabiPageInfo } }
      | undefined
  )?.category;

  const items: KiabiDiscoveredItem[] = [];
  for (const product of category?.items ?? []) {
    const mapped = mapKiabiApiProduct(product, sourceUrl);
    if (mapped) items.push(mapped);
  }

  return {
    items,
    pageInfo: category?.pageInfo ?? null,
    categorySlug,
  };
}

function buildKiabiCategoryGraphqlUrl(
  categorySlug: string,
  page: number,
  pageSize = 40,
): string {
  const variables = {
    env: "PRODUCTION",
    pagination: { page, size: pageSize },
    locale: "es-ES",
    request: {
      url: categorySlug,
      useAlgoliaSeoFallback: true,
      newRanking: false,
    },
  };
  const extensions = {
    persistedQuery: { version: 1, sha256Hash: KIABI_CATEGORY_GRAPHQL_HASH },
  };
  const params = new URLSearchParams({
    operationName: "Category",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });
  return `${KIABI_ORIGIN}/graphql?${params.toString()}`;
}

async function fetchKiabiCategoryGraphqlPage(
  categorySlug: string,
  page: number,
  options: { referer: string; timeoutMs?: number },
): Promise<KiabiDiscoveredItem[]> {
  const url = buildKiabiCategoryGraphqlUrl(categorySlug, page);
  const timeoutMs = options.timeoutMs ?? 18_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: kiabiFetchHeaders({
        referer: options.referer,
        accept: "application/json",
        fetchDest: "empty",
        fetchMode: "cors",
      }),
    });

    if (!response.ok) {
      throw new Error(`Kiabi GraphQL HTTP ${response.status} (página ${page})`);
    }

    const payload = (await response.json()) as {
      data?: { category?: { items?: KiabiApiProduct[] } };
      errors?: Array<{ message?: string }>;
    };

    if (payload.errors?.length) {
      throw new Error(
        payload.errors.map((error) => error.message).filter(Boolean).join("; ") ||
          `Kiabi GraphQL error (página ${page})`,
      );
    }

    const items: KiabiDiscoveredItem[] = [];
    for (const product of payload.data?.category?.items ?? []) {
      const mapped = mapKiabiApiProduct(product, options.referer);
      if (mapped) items.push(mapped);
    }
    return items;
  } finally {
    clearTimeout(timer);
  }
}

function absoluteKiabiUrl(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) {
    return null;
  }
  try {
    const url = new URL(trimmed, KIABI_ORIGIN);
    if (!/kiabi\.(es|com|fr)/i.test(url.hostname)) return null;
    return normalizeKiabiProductUrl(url.toString());
  } catch {
    return null;
  }
}

function parseEuroPriceText(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*€/);
  if (!match?.[1]) return null;
  return parseAmazonPriceText(match[1]);
}

/** Precio rebajado + precio de referencia (tachado), si Kiabi lo muestra. */
export function parseKiabiPromoPricePair(
  promoText: string,
  overrideText?: string,
): { price?: number; listPrice?: number } {
  const price = parseEuroPriceText(promoText);
  const listPrice = overrideText ? parseEuroPriceText(overrideText) : null;
  if (price == null) return {};
  if (listPrice != null && listPrice > price) {
    return { price, listPrice };
  }
  return { price };
}

function normalizeKiabiImageUrl(src: string | undefined): string | undefined {
  if (!src?.trim()) return undefined;
  try {
    const url = new URL(src.trim(), KIABI_ORIGIN);
    if (!/static\.kiabi/i.test(url.hostname)) return undefined;
    url.searchParams.set("width", "800");
    return url.toString();
  } catch {
    return undefined;
  }
}

function upsertDiscoveryItem(
  map: Map<string, KiabiDiscoveredItem>,
  url: string,
  sourceUrl: string,
  extras?: Partial<KiabiDiscoveredItem>,
): void {
  const externalId = extractKiabiProductId(url);
  if (!externalId) return;

  const productUrl = normalizeKiabiProductUrl(url);
  const existing = map.get(externalId);
  map.set(externalId, {
    externalId,
    productUrl,
    sourceUrl,
    titleHint: extras?.titleHint ?? existing?.titleHint,
    priceHint: extras?.priceHint ?? existing?.priceHint,
    listPriceHint: extras?.listPriceHint ?? existing?.listPriceHint,
    imageUrlHint: extras?.imageUrlHint ?? existing?.imageUrlHint,
  });
}

export function parseKiabiListingHtml(
  html: string,
  sourceUrl: string,
): KiabiDiscoveredItem[] {
  const $ = cheerio.load(html);
  const byId = new Map<string, KiabiDiscoveredItem>();

  $('[data-testid="productCard_span_label"]').each((_, el) => {
    const label = $(el);
    const titleHint = label.text().replace(/\s+/g, " ").trim();
    if (!titleHint || titleHint.length < 3) return;

    let cardRoot = label.closest('[data-testid="productCardContainer"]');
    if (cardRoot.length === 0) {
      cardRoot = label.closest("li");
    }
    if (cardRoot.length === 0) {
      cardRoot = label
        .parents()
        .filter((_, node) => {
          const element = $(node);
          return (
            element.find('[data-testid="productList_span_cardPrice"]').length >
              0 && element.find('a[href*="_P"]').length > 0
          );
        })
        .first();
    }

    const linkEl = cardRoot.find('a[href*="_P"]').first();
    const href = linkEl.attr("href") ?? "";
    const absolute = absoluteKiabiUrl(href);
    if (!absolute || !isKiabiProductUrl(absolute)) return;

    const priceRoot = cardRoot
      .find('[data-testid="productList_span_cardPrice"]')
      .first();
    const promoText =
      priceRoot.find('[class*="pricePromo"]').first().text() ||
      priceRoot.find('[data-testid="text"]').first().text();
    const overrideText = priceRoot.find('[class*="priceOverride"]').first().text();
    const { price, listPrice } = parseKiabiPromoPricePair(
      promoText,
      overrideText || undefined,
    );

    const imageSrc =
      cardRoot.find('img[src*="static.kiabi"]').first().attr("src") ??
      cardRoot.find("img[src]").first().attr("src");

    upsertDiscoveryItem(byId, absolute, sourceUrl, {
      titleHint,
      priceHint: price,
      listPriceHint: listPrice,
      imageUrlHint: normalizeKiabiImageUrl(imageSrc),
    });
  });

  if (byId.size > 0) {
    return [...byId.values()];
  }

  // Fallback legacy: enlaces sueltos sin estructura promo/override.
  $('a[href*="_P"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const absolute = absoluteKiabiUrl(href);
    if (!absolute || !isKiabiProductUrl(absolute)) return;

    const card = $(el).closest(
      "li, article, [class*='productListCard'], [class*='productCard']",
    );
    const titleHint =
      $(el).attr("aria-label")?.trim() ||
      card
        .find('[data-testid="productCard_span_label"]')
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim() ||
      $(el).find("h2, h3").first().text().replace(/\s+/g, " ").trim() ||
      undefined;

    const priceRoot = card.find('[data-testid="productList_span_cardPrice"]').first();
    const promoText = priceRoot.find('[class*="pricePromo"]').first().text();
    const overrideText = priceRoot.find('[class*="priceOverride"]').first().text();
    const parsed = parseKiabiPromoPricePair(
      promoText || priceRoot.text(),
      overrideText || undefined,
    );

    const imageSrc = card.find('img[src*="static.kiabi"]').first().attr("src");

    upsertDiscoveryItem(byId, absolute, sourceUrl, {
      titleHint: titleHint && titleHint.length > 3 ? titleHint : undefined,
      priceHint: parsed.price,
      listPriceHint: parsed.listPrice,
      imageUrlHint: normalizeKiabiImageUrl(imageSrc),
    });
  });

  return [...byId.values()];
}

export async function discoverKiabiDeals(options?: {
  feedUrls?: string[];
  maxItems?: number;
  delayMs?: number;
  timeoutMs?: number;
}): Promise<{
  items: KiabiDiscoveredItem[];
  feedsFetched: number;
  feedErrors: Array<{ url: string; message: string }>;
}> {
  const feedUrls = options?.feedUrls?.length
    ? options.feedUrls
    : [...DEFAULT_KIABI_DEAL_FEED_URLS];
  const maxItems = Math.max(1, options?.maxItems ?? 100);
  const delayMs = options?.delayMs ?? 1_200;
  const byId = new Map<string, KiabiDiscoveredItem>();
  const feedErrors: Array<{ url: string; message: string }> = [];
  let feedsFetched = 0;

  for (let index = 0; index < feedUrls.length; index += 1) {
    const url = feedUrls[index]!;
    try {
      const html = await fetchKiabiHtml(url, { timeoutMs: options?.timeoutMs });
      feedsFetched += 1;

      const nextData = parseKiabiNextDataHtml(html, url);
      for (const item of nextData.items) {
        byId.set(item.externalId, item);
      }

      const totalPages = nextData.pageInfo?.totalPages ?? 1;
      if (totalPages > 1 && nextData.categorySlug) {
        for (let page = 2; page <= totalPages; page += 1) {
          if (byId.size >= maxItems) break;
          const pageItems = await withRetry(
            () =>
              fetchKiabiCategoryGraphqlPage(nextData.categorySlug, page, {
                referer: url,
                timeoutMs: options?.timeoutMs,
              }),
            { attempts: 2, delayMs: 600 },
          );
          for (const item of pageItems) {
            byId.set(item.externalId, item);
            if (byId.size >= maxItems) break;
          }
          if (page < totalPages && delayMs > 0) {
            await sleep(delayMs);
          }
        }
      }

      if (byId.size === 0) {
        for (const item of parseKiabiListingHtml(html, url)) {
          byId.set(item.externalId, item);
          if (byId.size >= maxItems) break;
        }
      }
    } catch (error) {
      feedErrors.push({
        url,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }

    if (byId.size >= maxItems) break;
    if (index < feedUrls.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return {
    items: [...byId.values()].slice(0, maxItems),
    feedsFetched,
    feedErrors,
  };
}
