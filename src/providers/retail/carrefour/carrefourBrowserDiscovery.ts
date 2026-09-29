import type { Browser, Page } from "playwright";
import { isCarrefourFoodContext } from "@/lib/carrefour-category";
import { roundMoney } from "@/lib/money";
import { normalizeCarrefourProductUrl } from "@/providers/retail/carrefour/carrefourHttp";

const CARREFOUR_ORIGIN = "https://www.carrefour.es";
const PAGE_SIZE = 24;

/**
 * Listados no alimentación con muchas rebajas. Configurable con
 * CARREFOUR_BROWSER_FEED_URLS (separadas por comas).
 */
export const DEFAULT_CARREFOUR_BROWSER_FEED_URLS = [
  "https://www.carrefour.es/exclusivo-online/cat28650681/c",
] as const;

/** Producto tal cual lo trae `__INITIAL_STATE__.plp.results.items` del listado. */
interface CarrefourPlpItem {
  product_id?: string;
  sku_id?: string;
  name?: string;
  brand?: string;
  ean?: string;
  url?: string;
  price?: string;
  strikethrough_price?: string;
  /** Precio de la siguiente oferta (otro vendedor o Carrefour). */
  next_price?: string;
  catalog?: string;
  document_type?: string;
  seller_id?: string;
  seller_name?: string;
  units_in_stock?: number;
  parent_category?: { id?: string; name?: string };
  images?: { desktop?: string; mobile?: string };
}

export interface CarrefourListingItem {
  /** `VC4A-…` (mismo id que extrae `extractCarrefourProductId` de la URL). */
  externalId: string;
  skuId?: string;
  productUrl: string;
  sourceUrl: string;
  title: string;
  brand?: string;
  ean?: string;
  imageUrl?: string;
  price: number;
  listPrice: number | null;
  discountPercentage: number;
  sellerName?: string;
  /** Vendedor externo del marketplace (no Carrefour). */
  isMarketplace: boolean;
  unitsInStock?: number;
  categoryName?: string;
}

export interface CarrefourBrowserDiscoveryResult {
  items: CarrefourListingItem[];
  pagesFetched: number;
  feedErrors: Array<{ url: string; message: string }>;
}

/** Formato Carrefour: "1.299 €", "1.299,99 €", "455,98 €" (punto = miles). */
export function parseEuro(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d,]/g, "").replace(",", ".");
  const value = Number(digits);
  return digits && Number.isFinite(value) && value > 0 ? roundMoney(value) : null;
}

function upgradeImageUrl(url: string | undefined): string | undefined {
  // Las miniaturas del listado son `hd_350x_`; la ficha usa `hd_510x_`.
  return url?.replace(/\/hd_\d+x_\//, "/hd_510x_/");
}

/**
 * Precio tachado creíble, o null.
 * - Muchos vendedores del marketplace tachan precio × 1,2 (el «precio con
 *   IVA» sobre su precio) y sale un falso −16,67 %: se descarta.
 * - Vendedor externo: si otra oferta del mismo producto (`next_price`) está
 *   por debajo de su tachado, la referencia real es esa otra oferta.
 */
export function resolveListPrice(
  price: number,
  strike: number | null,
  nextPrice: number | null,
  isMarketplace: boolean,
): number | null {
  if (strike == null || strike <= price) return null;
  if (Math.abs(strike - price * 1.2) <= 0.02) return null;

  const reference =
    isMarketplace && nextPrice != null && nextPrice > price && nextPrice < strike
      ? nextPrice
      : strike;
  return reference > price ? roundMoney(reference) : null;
}

export function listingItemFromPlp(
  raw: CarrefourPlpItem,
  sourceUrl: string,
): CarrefourListingItem | null {
  const externalId = raw.product_id?.trim().toUpperCase();
  const title = raw.name?.replace(/\s+/g, " ").trim();
  const price = parseEuro(raw.price);
  if (!externalId || !title || !raw.url || price == null) return null;
  if (raw.catalog && raw.catalog !== "nonFood") return null;

  const productUrl = normalizeCarrefourProductUrl(
    new URL(raw.url, CARREFOUR_ORIGIN).toString(),
  );
  if (
    isCarrefourFoodContext({
      productUrl,
      title,
      breadcrumbs: raw.parent_category?.name ? [raw.parent_category.name] : [],
    })
  ) {
    return null;
  }

  const isMarketplace = Boolean(raw.seller_id && raw.seller_id !== "0");
  const listPrice = resolveListPrice(
    price,
    parseEuro(raw.strikethrough_price),
    parseEuro(raw.next_price),
    isMarketplace,
  );
  const discountPercentage =
    listPrice != null ? roundMoney(((listPrice - price) / listPrice) * 100) : 0;

  return {
    externalId,
    skuId: raw.sku_id,
    productUrl,
    sourceUrl,
    title,
    brand: raw.brand?.trim() || undefined,
    ean: raw.ean?.trim() || undefined,
    imageUrl: upgradeImageUrl(raw.images?.desktop ?? raw.images?.mobile),
    price,
    listPrice,
    discountPercentage,
    sellerName: raw.seller_name?.trim() || undefined,
    isMarketplace,
    unitsInStock: raw.units_in_stock,
    categoryName: raw.parent_category?.name?.trim() || undefined,
  };
}

function withOffset(feedUrl: string, offset: number): string {
  const url = new URL(feedUrl);
  if (offset > 0) url.searchParams.set("offset", String(offset));
  else url.searchParams.delete("offset");
  return url.toString();
}

async function readPlpItems(page: Page): Promise<CarrefourPlpItem[] | null> {
  return page.evaluate(() => {
    const state = (window as unknown as {
      __INITIAL_STATE__?: { plp?: { results?: { items?: unknown[] } } };
    }).__INITIAL_STATE__;
    const items = state?.plp?.results?.items;
    return Array.isArray(items) ? (items as never[]) : null;
  });
}

/**
 * Carrefour (Cloudflare) devuelve 403 a `fetch` y a Chromium headless, incluso
 * desde IP residencial. Solo pasa con Google Chrome instalado y ventana real,
 * así que la abrimos fuera de pantalla. Pensado para el cron del Mac.
 */
async function launchCarrefourBrowser(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
    channel: process.env.CARREFOUR_BROWSER_CHANNEL?.trim() || "chrome",
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--window-position=-2400,-2400",
      "--window-size=1280,900",
    ],
  });
}

/**
 * Pestaña con la ventana minimizada: Cloudflare la sigue dejando pasar y
 * macOS devuelve el foco a la app que estabas usando (solo parpadea al abrir).
 */
async function newMinimizedPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({ locale: "es-ES" });
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { windowState: "minimized" },
    });
    await cdp.detach();
  } catch {
    // Si no se puede minimizar, sigue fuera de pantalla (--window-position).
  }
  return page;
}

export function resolveCarrefourBrowserFeedUrls(): string[] {
  const fromEnv = process.env.CARREFOUR_BROWSER_FEED_URLS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return fromEnv?.length ? fromEnv : [...DEFAULT_CARREFOUR_BROWSER_FEED_URLS];
}

/**
 * Recorre las primeras `pagesPerFeed` páginas de cada listado y devuelve los
 * productos (con o sin rebaja; el servicio decide qué publicar).
 */
export async function discoverCarrefourDealsWithBrowser(options?: {
  feedUrls?: string[];
  pagesPerFeed?: number;
  maxItems?: number;
  delayMs?: number;
  timeoutMs?: number;
}): Promise<CarrefourBrowserDiscoveryResult> {
  const feedUrls = options?.feedUrls?.length
    ? options.feedUrls
    : resolveCarrefourBrowserFeedUrls();
  const pagesPerFeed = Math.max(1, options?.pagesPerFeed ?? 5);
  const maxItems = options?.maxItems ?? 300;
  const delayMs = options?.delayMs ?? 1_500;
  const timeoutMs = options?.timeoutMs ?? 30_000;

  const byId = new Map<string, CarrefourListingItem>();
  const feedErrors: Array<{ url: string; message: string }> = [];
  let pagesFetched = 0;

  const browser = await launchCarrefourBrowser();
  try {
    const page = await newMinimizedPage(browser);

    feeds: for (const feedUrl of feedUrls) {
      for (let pageIndex = 0; pageIndex < pagesPerFeed; pageIndex += 1) {
        const url = withOffset(feedUrl, pageIndex * PAGE_SIZE);
        try {
          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: timeoutMs,
            referer: pageIndex > 0 ? feedUrl : `${CARREFOUR_ORIGIN}/`,
          });
          const status = response?.status() ?? 0;
          if (status >= 400) {
            const title = await page.title().catch(() => "");
            throw new Error(
              /cloudflare|attention required/i.test(title)
                ? `Carrefour bloqueó la petición (Cloudflare ${status}).`
                : `Carrefour HTTP ${status}`,
            );
          }

          const rawItems = await readPlpItems(page);
          if (!rawItems) {
            throw new Error("Carrefour: listado sin __INITIAL_STATE__.plp.");
          }
          pagesFetched += 1;
          if (rawItems.length === 0) break;

          for (const raw of rawItems) {
            const item = listingItemFromPlp(raw, feedUrl);
            if (item && !byId.has(item.externalId)) {
              byId.set(item.externalId, item);
            }
            if (byId.size >= maxItems) break feeds;
          }

          if (rawItems.length < PAGE_SIZE) break;
        } catch (error) {
          feedErrors.push({
            url,
            message: error instanceof Error ? error.message : "Error desconocido",
          });
          // Un bloqueo en una página suele repetirse en las siguientes.
          break;
        }

        if (delayMs > 0) await page.waitForTimeout(delayMs);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  return {
    items: [...byId.values()].slice(0, maxItems),
    pagesFetched,
    feedErrors,
  };
}

/** `static.carrefour.es` da 403 a servidores (Telegram, OG, curl): hay que espejarlas. */
export function isBlockedCarrefourImageUrl(url: string | null | undefined): boolean {
  return Boolean(url && /^https:\/\/static\.carrefour\.es\//i.test(url));
}

/**
 * Descarga imágenes de `static.carrefour.es` navegando a cada una con el mismo
 * Chrome con ventana que pasa Cloudflare. Devuelve url → bytes (las que fallan
 * no aparecen).
 */
export async function downloadCarrefourImagesWithBrowser(
  urls: string[],
  options?: { timeoutMs?: number },
): Promise<Map<string, { body: Buffer; contentType: string }>> {
  const result = new Map<string, { body: Buffer; contentType: string }>();
  const unique = [...new Set(urls.filter(isBlockedCarrefourImageUrl))];
  if (unique.length === 0) return result;

  const browser = await launchCarrefourBrowser();
  try {
    const page = await newMinimizedPage(browser);
    for (const url of unique) {
      try {
        const response = await page.goto(url, {
          waitUntil: "load",
          timeout: options?.timeoutMs ?? 20_000,
          referer: `${CARREFOUR_ORIGIN}/`,
        });
        const contentType = response?.headers()["content-type"] ?? "";
        if (!response?.ok() || !contentType.startsWith("image/")) continue;
        result.set(url, { body: await response.body(), contentType });
      } catch {
        // Sin foto espejada se queda la URL original (en navegador sí carga).
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }
  return result;
}

interface CarrefourPdpOffer {
  price?: string;
  strikethrough_price?: string;
  seller_id?: string;
  units_in_stock?: number;
}

interface CarrefourPdpProduct {
  product_id?: string;
  name?: string;
  brand?: { description?: string };
  skus?: Array<{ id?: string; offers?: CarrefourPdpOffer[] }>;
  colors?: Array<{ images?: Array<{ medium?: string; large?: string }> }>;
}

export interface CarrefourPdpQuote {
  externalId: string | null;
  productUrl: string;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
  price: number | null;
  listPrice: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
}

/**
 * Ficha de producto con Chrome con ventana (alertas de usuario por URL). La
 * primera oferta de `skus[0].offers` es la que Carrefour vende por defecto;
 * la segunda sirve de referencia para vendedores del marketplace.
 */
export async function scrapeCarrefourProductWithBrowser(
  url: string,
  options?: { timeoutMs?: number },
): Promise<CarrefourPdpQuote> {
  const productUrl = normalizeCarrefourProductUrl(url);
  const browser = await launchCarrefourBrowser();
  try {
    const page = await newMinimizedPage(browser);
    const response = await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: options?.timeoutMs ?? 30_000,
      referer: `${CARREFOUR_ORIGIN}/`,
    });
    const status = response?.status() ?? 0;
    if (status >= 400) {
      throw new Error(`Carrefour HTTP ${status} para ${productUrl}`);
    }

    const product = await page.evaluate(() => {
      const state = (window as unknown as {
        __INITIAL_STATE__?: { pdp?: { product?: unknown } };
      }).__INITIAL_STATE__;
      return (state?.pdp?.product ?? null) as never;
    }) as CarrefourPdpProduct | null;
    if (!product) {
      throw new Error("Carrefour: no se encontró ficha de producto (bloqueo o URL inválida).");
    }

    const offers = product.skus?.[0]?.offers ?? [];
    const best = offers[0];
    const price = parseEuro(best?.price);
    const isMarketplace = Boolean(best?.seller_id && best.seller_id !== "0");
    const listPrice =
      price == null
        ? null
        : resolveListPrice(
            price,
            parseEuro(best?.strikethrough_price),
            parseEuro(offers[1]?.price),
            isMarketplace,
          );
    const image = product.colors?.[0]?.images?.[0];

    return {
      externalId: product.product_id?.toUpperCase() ?? null,
      productUrl,
      title: product.name?.replace(/\s+/g, " ").trim() || null,
      brand: product.brand?.description?.trim() || null,
      imageUrl: image?.medium ?? image?.large ?? null,
      price,
      listPrice,
      availability: !best
        ? "OUT_OF_STOCK"
        : best.units_in_stock === 0
          ? "OUT_OF_STOCK"
          : price != null
            ? "IN_STOCK"
            : "UNKNOWN",
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
