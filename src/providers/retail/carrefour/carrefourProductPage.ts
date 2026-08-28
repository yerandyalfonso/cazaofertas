import * as cheerio from "cheerio";
import { roundMoney } from "@/lib/money";
import { titleFromProductSlug } from "@/lib/retail-url-utils";
import { parseAmazonPriceText } from "@/providers/price";
import type { CarrefourProductQuote } from "@/providers/retail/carrefour/types";
import {
  extractCarrefourSku,
  fetchCarrefourHtml,
  isCarrefourProductUrl,
  normalizeCarrefourProductUrl,
} from "@/providers/retail/carrefour/carrefourHttp";

function computeDiscount(
  price: number,
  listPrice: number | null,
): number | null {
  if (listPrice == null || listPrice <= price) return null;
  return roundMoney(((listPrice - price) / listPrice) * 100);
}

function parseEuroAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return roundMoney(raw);
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return parseAmazonPriceText(trimmed);
}

function isProductType(type: unknown): boolean {
  if (typeof type === "string") return type === "Product";
  if (Array.isArray(type)) return type.includes("Product");
  return false;
}

function collectJsonLdRecords(parsed: unknown): Record<string, unknown>[] {
  if (!parsed || typeof parsed !== "object") return [];

  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record["@graph"])) {
    return (record["@graph"] as unknown[]).filter(
      (node): node is Record<string, unknown> =>
        Boolean(node) && typeof node === "object",
    );
  }

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (node): node is Record<string, unknown> =>
        Boolean(node) && typeof node === "object",
    );
  }

  return [record];
}

function pickImageUrl(image: unknown): string | undefined {
  if (typeof image === "string" && image.trim()) return upgradeCarrefourImageUrl(image);
  if (Array.isArray(image)) {
    for (const item of image) {
      const url = pickImageUrl(item);
      if (url) return url;
    }
  }
  if (image && typeof image === "object") {
    const record = image as Record<string, unknown>;
    if (typeof record.url === "string") return upgradeCarrefourImageUrl(record.url);
    if (typeof record.contentUrl === "string") {
      return upgradeCarrefourImageUrl(record.contentUrl);
    }
  }
  return undefined;
}

function upgradeCarrefourImageUrl(url: string): string {
  return url
    .replace(/hd_100x_/i, "hd_1500x_")
    .replace(/hd_510x_/i, "hd_1500x_")
    .replace(/hd_64x_/i, "hd_1500x_");
}

function parseOffers(
  offers: unknown,
): { price: number | null; listPrice: number | null } {
  const nodes = Array.isArray(offers) ? offers : offers ? [offers] : [];
  let price: number | null = null;
  let listPrice: number | null = null;

  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const offer = node as Record<string, unknown>;

    const sale =
      parseEuroAmount(offer.price) ??
      parseEuroAmount(offer.lowPrice) ??
      parseEuroAmount(
        (offer.priceSpecification as Record<string, unknown> | undefined)?.price,
      );

    const reference =
      parseEuroAmount(offer.highPrice) ??
      parseEuroAmount(offer.listPrice) ??
      parseEuroAmount(offer.wasPrice) ??
      parseEuroAmount(offer.referencePrice);

    if (sale != null && price == null) price = sale;
    if (reference != null && reference > (sale ?? 0)) {
      listPrice = reference;
    }
  }

  return { price, listPrice };
}

function parseJsonLdProduct(html: string): Partial<CarrefourProductQuote> | null {
  const $ = cheerio.load(html);
  let best: Partial<CarrefourProductQuote> | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      for (const record of collectJsonLdRecords(parsed)) {
        if (!isProductType(record["@type"])) continue;

        const offers = parseOffers(record.offers);
        const brand = record.brand as { name?: string } | string | undefined;
        const brandName =
          typeof brand === "string"
            ? brand.trim()
            : brand?.name?.trim();

        const description =
          typeof record.description === "string"
            ? record.description.trim()
            : undefined;

        const sku =
          typeof record.sku === "string" ? record.sku.trim() : undefined;

        best = {
          title:
            typeof record.name === "string" ? record.name.trim() : undefined,
          brand: brandName,
          imageUrl: pickImageUrl(record.image),
          description,
          price: offers.price,
          listPrice: offers.listPrice,
          externalId: sku,
          ean:
            typeof record.EAN === "string"
              ? record.EAN.trim()
              : typeof record.gtin13 === "string"
                ? record.gtin13.trim()
                : undefined,
        };
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  return best;
}

interface CarrefourInitialSku {
  id?: string;
  ean13?: string;
  offers?: Array<{
    price?: string;
    app_price?: string;
    reference_price?: string;
    crossed_price?: string;
  }>;
}

interface CarrefourInitialProduct {
  name?: string;
  description?: string;
  brand?: { description?: string };
  colors?: Array<{
    images?: Array<{ large?: string; medium?: string; thumbnail?: string }>;
  }>;
  skus?: CarrefourInitialSku[];
}

function parseInitialStateProduct(
  html: string,
  preferredSku?: string | null,
): Partial<CarrefourProductQuote> | null {
  const match = html.match(
    /(?:window\.__INITIAL_STATE__|__INITIAL_STATE__)\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:<\/script>|window\.|$)/,
  );
  if (!match?.[1]) return null;

  try {
    const state = JSON.parse(match[1]) as {
      pdp?: { product?: CarrefourInitialProduct; breadcrumb?: { items?: Array<{ text?: string }> } };
    };
    const product = state.pdp?.product;
    if (!product) return null;

    const skuNodes = product.skus ?? [];
    const sku =
      skuNodes.find((item) => item.id === preferredSku) ??
      skuNodes.find((item) => item.id?.endsWith(preferredSku ?? "")) ??
      skuNodes[0];

    const offer = sku?.offers?.[0];
    const price =
      parseEuroAmount(offer?.price) ?? parseEuroAmount(offer?.app_price);
    const listPrice =
      parseEuroAmount(offer?.reference_price) ??
      parseEuroAmount(offer?.crossed_price);

    const imageUrl =
      product.colors?.[0]?.images?.[0]?.large ??
      product.colors?.[0]?.images?.[0]?.medium ??
      product.colors?.[0]?.images?.[0]?.thumbnail;

    const breadcrumbs =
      state.pdp?.breadcrumb?.items
        ?.map((item) => item.text?.trim())
        .filter((text): text is string => Boolean(text && text.length > 1)) ??
      [];

    return {
      title: product.name?.trim(),
      brand: product.brand?.description?.trim(),
      description: product.description?.trim(),
      imageUrl: imageUrl ? upgradeCarrefourImageUrl(imageUrl) : undefined,
      externalId: sku?.id,
      ean: sku?.ean13,
      price,
      listPrice:
        listPrice != null && price != null && listPrice > price
          ? listPrice
          : null,
      breadcrumbs,
    };
  } catch {
    return null;
  }
}

function parseCarrefourPricesFromHtml(html: string): {
  price: number | null;
  listPrice: number | null;
} {
  const $ = cheerio.load(html);
  const prices: number[] = [];

  const selectors = [
    "[class*='product-price']",
    "[class*='price-current']",
    "[class*='sale-price']",
    "[data-testid*='price']",
    ".price",
    "main [class*='price']",
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ");
      const match = text.match(/(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*€/);
      if (match?.[1]) {
        const value = parseAmazonPriceText(match[1]);
        if (value != null && value >= 5) prices.push(value);
      }
    });
    if (prices.length > 0) break;
  }

  const unique = [...new Set(prices)].sort((a, b) => a - b);
  if (unique.length === 0) return { price: null, listPrice: null };
  if (unique.length === 1) return { price: unique[0], listPrice: null };

  return {
    price: unique[0],
    listPrice: unique[unique.length - 1],
  };
}

function parseBreadcrumbs(html: string): string[] {
  const $ = cheerio.load(html);
  const crumbs: string[] = [];

  $("nav a, .breadcrumb a, [class*='breadcrumb'] a").each((_, el) => {
    const label = $(el).text().replace(/\s+/g, " ").trim();
    if (label && label.length > 1 && !/carrefour/i.test(label)) {
      crumbs.push(label);
    }
  });

  return crumbs;
}

function mergePartialQuotes(
  ...partials: Array<Partial<CarrefourProductQuote> | null | undefined>
): Partial<CarrefourProductQuote> {
  const merged: Partial<CarrefourProductQuote> = {};

  for (const partial of partials) {
    if (!partial) continue;
    merged.title = partial.title?.trim() || merged.title;
    merged.brand = partial.brand?.trim() || merged.brand;
    merged.description = partial.description?.trim() || merged.description;
    merged.imageUrl = partial.imageUrl || merged.imageUrl;
    merged.externalId = partial.externalId || merged.externalId;
    merged.ean = partial.ean || merged.ean;
    merged.price = partial.price ?? merged.price ?? null;
    merged.listPrice = partial.listPrice ?? merged.listPrice ?? null;
    merged.breadcrumbs =
      partial.breadcrumbs && partial.breadcrumbs.length > 0
        ? partial.breadcrumbs
        : merged.breadcrumbs;
  }

  return merged;
}

export function buildCarrefourFallbackQuote(
  urlOrId: string,
): CarrefourProductQuote {
  const productUrl = /^https?:\/\//i.test(urlOrId)
    ? normalizeCarrefourProductUrl(urlOrId)
    : urlOrId;
  const externalId = extractCarrefourSku(urlOrId);
  if (!externalId) {
    throw new Error("No se pudo extraer el ID Carrefour de la URL.");
  }

  const title =
    titleFromProductSlug(productUrl) ?? `Producto Carrefour ${externalId}`;

  return {
    externalId,
    productUrl,
    title,
    price: null,
    listPrice: null,
    discountPercentage: null,
    availability: "UNKNOWN",
  };
}

export function parseCarrefourProductHtml(
  html: string,
  productUrl: string,
  externalId: string,
): CarrefourProductQuote {
  const jsonLd = parseJsonLdProduct(html);
  const initialState = parseInitialStateProduct(html, externalId);
  const htmlPrices = parseCarrefourPricesFromHtml(html);
  const merged = mergePartialQuotes(jsonLd, initialState);

  const $ = cheerio.load(html);
  const price = merged.price ?? htmlPrices.price;
  const listPrice =
    merged.listPrice ??
    (htmlPrices.listPrice != null &&
    price != null &&
    htmlPrices.listPrice > price
      ? htmlPrices.listPrice
      : null);

  const title =
    merged.title?.trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    titleFromProductSlug(productUrl) ||
    `Producto Carrefour ${externalId}`;

  const ogImage = $("meta[property='og:image']").attr("content")?.trim();
  const imageUrl =
    merged.imageUrl ||
    (ogImage ? upgradeCarrefourImageUrl(ogImage) : undefined);

  const description =
    merged.description ||
    $("meta[property='og:description']").attr("content")?.trim() ||
    $("meta[name='description']").attr("content")?.trim();

  const breadcrumbs =
    merged.breadcrumbs && merged.breadcrumbs.length > 0
      ? merged.breadcrumbs
      : parseBreadcrumbs(html);

  return {
    externalId: merged.externalId ?? externalId,
    productUrl,
    title,
    brand: merged.brand ?? undefined,
    description: description || undefined,
    ean: merged.ean,
    imageUrl,
    price,
    listPrice,
    discountPercentage: computeDiscount(price ?? 0, listPrice),
    availability: price != null ? "IN_STOCK" : "UNKNOWN",
    breadcrumbs,
  };
}

export async function scrapeCarrefourProductPage(
  urlOrId: string,
  options: { timeoutMs?: number } = {},
): Promise<CarrefourProductQuote> {
  const trimmed = urlOrId.trim();
  if (!isCarrefourProductUrl(trimmed) && !extractCarrefourSku(trimmed)) {
    throw new Error("Se requiere una URL de producto Carrefour válida.");
  }

  const productUrl = /^https?:\/\//i.test(trimmed)
    ? normalizeCarrefourProductUrl(trimmed)
    : trimmed;
  const externalId = extractCarrefourSku(productUrl) ?? extractCarrefourSku(trimmed);
  if (!externalId) {
    throw new Error("No se pudo extraer el ID Carrefour de la URL.");
  }

  const html = await fetchCarrefourHtml(productUrl, {
    ...options,
    referer: "https://www.carrefour.es/",
  });
  return parseCarrefourProductHtml(html, productUrl, externalId);
}

export function hasRealCarrefourDiscount(quote: CarrefourProductQuote): boolean {
  if (quote.price == null) return false;
  if (quote.listPrice != null && quote.listPrice > quote.price) return true;
  return (quote.discountPercentage ?? 0) > 0;
}
