import * as cheerio from "cheerio";
import { extractAsin, generateAmazonUrl } from "@/lib/affiliate";
import type { PriceProvider, ProductPriceData } from "@/providers/price/types";
import { ProductAvailability } from "@/types";

export interface AmazonHtmlPriceProviderOptions {
  /** Mapa ASIN → URL de producto en Amazon. */
  urlByAsin?: Map<string, string>;
  /** Pausa entre peticiones para reducir bloqueos (ms). */
  delayMs?: number;
  /** Timeout por petición (ms). */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
  // Forzar ficha ES/EUR aunque el fetch salga desde IP de Vercel (US).
  Cookie: "lc-acbes=es_ES; i18n-prefs=EUR; skin=noskin",
};

function amazonEsProductUrl(asin: string, preferredUrl?: string): string {
  if (preferredUrl && /amazon\.es\//i.test(preferredUrl) && preferredUrl.includes(asin)) {
    try {
      const url = new URL(preferredUrl);
      url.searchParams.set("language", "es_ES");
      url.searchParams.set("currency", "EUR");
      url.searchParams.set("th", "1");
      url.searchParams.set("psc", "1");
      return url.toString();
    } catch {
      // fall through
    }
  }
  return `https://www.amazon.es/dp/${asin}?language=es_ES&currency=EUR&th=1&psc=1`;
}

function collectPricesFromSelectors(
  $: cheerio.CheerioAPI,
  selectors: string[],
): number[] {
  const values: number[] = [];
  const seen = new Set<number>();
  for (const selector of selectors) {
    const nodes = $(selector);
    for (let i = 0; i < nodes.length; i += 1) {
      const price = parseAmazonPriceText(nodes.eq(i).text());
      if (price === null || seen.has(price)) continue;
      seen.add(price);
      values.push(price);
    }
  }
  return values;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parsea importes estilo ES (79,99 / 1.234,56) o EN (79.99). */
export function parseAmazonPriceText(raw: string): number | null {
  const text = raw
    .replace(/\u00a0/g, " ")
    .replace(/[^\d,.\-]/g, "")
    .trim();

  if (!text) return null;

  let normalized = text;
  if (/\d{1,3}(\.\d{3})+,\d{1,2}$/.test(text) || /^\d+,\d{1,2}$/.test(text)) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (/\d{1,3}(,\d{3})+\.\d{1,2}$/.test(text)) {
    normalized = text.replace(/,/g, "");
  } else if (text.includes(",") && !text.includes(".")) {
    normalized = text.replace(",", ".");
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 100_000) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function firstPriceFromSelectors(
  $: cheerio.CheerioAPI,
  selectors: string[],
): number | null {
  for (const selector of selectors) {
    const nodes = $(selector);
    for (let i = 0; i < nodes.length; i += 1) {
      const text = nodes.eq(i).text();
      const price = parseAmazonPriceText(text);
      if (price !== null) return price;
    }
  }
  return null;
}

/** Fallback cuando `.a-offscreen` viene vacío pero hay whole+fraction. */
function priceFromWholeFraction(
  $: cheerio.CheerioAPI,
  rootSelector: string,
): number | null {
  const roots = $(rootSelector);
  for (let i = 0; i < roots.length; i += 1) {
    const root = roots.eq(i);
    if (root.hasClass("a-text-price")) continue;
    const whole = root.find(".a-price-whole").first().text();
    const fraction = root.find(".a-price-fraction").first().text();
    if (!whole) continue;
    const combined = `${whole.replace(/[^\d.,]/g, "")}${
      fraction ? `,${fraction.replace(/[^\d]/g, "")}` : ""
    }`;
    const price = parseAmazonPriceText(combined);
    if (price !== null) return price;
  }
  return null;
}

function priceFromPageScripts(html: string): number | null {
  const patterns = [
    // Preferir precio a pagar (flash / apex), no el primer priceAmount suelto.
    /"priceToPay"\s*:\s*\{[^}]{0,120}?"amount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"priceToPay"[\s\S]{0,160}?"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"buyingPrice"\s*:\s*\{[^}]{0,80}?"amount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /apex-pricetopay-value[\s\S]{0,200}?([\d.,]+)\s*€/i,
    /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
    /"displayPrice"\s*:\s*"([^"]+)"/,
    /data-a-color="price"[^>]*>[\s\S]*?([\d.,]+)\s*€/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const price = parseAmazonPriceText(match[1]);
    if (price !== null) return price;
  }
  return null;
}

function availabilityFromHtml($: cheerio.CheerioAPI): ProductAvailability {
  const availability = $("#availability").text().toLowerCase();
  if (
    availability.includes("no disponible") ||
    availability.includes("agotado") ||
    availability.includes("currently unavailable")
  ) {
    return ProductAvailability.OUT_OF_STOCK;
  }
  if (availability.includes("preventa") || availability.includes("pre-order")) {
    return ProductAvailability.PREORDER;
  }
  return ProductAvailability.IN_STOCK;
}

function listPriceFromPageScripts(html: string): number | null {
  const patterns = [
    /"basisPrice"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)"?/,
    /"basisPriceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
    /"listPrice"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)"?/,
    /"typicalPrice"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)"?/,
    /"wasPrice"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)"?/,
    /"landingAsinPrice"[\s\S]{0,200}?"basisPriceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const price = parseAmazonPriceText(match[1]);
    if (price !== null) return price;
  }
  return null;
}

function discountFromSavingsBadge($: cheerio.CheerioAPI): number | null {
  const selectors = [
    "#corePriceDisplay_desktop_feature_div span.savingsPercentage",
    "#corePrice_feature_div span.savingsPercentage",
    ".savingsPercentage",
    "#dealprice_savingspercentage",
  ];

  for (const selector of selectors) {
    const text = $(selector).first().text();
    const match = text.match(/(\d{1,3})\s*%/);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value) && value > 0 && value < 100) return value;
  }
  return null;
}

function detectFlashDeal($: cheerio.CheerioAPI, html: string): boolean {
  const badgeText = [
    $("#dealBadge_feature_div").text(),
    $("#gatedDealsBadge_feature_div").text(),
    $("[data-feature-name='dealBadge']").text(),
    $(".dealBadge").text(),
    $("#dealBadgeSupportingText").text(),
    $("[id*='dealBadge']").text(),
  ]
    .join(" ")
    .toLowerCase();

  if (
    /oferta\s*flash|lightning\s*deal|oferta\s*rel[aá]mpago|deal of the day|oferta del d[ií]a|precio\s*rel[aá]mpago|ventas\s*r[aá]pidas|oferta\s*con\s*ventas/.test(
      badgeText,
    )
  ) {
    return true;
  }

  if (
    /isLightningDeal["\s:]*true|dealType["\s:]*["']LIGHTNING|lightningDeal|OFERTA\s*FLASH|ventas\s*r[aá]pidas/i.test(
      html,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Precio actual (a pagar) vs referencia (precio recomendado / lista).
 * Evita tomar el «mínimo 30 días» como lista y precios de widgets secundarios.
 */
export function extractPriceFromAmazonHtml(html: string): {
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  isFlashDeal: boolean;
  title?: string;
  brand?: string;
  imageUrl?: string;
  availability: ProductAvailability;
} {
  const $ = cheerio.load(html);

  // Precio a pagar: priorizar buy box (.priceToPay), no acordeones secundarios.
  const payCandidates = collectPricesFromSelectors($, [
    "#corePrice_feature_div .reinventPricePriceToPayMargin.priceToPay span.a-offscreen",
    "#corePriceDisplay_desktop_feature_div .reinventPricePriceToPayMargin.priceToPay span.a-offscreen",
    "#apex_desktop .reinventPricePriceToPayMargin.priceToPay span.a-offscreen",
    "#corePrice_feature_div .apex-pricetopay-value span.a-offscreen",
    "#corePriceDisplay_desktop_feature_div .apex-pricetopay-value span.a-offscreen",
    "#apex_desktop .apex-pricetopay-value span.a-offscreen",
    ".priceToPay span.a-offscreen",
    "#corePrice_feature_div span.a-price:not(.a-text-price) span.a-offscreen",
    "#corePriceDisplay_desktop_feature_div span.a-price:not(.a-text-price) span.a-offscreen",
    "#priceblock_dealprice",
    "#priceblock_saleprice",
    "#priceblock_ourprice",
  ]);
  let price =
    payCandidates[0] ??
    priceFromWholeFraction(
      $,
      "#corePrice_feature_div .reinventPricePriceToPayMargin.priceToPay, #corePriceDisplay_desktop_feature_div .priceToPay, #apex_desktop .apex-pricetopay-value, .priceToPay",
    ) ??
    priceFromPageScripts(html);

  // Lista / precio recomendado: el MÁS ALTO entre tachados del bloque core,
  // excluyendo el mínimo 30 días (.srpPriceBlockAUI).
  const listCandidates = collectPricesFromSelectors($, [
    "#corePrice_feature_div .apex-basisprice-value span.a-offscreen",
    "#corePriceDisplay_desktop_feature_div .apex-basisprice-value span.a-offscreen",
    "#apex_desktop .apex-basisprice-value span.a-offscreen",
    ".basisPrice .a-offscreen",
    "#corePrice_feature_div span.a-price.a-text-price:not(.srpPriceBlockAUI) span.a-offscreen",
    "#corePriceDisplay_desktop_feature_div span.a-price.a-text-price:not(.srpPriceBlockAUI) span.a-offscreen",
    "#apex_desktop span.a-price.a-text-price:not(.srpPriceBlockAUI) span.a-offscreen",
    'span.a-price.a-text-price[data-a-strike="true"]:not(.srpPriceBlockAUI) span.a-offscreen',
    "#listPrice",
  ]);
  const scriptList = listPriceFromPageScripts(html);
  if (scriptList !== null && !listCandidates.includes(scriptList)) {
    listCandidates.push(scriptList);
  }

  const badgeDiscount = discountFromSavingsBadge($);
  let listPrice =
    listCandidates.length > 0 ? Math.max(...listCandidates) : null;

  // Si la lista no cuadra con el badge (−21% etc.), preferir la candidata DOM que sí.
  if (price !== null && badgeDiscount !== null && listCandidates.length > 0) {
    const impliedList =
      Math.round((price / (1 - badgeDiscount / 100)) * 100) / 100;
    let best: number | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const candidate of listCandidates) {
      if (candidate <= price) continue;
      const pct = ((candidate - price) / candidate) * 100;
      const delta = Math.abs(pct - badgeDiscount);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate;
      }
    }
    if (best !== null && bestDelta <= 6) {
      listPrice = Math.round(best * 100) / 100;
    } else if (impliedList > price) {
      listPrice = impliedList;
    }
  } else if (
    (listPrice === null || (price !== null && listPrice <= price)) &&
    price !== null &&
    badgeDiscount !== null
  ) {
    const reconstructed =
      Math.round((price / (1 - badgeDiscount / 100)) * 100) / 100;
    if (reconstructed > price) listPrice = reconstructed;
  }

  if (listPrice !== null && price !== null && listPrice <= price) {
    listPrice = null;
  }

  let discountPercentage: number | null = null;
  if (price !== null && listPrice !== null && listPrice > price) {
    discountPercentage =
      Math.round(((listPrice - price) / listPrice) * 10000) / 100;
  } else if (badgeDiscount !== null) {
    discountPercentage = badgeDiscount;
  }

  const isFlashDeal =
    detectFlashDeal($, html) ||
    (discountPercentage !== null &&
      discountPercentage >= 20 &&
      listPrice !== null);

  const title =
    $("#productTitle").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    undefined;

  const brandRaw =
    $("#bylineInfo").text().trim() ||
    $("#brand").text().trim() ||
    $("a#brand").text().trim() ||
    $("tr.po-brand td.a-span9 span").text().trim() ||
    $("th:contains('Marca')").next("td").text().trim() ||
    "";
  const brand =
    brandRaw
      .replace(/^visita la tienda de\s+/i, "")
      .replace(/^marca:\s*/i, "")
      .replace(/^brand:\s*/i, "")
      .trim() || undefined;

  let imageUrl: string | undefined =
    $("#landingImage").attr("data-old-hires") ||
    $("#imgTagWrapperId img").attr("data-old-hires") ||
    $("#landingImage").attr("src") ||
    $("#imgTagWrapperId img").attr("src") ||
    $("meta[property='og:image']").attr("content")?.trim() ||
    $("img#main-image").attr("src") ||
    undefined;

  const dynamicImage = $("#landingImage").attr("data-a-dynamic-image");
  if ((!imageUrl || imageUrl.startsWith("data:")) && dynamicImage) {
    try {
      const map = JSON.parse(dynamicImage) as Record<string, unknown>;
      const first = Object.keys(map)[0];
      if (first && /^https?:\/\//i.test(first)) imageUrl = first;
    } catch {
      const match = dynamicImage.match(/"(https:[^"]+)"/);
      if (match?.[1]) imageUrl = match[1];
    }
  }

  const cleanImageUrl =
    imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined;
  const cleanBrand = brand && brand.length > 1 ? brand.slice(0, 120) : undefined;

  return {
    price,
    listPrice,
    discountPercentage,
    isFlashDeal,
    title,
    brand: cleanBrand,
    imageUrl: cleanImageUrl,
    availability: availabilityFromHtml($),
  };
}

async function fetchAmazonPageHtml(
  url: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: BROWSER_HEADERS,
      signal: controller.signal,
      redirect: "follow",
    });

    if (response.status === 503 || response.status === 429) {
      throw new Error(
        `Amazon temporalmente no disponible (HTTP ${response.status}).`,
      );
    }

    if (!response.ok) {
      throw new Error(`Respuesta HTTP ${response.status} al consultar Amazon.`);
    }

    const html = await response.text();

    if (
      html.includes("api-services-support@amazon.com") ||
      html.includes("Enter the characters you see below") ||
      html.toLowerCase().includes("robot check")
    ) {
      throw new Error("Amazon devolvió un challenge anti-bot (bloqueado).");
    }

    return html;
  } finally {
    clearTimeout(timer);
  }
}

/** @deprecated Usar fetchAmazonPageHtml */
async function fetchAmazonProductHtml(
  url: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<string> {
  return fetchAmazonPageHtml(url, options);
}

export { fetchAmazonPageHtml };

/** Prefill admin: título/precio/lista sin exigir precio válido. */
export async function previewAmazonProductPage(
  urlOrAsin: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{
  asin: string;
  title?: string;
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  isFlashDeal: boolean;
  amazonUrl: string;
  availability: ProductAvailability;
  brand?: string;
  imageUrl?: string;
}> {
  const asin =
    extractAsin(urlOrAsin)?.toUpperCase() ||
    (/^[A-Z0-9]{10}$/i.test(urlOrAsin.trim())
      ? urlOrAsin.trim().toUpperCase()
      : null);

  if (!asin) {
    throw new Error("URL o ASIN de Amazon no válidos.");
  }

  const preferred =
    urlOrAsin.includes("http") && extractAsin(urlOrAsin) ? urlOrAsin.trim() : undefined;
  const amazonUrl = amazonEsProductUrl(asin, preferred);

  const html = await fetchAmazonPageHtml(amazonUrl, options);
  const extracted = extractPriceFromAmazonHtml(html);

  return {
    asin,
    title: extracted.title,
    price: extracted.price,
    listPrice: extracted.listPrice,
    discountPercentage: extracted.discountPercentage,
    isFlashDeal: extracted.isFlashDeal,
    amazonUrl,
    availability: extracted.availability,
    brand: extracted.brand,
    imageUrl: extracted.imageUrl,
  };
}

export async function scrapeAmazonProductPage(
  url: string,
  asin: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<ProductPriceData> {
  const amazonUrl = amazonEsProductUrl(asin, url);
  const html = await fetchAmazonPageHtml(amazonUrl, options);
  const extracted = extractPriceFromAmazonHtml(html);

  if (extracted.price === null) {
    throw new Error("No se pudo extraer el precio del HTML de Amazon.");
  }

  return {
    asin,
    price: extracted.price,
    currency: "EUR",
    availability: extracted.availability,
    title: extracted.title,
    brand: extracted.brand,
    imageUrl: extracted.imageUrl,
    amazonUrl,
    previousPrice: extracted.listPrice ?? undefined,
    discountPercentage: extracted.discountPercentage ?? undefined,
  };
}

/**
 * Proveedor de precios vía HTML de la ficha de Amazon.
 * Frágil frente a cambios de maqueta / bloqueos: preferir PA-API o Keepa a medio plazo.
 */
export class AmazonHtmlPriceProvider implements PriceProvider {
  private readonly urlByAsin: Map<string, string>;
  private readonly delayMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AmazonHtmlPriceProviderOptions = {}) {
    this.urlByAsin = options.urlByAsin ?? new Map();
    this.delayMs = options.delayMs ?? 1_250;
    this.timeoutMs = options.timeoutMs ?? 12_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getProduct(asin: string): Promise<ProductPriceData> {
    const url = this.urlByAsin.get(asin) ?? generateAmazonUrl(asin);
    return scrapeAmazonProductPage(url, asin, {
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
    });
  }

  async getProducts(asins: string[]): Promise<ProductPriceData[]> {
    const results: ProductPriceData[] = [];

    for (let index = 0; index < asins.length; index += 1) {
      const asin = asins[index];
      try {
        const quote = await this.getProduct(asin);
        results.push(quote);
      } catch (error) {
        console.warn(
          `[AmazonHtmlPriceProvider] ASIN ${asin}:`,
          error instanceof Error ? error.message : error,
        );
      }

      if (index < asins.length - 1 && this.delayMs > 0) {
        await sleep(this.delayMs);
      }
    }

    return results;
  }
}
