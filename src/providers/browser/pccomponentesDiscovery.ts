import type { Page } from "playwright";
import { roundMoney } from "@/lib/money";
import { extractPcComponentesProductId } from "@/lib/retailers";
import { withHeadedChromePage } from "@/providers/browser/headedChrome";

const PCC_ORIGIN = "https://www.pccomponentes.com";

/**
 * Listados por defecto (~40 productos por página, `?page=N`). Descartados:
 * `tarjetas-graficas` (ninguna tarjeta trae PVPR tachado) y las campañas
 * (`/ofertas-especiales` redirige a una landing sin rejilla).
 */
export const DEFAULT_PCCOMPONENTES_FEED_URLS = [
  `${PCC_ORIGIN}/categorias/portatiles`,
  `${PCC_ORIGIN}/categorias/smartphone-moviles`,
  `${PCC_ORIGIN}/categorias/televisores`,
  `${PCC_ORIGIN}/categorias/auriculares`,
  `${PCC_ORIGIN}/categorias/monitores-pc`,
  `${PCC_ORIGIN}/categorias/tablets`,
];

export interface PcComponentesListingItem {
  /** Slug de la URL (mismo id que las alertas por URL). */
  externalId: string;
  productUrl: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  price: number;
  /** PVPR tachado que muestra la tarjeta (precio recomendado del fabricante). */
  listPrice: number | null;
  discountPercentage: number;
  categoryName: string | null;
  /** Vendido por un tercero (marketplace), no por PcComponentes. */
  marketplace: boolean;
  sourceUrl: string;
}

interface RawCard {
  href: string;
  name: string | null;
  price: string | null;
  brand: string | null;
  category: string | null;
  seller: string | null;
  condition: string | null;
  crossed: string | null;
  image: string | null;
}

/** Lee las tarjetas de la rejilla (`#product-listing-product-grid`). */
async function readCards(page: Page): Promise<RawCard[]> {
  return page.$$eval("#product-listing-product-grid a[data-product-id]", (links) =>
    links.map((el) => {
      const a = el as HTMLAnchorElement;
      return {
        href: a.href,
        name: a.getAttribute("data-product-name"),
        price: a.getAttribute("data-product-price"),
        brand: a.getAttribute("data-product-brand"),
        category: a.getAttribute("data-product-category"),
        seller: a.getAttribute("data-product-seller"),
        condition: a.getAttribute("data-product-condition"),
        crossed: a.querySelector("[data-e2e='crossedPrice']")?.textContent ?? null,
        image: a.querySelector("img")?.getAttribute("src") ?? null,
      };
    }),
  );
}

function parseEuroText(raw: string | null): number | null {
  const match = raw?.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*€/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 ? roundMoney(value) : null;
}

/** La miniatura (`thumb…/w-150-150/articles/…`) → la foto de la ficha (`img…/articles/…`). */
function fullImageUrl(src: string | null): string | null {
  if (!src) return null;
  const path = src.match(/\/articles\/.+$/)?.[0];
  return path ? `https://img.pccomponentes.com${path}` : src;
}

export function listingItemFromCard(
  card: RawCard,
  sourceUrl: string,
): PcComponentesListingItem | null {
  const price = card.price ? Number(card.price) : Number.NaN;
  if (!card.name || !Number.isFinite(price) || price <= 0) return null;
  // Reacondicionados («Replay … Refurbished»): el PVPR tachado es el del
  // producto nuevo, así que el descuento sale inflado. PcComponentes los marca
  // `data-product-condition="new"` igualmente: se detectan también por título.
  if (card.condition && card.condition !== "new") return null;
  if (/\b(replay|refurbished|reacondicionad[oa]s?|renewed)\b/i.test(card.name)) return null;

  const url = new URL(card.href, PCC_ORIGIN);
  url.search = "";
  url.hash = "";
  const externalId = extractPcComponentesProductId(url.toString());
  if (!externalId) return null;

  const current = roundMoney(price);
  const crossed = parseEuroText(card.crossed);
  const listPrice = crossed != null && crossed > current ? crossed : null;

  return {
    externalId,
    productUrl: url.toString(),
    title: card.name.replace(/\s+/g, " ").trim(),
    brand: card.brand?.trim() || null,
    imageUrl: fullImageUrl(card.image),
    price: current,
    listPrice,
    discountPercentage:
      listPrice != null ? roundMoney(((listPrice - current) / listPrice) * 100) : 0,
    categoryName: card.category?.trim() || null,
    marketplace: Boolean(card.seller && card.seller !== "PcComponentes"),
    sourceUrl,
  };
}

function pageUrl(feedUrl: string, page: number): string {
  if (page <= 1) return feedUrl;
  const url = new URL(feedUrl);
  url.searchParams.set("page", String(page));
  return url.toString();
}

/**
 * Rebajas desde los listados de categoría con Google Chrome con ventana (una
 * sola ventana para todo el recorrido). Solo Mac, como las alertas.
 */
export async function discoverPcComponentesDeals(options?: {
  feedUrls?: string[];
  pagesPerFeed?: number;
  delayMs?: number;
}): Promise<{
  items: PcComponentesListingItem[];
  pagesFetched: number;
  feedErrors: Array<{ url: string; message: string }>;
}> {
  const feeds = options?.feedUrls?.length ? options.feedUrls : DEFAULT_PCCOMPONENTES_FEED_URLS;
  const pagesPerFeed = Math.max(1, options?.pagesPerFeed ?? 2);
  const delayMs = options?.delayMs ?? 1_500;

  const byId = new Map<string, PcComponentesListingItem>();
  const feedErrors: Array<{ url: string; message: string }> = [];
  let pagesFetched = 0;

  await withHeadedChromePage(async (page) => {
    for (const feed of feeds) {
      for (let pageNumber = 1; pageNumber <= pagesPerFeed; pageNumber += 1) {
        const url = pageUrl(feed, pageNumber);
        try {
          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
            referer: `${PCC_ORIGIN}/`,
          });
          const deadline = Date.now() + 15_000;
          while (/just a moment|un momento/i.test(await page.title())) {
            if (Date.now() > deadline) {
              throw new Error("bloqueado por Cloudflare (challenge sin resolver)");
            }
            await page.waitForTimeout(1_000);
          }
          const status = response?.status() ?? 0;
          if (status >= 400) throw new Error(`HTTP ${status}`);

          const cards = await readCards(page);
          pagesFetched += 1;
          for (const card of cards) {
            const item = listingItemFromCard(card, url);
            if (item && !byId.has(item.externalId)) byId.set(item.externalId, item);
          }
          if (cards.length === 0) break;
        } catch (error) {
          feedErrors.push({
            url,
            message: `PcComponentes: ${error instanceof Error ? error.message : String(error)}`,
          });
          break;
        }
        await page.waitForTimeout(delayMs);
      }
    }
  });

  return { items: [...byId.values()], pagesFetched, feedErrors };
}
