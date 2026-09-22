import type { Page } from "playwright";

export interface JsonLdOffer {
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
}

export interface JsonLdProduct {
  "@type"?: string;
  name?: string;
  image?: string | string[];
  brand?: { name?: string } | string;
  offers?: JsonLdOffer | { offers?: JsonLdOffer; lowPrice?: string; highPrice?: string };
}

/** Lee todos los bloques `<script type="application/ld+json">` de la página. */
export async function readJsonLdBlocks(page: Page): Promise<unknown[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((el) => {
        try {
          return JSON.parse(el.textContent ?? "");
        } catch {
          return null;
        }
      })
      .filter((v) => v !== null),
  );
}

/** Primer bloque JSON-LD de tipo Product (case-insensitive). */
export function findProductJsonLd(blocks: unknown[]): JsonLdProduct | null {
  for (const block of blocks) {
    if (
      block &&
      typeof block === "object" &&
      "@type" in block &&
      String((block as JsonLdProduct)["@type"]).toLowerCase() === "product"
    ) {
      return block as JsonLdProduct;
    }
  }
  return null;
}

export function extractOfferPrice(offers: JsonLdProduct["offers"]): {
  price: number | null;
  listPrice: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
} {
  if (!offers) return { price: null, listPrice: null, availability: "UNKNOWN" };

  const nested =
    "offers" in offers && offers.offers ? offers.offers : (offers as JsonLdOffer);
  const price = nested?.price != null ? Number(nested.price) : null;
  const lowPrice =
    "lowPrice" in offers && offers.lowPrice != null ? Number(offers.lowPrice) : null;
  const highPrice =
    "highPrice" in offers && offers.highPrice != null ? Number(offers.highPrice) : null;

  const availabilityRaw = nested?.availability?.toLowerCase() ?? "";
  const availability = availabilityRaw.includes("instock")
    ? "IN_STOCK"
    : availabilityRaw.includes("outofstock") || availabilityRaw.includes("soldout")
      ? "OUT_OF_STOCK"
      : "UNKNOWN";

  return {
    price: Number.isFinite(price) ? price : Number.isFinite(lowPrice) ? lowPrice : null,
    listPrice: Number.isFinite(highPrice) && highPrice !== price ? highPrice : null,
    availability,
  };
}
