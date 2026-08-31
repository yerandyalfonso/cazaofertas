import {
  isRetailBlockedError,
  titleFromProductSlug,
} from "@/lib/retail-url-utils";
import {
  detectRetailerFromUrl,
  extractExternalId,
  extractKiabiProductId,
  getRetailerDefinition,
  isProductRetailer,
  normalizeKiabiProductUrl,
  retailerScrapeSupported,
  syntheticAsinForRetailer,
  type ProductRetailer,
} from "@/lib/retailers";
import { roundMoney } from "@/lib/money";
import { previewAmazonProductPage } from "@/providers/price";
import { scrapeKiabiProductPage } from "@/providers/retail/kiabi";
import { scrapeMiraviaProductPage } from "@/providers/retail/miravia";

export interface ProductPagePreview {
  retailer: ProductRetailer;
  externalId: string;
  asin: string;
  title: string | null;
  brand: string | null;
  price: number | null;
  listPrice: number | null;
  referencePrice: number | null;
  discountPercentage: number | null;
  productUrl: string;
  imageUrl: string | null;
  categorySlug: string | null;
  breadcrumbs: string[];
  description?: string | null;
  partial?: boolean;
  warning?: string | null;
}

function resolveRetailer(
  input: string,
  retailerHint?: string,
): ProductRetailer {
  if (retailerHint && isProductRetailer(retailerHint)) {
    return retailerHint;
  }

  const detected = detectRetailerFromUrl(input);
  if (detected) return detected;

  if (extractExternalId("amazon", input)) return "amazon";

  throw new Error(
    "No se reconoce la tienda. Selecciónala en el desplegable o pega una URL válida.",
  );
}

function buildKiabiFallback(input: string): ProductPagePreview {
  const productUrl = /^https?:\/\//i.test(input)
    ? normalizeKiabiProductUrl(input)
    : input;
  const externalId = extractKiabiProductId(productUrl) ?? extractKiabiProductId(input);
  if (!externalId) {
    throw new Error("No se pudo extraer el ID Kiabi de la URL.");
  }

  return {
    retailer: "kiabi",
    externalId,
    asin: syntheticAsinForRetailer("kiabi", externalId),
    title: titleFromProductSlug(productUrl),
    brand: "Kiabi",
    price: null,
    listPrice: null,
    referencePrice: null,
    discountPercentage: null,
    productUrl,
    imageUrl: null,
    categorySlug: "moda",
    breadcrumbs: [],
    partial: true,
    warning:
      "Kiabi bloqueó el servidor (DataDome). Rellenamos título/ID desde la URL; completa precios manualmente o usa el cron local en Mac.",
  };
}

export async function previewProductPage(
  input: string,
  options: { retailer?: ProductRetailer; timeoutMs?: number } = {},
): Promise<ProductPagePreview> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Indica la URL del producto o su identificador.");
  }

  const retailer = resolveRetailer(trimmed, options.retailer);
  const definition = getRetailerDefinition(retailer);

  if (!retailerScrapeSupported(retailer)) {
    throw new Error(
      `${definition.label} aún no tiene extracción automática. Rellena título y precios manualmente.`,
    );
  }

  if (retailer === "amazon") {
    const preview = await previewAmazonProductPage(trimmed, {
      timeoutMs: options.timeoutMs ?? 18_000,
    });
    const externalId = preview.asin;

    return {
      retailer: "amazon",
      externalId,
      asin: externalId,
      title: preview.title ?? null,
      brand: preview.brand ?? null,
      price: preview.price,
      listPrice: preview.listPrice,
      referencePrice: preview.listPrice ?? preview.price,
      discountPercentage: preview.discountPercentage,
      productUrl: preview.amazonUrl,
      imageUrl: preview.imageUrl ?? null,
      categorySlug: preview.categorySlug ?? null,
      breadcrumbs: preview.breadcrumbs ?? [],
    };
  }

  if (retailer === "kiabi") {
    try {
      const quote = await scrapeKiabiProductPage(trimmed, {
        timeoutMs: options.timeoutMs ?? 18_000,
      });

      return {
        retailer: "kiabi",
        externalId: quote.externalId,
        asin: syntheticAsinForRetailer("kiabi", quote.externalId),
        title: quote.title,
        brand: quote.brand ?? "Kiabi",
        price: quote.price,
        listPrice: quote.listPrice,
        referencePrice: quote.listPrice ?? quote.price,
        discountPercentage: quote.discountPercentage,
        productUrl: quote.productUrl,
        imageUrl: quote.imageUrl ?? null,
        categorySlug: "moda",
        breadcrumbs: [],
        description: quote.description ?? null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isRetailBlockedError(message)) {
        return buildKiabiFallback(trimmed);
      }
      throw error;
    }
  }

  if (retailer === "miravia") {
    const quote = await scrapeMiraviaProductPage(trimmed, {
      timeoutMs: options.timeoutMs ?? 18_000,
    });
    const discount =
      quote.price != null &&
      quote.listPrice != null &&
      quote.listPrice > quote.price
        ? roundMoney(
            ((quote.listPrice - quote.price) / quote.listPrice) * 100,
          )
        : quote.discountPercentage;

    return {
      retailer: "miravia",
      externalId: quote.externalId,
      asin: syntheticAsinForRetailer("miravia", quote.externalId),
      title: quote.title,
      brand: quote.brand ?? "Miravia",
      price: quote.price,
      listPrice: quote.listPrice,
      referencePrice: quote.listPrice ?? quote.price,
      discountPercentage: discount,
      productUrl: quote.productUrl,
      imageUrl: quote.imageUrl ?? null,
      categorySlug: null,
      breadcrumbs: [],
      partial: quote.price == null,
      warning:
        quote.price == null
          ? "Miravia: no se pudo leer el precio de la ficha; completa manualmente."
          : null,
    };
  }

  throw new Error(`Extracción no implementada para ${definition.label}.`);
}
