import type { Page } from "playwright";
import { roundMoney } from "@/lib/money";
import { normalizePcComponentesProductUrl } from "@/lib/retailers";
import { withHeadedChromePage } from "@/providers/browser/headedChrome";
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

/** Cloudflare muestra «Un momento…» mientras resuelve el reto (unos segundos). */
async function waitForCloudflare(page: Page, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (/just a moment|un momento/i.test(await page.title())) {
    if (Date.now() > deadline) {
      throw new Error("PcComponentes: bloqueado por Cloudflare (challenge sin resolver).");
    }
    await page.waitForTimeout(1_000);
  }
}

function parseEuroText(raw: string | null | undefined): number | null {
  const match = raw?.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*€/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? roundMoney(value) : null;
}

/**
 * Cloudflare bloquea la ficha con `fetch` y con Chromium headless (incluso
 * desde IP residencial; los listados sí cargan): se abre con Google Chrome
 * con ventana, como Carrefour. Solo funciona en el Mac (alertas
 * residenciales), nunca en el VPS.
 */
export async function scrapePcComponentesProductPage(
  url: string,
  options?: { timeoutMs?: number },
): Promise<PcComponentesProductQuote> {
  const productUrl = normalizePcComponentesProductUrl(url);
  const timeoutMs = Math.max(options?.timeoutMs ?? 0, 30_000);

  return withHeadedChromePage(async (page) => {
    const resp = await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
      referer: "https://www.pccomponentes.com/",
    });
    await waitForCloudflare(page, 15_000);
    const status = resp?.status() ?? 0;
    if (status === 404 || status === 410) {
      throw new Error(`PcComponentes: producto no encontrado (HTTP ${status}).`);
    }

    // El JSON-LD va en `microdata-product-script` (con `@type: "product"` en
    // minúsculas); en fichas con variantes hay además un `ProductGroup`.
    const product = findProductJsonLd(await readJsonLdBlocks(page));
    if (!product) {
      throw new Error("PcComponentes: no se encontró ficha de producto.");
    }

    const { price, availability } = extractOfferPrice(product.offers);
    // Tachado: «PVPR 749,99€» junto al precio (no está en el JSON-LD).
    const referenceText = await page
      .locator("#pdp-price-original")
      .first()
      .textContent({ timeout: 2_000 })
      .catch(() => null);
    const reference = parseEuroText(referenceText);
    const brand =
      typeof product.brand === "string" ? product.brand : product.brand?.name ?? null;
    const imageUrl = Array.isArray(product.image)
      ? product.image[0] ?? null
      : product.image ?? null;
    const title = await page.title();

    return {
      productUrl,
      title: product.name?.trim() || title.replace(/\s*\|\s*PcComponentes.*$/i, "") || null,
      brand,
      imageUrl,
      price: price != null ? roundMoney(price) : null,
      listPrice: price != null && reference != null && reference > price ? reference : null,
      availability,
    };
  });
}
