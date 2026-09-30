import { roundMoney } from "@/lib/money";
import {
  extractMediaMarktProductId,
  normalizeMediaMarktProductUrl,
} from "@/lib/retailers";
import {
  pricesFromFeature,
  readApolloEntity,
  toPrice,
  type ApolloOnlineStatus,
  type ApolloPriceFeature,
} from "@/providers/retail/mediamarkt/mediamarktApollo";
import type { MediaMarktProductQuote } from "@/providers/retail/mediamarkt/types";

const MEDIAMARKT_ORIGIN = "https://www.mediamarkt.es";

/**
 * MediaMarkt sirve la ficha renderizada en servidor y sin reto anti-bot para
 * un fetch normal: basta HTML + estado Apollo embebido (sin navegador).
 */
export async function fetchMediaMarktHtml(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 18_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        Referer: `${MEDIAMARKT_ORIGIN}/`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
      },
    });
    if (response.status === 404 || response.status === 410) {
      throw new Error(`MediaMarkt: producto no encontrado (HTTP ${response.status}).`);
    }
    if (!response.ok) {
      throw new Error(`MediaMarkt HTTP ${response.status} para ${url}`);
    }
    const html = await response.text();
    if (/<title>\s*(just a moment|un momento)/i.test(html)) {
      throw new Error("MediaMarkt bloqueó la petición (Cloudflare anti-bot).");
    }
    return { html, finalUrl: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

interface JsonLdProduct {
  name?: string;
  description?: string;
  sku?: string;
  gtin13?: string;
  image?: string | string[];
  brand?: string | { name?: string };
  offers?: { price?: number | string; availability?: string } | Array<{
    price?: number | string;
    availability?: string;
  }>;
}

/** El JSON-LD de la ficha es un `BuyAction` con el `Product` en `object`. */
function readJsonLdProduct(html: string, externalId: string): JsonLdProduct | null {
  const blocks = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1] ?? "") as Record<string, unknown>;
      const candidate =
        parsed["@type"] === "Product"
          ? parsed
          : (parsed.object as Record<string, unknown> | undefined);
      if (candidate?.["@type"] !== "Product") continue;
      const product = candidate as JsonLdProduct;
      if (product.sku && product.sku !== externalId) continue;
      return product;
    } catch {
      // bloque JSON-LD mal formado: se ignora
    }
  }
  return null;
}

export async function scrapeMediaMarktProductPage(
  urlOrId: string,
  options: { timeoutMs?: number } = {},
): Promise<MediaMarktProductQuote> {
  const externalId = extractMediaMarktProductId(urlOrId);
  if (!externalId || !/^https?:\/\//i.test(urlOrId.trim())) {
    throw new Error(
      "Se requiere la URL completa del producto MediaMarkt (…/es/product/…-1234567.html).",
    );
  }
  const productUrl = normalizeMediaMarktProductUrl(urlOrId);
  const { html, finalUrl } = await fetchMediaMarktHtml(productUrl, options);
  // Fichas retiradas (p. ej. ofertas de marketplace) redirigen a otro
  // producto: su página aún trae el precio del id pedido en recomendaciones,
  // así que sin esta comprobación se guardarían datos de otro producto.
  const servedId = extractMediaMarktProductId(finalUrl);
  if (servedId && servedId !== externalId) {
    throw new Error(
      `MediaMarkt: producto no encontrado (la ficha ${externalId} redirige a ${servedId}).`,
    );
  }

  // Estado Apollo: ids «Media:es:<id>». Sin el id exacto se colaría el precio
  // de un producto recomendado en la misma página.
  const apolloId = `Media:es:${externalId}`;
  const priceFeature = readApolloEntity<ApolloPriceFeature>(
    html,
    "CofrPriceFeature",
    apolloId,
  );
  const onlineStatus = readApolloEntity<ApolloOnlineStatus>(
    html,
    "CofrOnlineStatusFeature",
    apolloId,
  );
  const jsonLd = readJsonLdProduct(html, externalId);
  const offer = Array.isArray(jsonLd?.offers) ? jsonLd?.offers[0] : jsonLd?.offers;

  const fromApollo = pricesFromFeature(priceFeature);
  const price = fromApollo.price ?? toPrice(offer?.price);
  const listPrice = fromApollo.price != null ? fromApollo.listPrice : null;

  let availability: MediaMarktProductQuote["availability"] = "UNKNOWN";
  if (onlineStatus) {
    availability = onlineStatus.isAvailableAndBuyable ? "IN_STOCK" : "OUT_OF_STOCK";
  } else if (offer?.availability) {
    availability = /InStock/i.test(offer.availability) ? "IN_STOCK" : "OUT_OF_STOCK";
  } else if (price != null) {
    availability = "IN_STOCK";
  }

  const image = Array.isArray(jsonLd?.image) ? jsonLd?.image[0] : jsonLd?.image;
  const brand =
    typeof jsonLd?.brand === "string" ? jsonLd.brand : jsonLd?.brand?.name;
  const ogTitle = html
    .match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)?.[1]
    ?.replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");

  return {
    externalId,
    productUrl,
    title: jsonLd?.name?.trim() || ogTitle?.trim() || `Producto MediaMarkt ${externalId}`,
    brand: brand?.trim() || undefined,
    description: jsonLd?.description?.trim() || undefined,
    imageUrl: image || undefined,
    gtin: jsonLd?.gtin13 || undefined,
    price,
    listPrice,
    discountPercentage:
      price != null && listPrice != null
        ? roundMoney(((listPrice - price) / listPrice) * 100)
        : null,
    availability,
    marketplaceSeller: priceFeature?.marketplaceSeller?.sellerName ?? null,
  };
}
