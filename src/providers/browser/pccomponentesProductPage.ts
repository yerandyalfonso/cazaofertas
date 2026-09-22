import { withBrowserPage } from "@/providers/browser/launch";
import {
  extractOfferPrice,
  findProductJsonLd,
  readJsonLdBlocks,
} from "@/providers/browser/jsonLdProduct";

export interface PcComponentesProductQuote {
  productUrl: string;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
  price: number | null;
  listPrice: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
}

/**
 * Solo viable desde IP residencial: Cloudflare Turnstile bloquea la petición
 * (incluso con navegador headless real) cuando llega desde una IP de
 * datacenter. Debe ejecutarse desde el cron local (Mac), nunca desde el VPS.
 */
export async function scrapePcComponentesProductPage(
  url: string,
  options?: { timeoutMs?: number },
): Promise<PcComponentesProductQuote> {
  return withBrowserPage(async (page) => {
    const resp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: options?.timeoutMs ?? 20_000,
    });
    if (resp && resp.status() >= 400) {
      throw new Error(`PcComponentes HTTP ${resp.status()} para ${url}`);
    }
    await page.waitForTimeout(3_000);

    const title = await page.title();
    if (/just a moment/i.test(title)) {
      throw new Error("PcComponentes: bloqueado por Cloudflare (challenge sin resolver).");
    }

    const blocks = await readJsonLdBlocks(page);
    const product = findProductJsonLd(blocks);
    if (!product) {
      throw new Error("PcComponentes: no se encontró ficha de producto.");
    }

    const { price, listPrice, availability } = extractOfferPrice(product.offers);
    const brand =
      typeof product.brand === "string" ? product.brand : product.brand?.name ?? null;
    const imageUrl = Array.isArray(product.image)
      ? product.image[0] ?? null
      : product.image ?? null;

    return {
      productUrl: url,
      title: product.name ?? title.replace(/\s*\|\s*PcComponentes.*$/i, "") ?? null,
      brand,
      imageUrl,
      price,
      listPrice,
      availability,
    };
  });
}
