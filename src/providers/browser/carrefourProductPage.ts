import { withBrowserPage } from "@/providers/browser/launch";
import {
  extractOfferPrice,
  findProductJsonLd,
  readJsonLdBlocks,
} from "@/providers/browser/jsonLdProduct";

export interface CarrefourProductQuote {
  productUrl: string;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
  price: number | null;
  listPrice: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
}

export async function scrapeCarrefourProductPage(
  url: string,
  options?: { timeoutMs?: number },
): Promise<CarrefourProductQuote> {
  return withBrowserPage(async (page) => {
    const resp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options?.timeoutMs ?? 20_000,
    });
    if (resp && resp.status() >= 400) {
      throw new Error(`Carrefour HTTP ${resp.status()} para ${url}`);
    }
    await page.waitForTimeout(2_500);

    const blocks = await readJsonLdBlocks(page);
    const product = findProductJsonLd(blocks);
    if (!product) {
      throw new Error("Carrefour: no se encontró ficha de producto (bloqueo o URL inválida).");
    }

    const { price, listPrice, availability } = extractOfferPrice(product.offers);
    const brand =
      typeof product.brand === "string" ? product.brand : product.brand?.name ?? null;
    const imageUrl = Array.isArray(product.image)
      ? product.image[0] ?? null
      : product.image ?? null;

    return {
      productUrl: url,
      title: product.name ?? null,
      brand,
      imageUrl,
      price,
      listPrice,
      availability,
    };
  });
}
