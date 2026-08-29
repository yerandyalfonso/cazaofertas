import * as cheerio from "cheerio";
import { roundMoney } from "@/lib/money";
import {
  extractKiabiProductId,
  isKiabiProductUrl,
  normalizeKiabiProductUrl,
} from "@/lib/retailers";
import { parseAmazonPriceText } from "@/providers/price";
import {
  fetchKiabiHtml,
  parseKiabiPromoPricePair,
} from "@/providers/retail/kiabi/kiabiDiscovery";
import type { KiabiProductQuote } from "@/providers/retail/kiabi/types";

function parseKiabiNextDataProduct(
  html: string,
): Partial<KiabiProductQuote> | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) return null;

  try {
    const data = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          queryResponse?: {
            product?: {
              display?: {
                price?: {
                  salePrice?: number;
                  listPrice?: number;
                };
                promotion?: {
                  discountPercentage?: number;
                };
              };
              label?: string;
              description?: string;
              longDescription?: string;
              images?: Array<{ url?: string }>;
            };
          };
        };
      };
    };

    const product = data.props?.pageProps?.queryResponse?.product;
    const display = product?.display;
    const priceBlock = display?.price;
    if (!priceBlock?.salePrice) return null;

    const salePrice = roundMoney(priceBlock.salePrice);
    const listPrice =
      priceBlock.listPrice != null && priceBlock.listPrice > salePrice
        ? roundMoney(priceBlock.listPrice)
        : null;

    return {
      title: product?.label?.trim(),
      description:
        product?.description?.trim() ||
        product?.longDescription?.trim() ||
        undefined,
      imageUrl: product?.images?.[0]?.url,
      price: salePrice,
      listPrice,
      discountPercentage:
        display?.promotion?.discountPercentage ??
        (listPrice != null ? computeDiscount(salePrice, listPrice) : null),
    };
  } catch {
    return null;
  }
}

function parseJsonLdProduct(html: string): Partial<KiabiProductQuote> | null {
  const $ = cheerio.load(html);
  let best: Partial<KiabiProductQuote> | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const type = String(record["@type"] ?? "");
        if (!type.includes("Product")) continue;

        const offers = record.offers;
        const offer = Array.isArray(offers) ? offers[0] : offers;
        const offerRecord =
          offer && typeof offer === "object"
            ? (offer as Record<string, unknown>)
            : null;

        const priceRaw =
          offerRecord?.price ??
          offerRecord?.lowPrice ??
          record.price;
        const price =
          typeof priceRaw === "number"
            ? roundMoney(priceRaw)
            : parseAmazonPriceText(String(priceRaw ?? ""));

        const image = record.image;
        const imageUrl = Array.isArray(image)
          ? String(image[0] ?? "")
          : typeof image === "string"
            ? image
            : undefined;

        best = {
          title: typeof record.name === "string" ? record.name : undefined,
          description:
            typeof record.description === "string"
              ? record.description.trim()
              : undefined,
          brand:
            typeof record.brand === "string"
              ? record.brand
              : typeof record.brand === "object" &&
                  record.brand &&
                  "name" in (record.brand as object)
                ? String((record.brand as { name?: string }).name ?? "")
                : undefined,
          imageUrl: imageUrl || undefined,
          price: price ?? null,
          listPrice: null,
        };
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  });

  return best;
}

function parseKiabiPricesFromHtml(html: string): {
  price: number | null;
  listPrice: number | null;
} {
  const $ = cheerio.load(html);

  const mainPriceContainer = $(
    '[data-testid="productPage_div_priceContainer"], .productInformation_productInfosPriceContainer__tGysW',
  ).first();

  if (mainPriceContainer.length > 0) {
    const promoText = mainPriceContainer.find('[class*="pricePromo"]').first().text();
    const overrideText = mainPriceContainer
      .find('[class*="priceOverride"]')
      .first()
      .text();
    const parsed = parseKiabiPromoPricePair(
      promoText || mainPriceContainer.text(),
      overrideText || undefined,
    );
    if (parsed.price != null) {
      return {
        price: parsed.price,
        listPrice: parsed.listPrice ?? null,
      };
    }
  }

  const fallbackText =
    mainPriceContainer.length > 0
      ? mainPriceContainer.text()
      : $("body").text();
  const singleMatch = fallbackText.match(/(\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*€/);
  const single = singleMatch?.[1]
    ? parseAmazonPriceText(singleMatch[1])
    : null;
  return { price: single, listPrice: null };
}

function computeDiscount(
  price: number,
  listPrice: number | null,
): number | null {
  if (listPrice == null || listPrice <= price) return null;
  return roundMoney(((listPrice - price) / listPrice) * 100);
}

export async function scrapeKiabiProductPage(
  urlOrId: string,
  options: { timeoutMs?: number } = {},
): Promise<KiabiProductQuote> {
  const trimmed = urlOrId.trim();
  if (!isKiabiProductUrl(trimmed)) {
    throw new Error(
      "Se requiere la URL completa del producto Kiabi (con _P…C… en la ruta).",
    );
  }

  const productUrl = normalizeKiabiProductUrl(trimmed);
  const externalId = extractKiabiProductId(productUrl);
  if (!externalId) {
    throw new Error("No se pudo extraer el ID Kiabi de la URL.");
  }

  const html = await fetchKiabiHtml(productUrl, {
    ...options,
    referer: "https://www.kiabi.es/promociones_464410",
  });
  const $ = cheerio.load(html);

  const nextData = parseKiabiNextDataProduct(html) ?? {};
  const jsonLd = parseJsonLdProduct(html) ?? {};
  const htmlPrices = parseKiabiPricesFromHtml(html);

  const price = nextData.price ?? jsonLd.price ?? htmlPrices.price;
  const listPrice =
    nextData.listPrice ??
    jsonLd.listPrice ??
    (htmlPrices.listPrice != null && htmlPrices.listPrice > (price ?? 0)
      ? htmlPrices.listPrice
      : null);

  const title =
    nextData.title?.trim() ||
    jsonLd.title?.trim() ||
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    `Producto Kiabi ${externalId}`;

  const imageUrl =
    nextData.imageUrl ||
    jsonLd.imageUrl ||
    $("meta[property='og:image']").attr("content")?.trim() ||
    $("img[src*='static.kiabi']").first().attr("src")?.trim() ||
    undefined;

  const description =
    nextData.description?.trim() ||
    jsonLd.description?.trim() ||
    $("meta[property='og:description']").attr("content")?.trim() ||
    $("meta[name='description']").attr("content")?.trim() ||
    undefined;

  const discountPercentage =
    price != null ? computeDiscount(price, listPrice) : null;

  return {
    externalId,
    productUrl,
    title,
    brand: jsonLd.brand?.trim() || "Kiabi",
    description: description || undefined,
    imageUrl,
    price,
    listPrice,
    discountPercentage,
    availability: price == null ? "UNKNOWN" : "IN_STOCK",
  };
}

export function hasRealKiabiDiscount(quote: KiabiProductQuote): boolean {
  if (quote.price == null) return false;
  if (quote.listPrice != null && quote.listPrice > quote.price) return true;
  return (quote.discountPercentage ?? 0) > 0;
}
