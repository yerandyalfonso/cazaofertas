import * as cheerio from "cheerio";
import { roundMoney } from "@/lib/money";
import type {
  MiraviaDiscoveredItem,
  MiraviaProductQuote,
} from "@/providers/retail/miravia/types";

export const DEFAULT_MIRAVIA_FLASH_FEED_URLS = [
  "https://www.miravia.es/flashsale/home",
] as const;

const FETCH_TIMEOUT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEuroLabel(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const cleaned = raw
    .trim()
    .replace(/[^\d.,]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 ? roundMoney(value) : null;
}

/**
 * Precios en clickTrackInfo de Miravia/Lazada:
 * - enteros → céntimos (1999 → 19.99 €)
 * - con decimal → ya en euros (19.99 → 19.99 €)
 */
function trackPriceToEuro(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim().replace(",", ".");
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (trimmed.includes(".")) return roundMoney(value);
  return roundMoney(value / 100);
}

function parseDiscountPercent(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? roundMoney(value) : null;
}

function absolutizeMiraviaUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("//")) return `https:${trimmed.split("?")[0]}`;
  if (trimmed.startsWith("http")) return trimmed.split("?")[0] ?? trimmed;
  if (trimmed.startsWith("/")) {
    return `https://www.miravia.es${trimmed.split("?")[0]}`;
  }
  return null;
}

function extractJsonString(blob: string, key: string): string | null {
  const match = blob.match(
    new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
  );
  return match?.[1] ?? null;
}

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value
      .replace(/\\"/g, '"')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
  }
}

function parseClickTrackInfo(blob: string): {
  itemId?: string;
  skuId?: string;
  saleCents?: string;
  listCents?: string;
} {
  const track =
    extractJsonString(blob, "clickTrackInfo") ||
    blob.match(/clickTrackInfo=([^"&]+)/)?.[1]?.replace(/%3[Bb]/gi, ";") ||
    null;
  if (!track) return {};

  const decoded = (() => {
    try {
      return decodeURIComponent(track);
    } catch {
      return track;
    }
  })();

  const pick = (key: string) =>
    decoded.match(new RegExp(`(?:^|;)${key}:([^;]+)`))?.[1]?.trim();

  return {
    itemId: pick("item_id"),
    skuId: pick("sku_id"),
    saleCents: pick("item_discount_price"),
    listCents: pick("item_price"),
  };
}

/**
 * Parsea el HTML de Miravia (flashsale/home o home) buscando tarjetas flash.
 * Fuente primaria: objetos con `pdpTrackUrlEncode` + `clickTrackInfo`.
 */
export function parseMiraviaFlashHtml(
  html: string,
  sourceUrl: string,
): MiraviaDiscoveredItem[] {
  const byId = new Map<string, MiraviaDiscoveredItem>();

  for (const match of html.matchAll(
    /"pdpTrackUrlEncode"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  )) {
    const encodeRaw = match[1];
    if (!encodeRaw) continue;

    const start = match.index!;
    // Objeto típico: pdpTrackUrlEncode → … → itemImg (~4–6 KB).
    const end = Math.min(html.length, start + 7_000);
    const blob = html.slice(start, end);

    const path =
      absolutizeMiraviaUrl(unescapeJsonString(encodeRaw)) ||
      absolutizeMiraviaUrl(extractJsonString(blob, "itemUrl"));
    const pathMatch = path?.match(/\/p\/i(\d+)-s(\d+)\.html/);
    const track = parseClickTrackInfo(blob);

    const externalId =
      track.itemId ||
      pathMatch?.[1] ||
      extractJsonString(blob, "itemId") ||
      null;
    if (!externalId || !/^\d{8,}$/.test(externalId)) continue;

    const skuId =
      pathMatch?.[2] || track.skuId || extractJsonString(blob, "skuId") || null;

    const productUrl =
      pathMatch
        ? `https://www.miravia.es/p/i${externalId}-s${skuId ?? pathMatch[2]}.html`
        : path
          ? absolutizeMiraviaUrl(path)
          : `https://www.miravia.es/p/i${externalId}${skuId ? `-s${skuId}` : ""}.html`;

    if (!productUrl) continue;

    const titleRaw = extractJsonString(blob, "itemTitle");
    const titleHint = titleRaw
      ? unescapeJsonString(titleRaw).replace(/\s+/g, " ").trim()
      : undefined;
    if (titleHint && titleHint.length < 4) continue;

    const priceHint =
      trackPriceToEuro(track.saleCents) ||
      parseEuroLabel(extractJsonString(blob, "rec_sale_price")) ||
      parseEuroLabel(extractJsonString(blob, "itemDiscountPrice"));

    let listPriceHint =
      trackPriceToEuro(track.listCents) ||
      parseEuroLabel(extractJsonString(blob, "itemPrice"));

    // No inventar lista desde el badge %: suele inflar el “antes”.
    if (
      priceHint != null &&
      listPriceHint != null &&
      listPriceHint <= priceHint
    ) {
      listPriceHint = null;
    }

    const imageUrlHint =
      absolutizeMiraviaUrl(extractJsonString(blob, "itemImg")) ||
      absolutizeMiraviaUrl(extractJsonString(blob, "image"));

    byId.set(externalId, {
      externalId,
      skuId,
      productUrl,
      titleHint,
      priceHint: priceHint ?? undefined,
      listPriceHint: listPriceHint ?? undefined,
      discountHint:
        parseDiscountPercent(extractJsonString(blob, "itemDiscount")) ?? null,
      imageUrlHint: imageUrlHint ?? null,
      sourceUrl,
    });
  }

  // Respaldo si la página no trae pdpTrackUrlEncode (home u otras landings).
  if (byId.size === 0) {
    for (const match of html.matchAll(
      /"itemTitle"\s*:\s*"((?:\\.|[^"\\])*)"/g,
    )) {
      const titleRaw = match[1];
      if (!titleRaw) continue;
      const start = Math.max(0, match.index! - 400);
      const end = Math.min(html.length, match.index! + 6_000);
      const blob = html.slice(start, end);
      const track = parseClickTrackInfo(blob);
      const pathMatch = blob.match(/\/p\/i(\d+)-s(\d+)\.html/);
      const externalId = track.itemId || pathMatch?.[1] || null;
      if (!externalId || !/^\d{8,}$/.test(externalId)) continue;

      const skuId = pathMatch?.[2] || track.skuId || null;
      const productUrl = `https://www.miravia.es/p/i${externalId}${skuId ? `-s${skuId}` : ""}.html`;
      const titleHint = unescapeJsonString(titleRaw).replace(/\s+/g, " ").trim();
      if (titleHint.length < 4) continue;

      byId.set(externalId, {
        externalId,
        skuId,
        productUrl,
        titleHint,
        priceHint: trackPriceToEuro(track.saleCents) ?? undefined,
        listPriceHint: trackPriceToEuro(track.listCents) ?? undefined,
        discountHint:
          parseDiscountPercent(extractJsonString(blob, "itemDiscount")) ?? null,
        imageUrlHint:
          absolutizeMiraviaUrl(extractJsonString(blob, "itemImg")) ?? null,
        sourceUrl,
      });
    }
  }

  // Último respaldo: enlaces /p/i… en el DOM.
  if (byId.size === 0) {
    const $ = cheerio.load(html);
    $('a[href*="/p/i"]').each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const abs = absolutizeMiraviaUrl(href);
      const path = abs?.match(/\/p\/i(\d+)-s(\d+)\.html/);
      if (!abs || !path) return;
      const externalId = path[1]!;
      if (byId.has(externalId)) return;
      const titleHint =
        $(el).attr("aria-label")?.trim() ||
        $(el).find("img[alt]").attr("alt")?.trim() ||
        $(el).text().replace(/\s+/g, " ").trim().slice(0, 160) ||
        undefined;
      byId.set(externalId, {
        externalId,
        skuId: path[2],
        productUrl: abs,
        titleHint: titleHint && titleHint.length > 3 ? titleHint : undefined,
        sourceUrl,
      });
    });
  }

  return [...byId.values()];
}

export async function fetchMiraviaHtml(
  url: string,
  options?: { timeoutMs?: number },
): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(options?.timeoutMs ?? FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Miravia HTTP ${response.status} en ${url}`);
  }
  const html = await response.text();
  // Anti-bot de Alibaba: responde 200 con una página que redirige al captcha.
  if (isMiraviaCaptchaPage(html)) {
    throw new Error(`Miravia captcha anti-bot (x5sec) en ${url}`);
  }
  return html;
}

function isMiraviaCaptchaPage(html: string): boolean {
  return (
    html.includes("_____tmd_____/punish") ||
    html.includes("x5secdata=") ||
    /"action"\s*:\s*"captcha"/.test(html)
  );
}

export async function discoverMiraviaDeals(options?: {
  feedUrls?: string[];
  maxItems?: number;
  delayMs?: number;
  minDiscountPercent?: number;
}): Promise<{
  feedsFetched: number;
  feedErrors: Array<{ url: string; message: string }>;
  items: MiraviaDiscoveredItem[];
}> {
  // Flash primero; home solo como respaldo de volumen.
  const feedUrls = [
    ...new Set(
      (options?.feedUrls?.length
        ? options.feedUrls
        : [...DEFAULT_MIRAVIA_FLASH_FEED_URLS]
      )
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => {
    const score = (url: string) =>
      /flashsale/i.test(url) ? 0 : /miravia\.es\/?$/i.test(url) ? 1 : 2;
    return score(a) - score(b);
  });

  const maxItems = options?.maxItems ?? 40;
  const delayMs = options?.delayMs ?? 700;
  const minDiscount = options?.minDiscountPercent ?? 10;

  const merged = new Map<string, MiraviaDiscoveredItem>();
  const feedErrors: Array<{ url: string; message: string }> = [];
  let feedsFetched = 0;

  for (let index = 0; index < feedUrls.length; index += 1) {
    const url = feedUrls[index]!;
    try {
      const html = await fetchMiraviaHtml(url);
      feedsFetched += 1;
      for (const item of parseMiraviaFlashHtml(html, url)) {
        if (!merged.has(item.externalId)) {
          merged.set(item.externalId, item);
        }
      }
      // Con flashsale ya hay stock suficiente: no hace falta home en cada pasada.
      if (/flashsale/i.test(url) && merged.size >= maxItems) {
        break;
      }
    } catch (error) {
      feedErrors.push({
        url,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
    if (index < feedUrls.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const items = [...merged.values()]
    .filter((item) => {
      if (item.priceHint == null || item.listPriceHint == null) return false;
      if (item.listPriceHint <= item.priceHint) return false;
      const discount =
        ((item.listPriceHint - item.priceHint) / item.listPriceHint) * 100;
      return discount >= minDiscount;
    })
    .sort((a, b) => {
      const da =
        a.listPriceHint && a.priceHint
          ? (a.listPriceHint - a.priceHint) / a.listPriceHint
          : (a.discountHint ?? 0) / 100;
      const db =
        b.listPriceHint && b.priceHint
          ? (b.listPriceHint - b.priceHint) / b.listPriceHint
          : (b.discountHint ?? 0) / 100;
      return db - da;
    })
    .slice(0, maxItems);

  return { feedsFetched, feedErrors, items };
}

/**
 * Lectura ligera de ficha Miravia (og:* + clickTrackInfo del itemId).
 */
export async function scrapeMiraviaProductPage(
  urlOrId: string,
  options?: { timeoutMs?: number },
): Promise<MiraviaProductQuote> {
  const trimmed = urlOrId.trim();
  const externalIdFromInput =
    trimmed.match(/\/p\/i(\d+)/i)?.[1] ||
    (/^\d{8,}$/.test(trimmed) ? trimmed : null);

  const productUrl = /^https?:\/\//i.test(trimmed)
    ? absolutizeMiraviaUrl(trimmed)!
    : externalIdFromInput
      ? `https://www.miravia.es/p/i${externalIdFromInput}.html`
      : null;

  if (!productUrl || !externalIdFromInput) {
    throw new Error("URL o ID Miravia no válidos.");
  }

  const html = await fetchMiraviaHtml(productUrl, {
    timeoutMs: options?.timeoutMs,
  });

  const ogTitle =
    html.match(
      /property=["']og:title["']\s+content=["']([^"']+)["']/i,
    )?.[1] ||
    html.match(
      /content=["']([^"']+)["']\s+property=["']og:title["']/i,
    )?.[1];
  const ogImage =
    html.match(
      /property=["']og:image["']\s+content=["']([^"']+)["']/i,
    )?.[1] ||
    html.match(
      /content=["']([^"']+)["']\s+property=["']og:image["']/i,
    )?.[1];

  // Preferir el clickTrackInfo que mencione este item_id.
  let sale: number | null = null;
  let list: number | null = null;
  let skuId: string | null = null;
  const trackRe =
    /(?:clickTrackInfo|clickTrackInfo=)"?([^"&<]{20,800})/gi;
  for (const match of html.matchAll(trackRe)) {
    const raw = match[1] ?? "";
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw.replace(/%3[Bb]/gi, ";"));
    } catch {
      /* keep raw */
    }
    if (!decoded.includes(`item_id:${externalIdFromInput}`)) continue;
    const saleCents = decoded.match(/item_discount_price:([\d.]+)/)?.[1];
    const listCents = decoded.match(/item_price:([\d.]+)/)?.[1];
    skuId = decoded.match(/sku_id:(\d+)/)?.[1] ?? skuId;
    sale = trackPriceToEuro(saleCents);
    list = trackPriceToEuro(listCents);
    if (sale != null) break;
  }

  // Respaldo: si la ficha está en flashsale JSON embebido.
  if (sale == null) {
    const fromFlash = parseMiraviaFlashHtml(html, productUrl).find(
      (item) => item.externalId === externalIdFromInput,
    );
    if (fromFlash) {
      sale = fromFlash.priceHint ?? null;
      list = fromFlash.listPriceHint ?? null;
      skuId = fromFlash.skuId ?? skuId;
    }
  }

  const title = (ogTitle || `Producto Miravia ${externalIdFromInput}`)
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s*\|\s*Miravia\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const canonicalUrl = skuId
    ? `https://www.miravia.es/p/i${externalIdFromInput}-s${skuId}.html`
    : productUrl.split("?")[0]!;

  let listPrice = list;
  if (sale != null && listPrice != null && listPrice <= sale) {
    listPrice = null;
  }

  return {
    externalId: externalIdFromInput,
    productUrl: canonicalUrl,
    title,
    brand: "Miravia",
    imageUrl: ogImage ?? null,
    price: sale,
    listPrice,
    discountPercentage:
      sale != null && listPrice != null && listPrice > sale
        ? roundMoney(((listPrice - sale) / listPrice) * 100)
        : null,
    availability: sale != null ? "IN_STOCK" : "UNKNOWN",
  };
}
