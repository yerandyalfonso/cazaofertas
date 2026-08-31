import * as cheerio from "cheerio";
import {
  extractAsin,
  generateAmazonUrl,
} from "@/lib/affiliate";
import type { SiteCategorySlug } from "@/lib/site-categories";
import {
  fetchAmazonPageHtml,
  parseAmazonPriceText,
} from "@/providers/price";
import { DEFAULT_MOCK_CATALOG } from "@/providers/price/MockPriceProvider";

/**
 * Goldbox/deals sesgan mucho a Electrónica/Hogar: solo cada N slots.
 * El grueso va por departamento rotado con pesos (Belleza/Moda más a menudo).
 */
export const DEFAULT_FLASH_FEED_URLS = [
  "https://www.amazon.es/gp/goldbox",
  "https://www.amazon.es/deals",
] as const;

export interface FlashDepartmentFeed {
  id: string;
  slug: SiteCategorySlug;
  /** Veces que aparece en el ciclo de rotación (Belleza/Moda > resto). */
  weight: number;
}

/**
 * Browse nodes Amazon.es → categoría CazaOferta.
 * Incluye Ropa/Zapatos (antes faltaban) y sube peso de Belleza/Moda.
 */
export const FLASH_DEPARTMENT_FEEDS: readonly FlashDepartmentFeed[] = [
  { id: "6198055031", slug: "belleza", weight: 3 },
  { id: "3677431031", slug: "belleza", weight: 2 }, // Salud y cuidado personal
  { id: "2846221031", slug: "moda", weight: 3 }, // Ropa y accesorios
  { id: "1571263031", slug: "moda", weight: 2 }, // Zapatos y complementos
  { id: "1703496031", slug: "bebe", weight: 1 },
  { id: "1951052031", slug: "automovil", weight: 1 },
  { id: "2665403031", slug: "deportes", weight: 1 },
  { id: "599392031", slug: "hogar", weight: 1 },
  { id: "667050031", slug: "tecnologia", weight: 1 }, // Electrónica
  { id: "1571260031", slug: "jardin", weight: 1 },
  { id: "599386031", slug: "juguetes", weight: 1 },
  { id: "599383031", slug: "videojuegos", weight: 1 },
  { id: "12472656031", slug: "mascotas", weight: 1 },
] as const;

/** @deprecated Usa FLASH_DEPARTMENT_FEEDS. */
export const FLASH_DEPARTMENT_IDS = FLASH_DEPARTMENT_FEEDS.map(
  (feed) => feed.id,
);

const FLASH_DEPARTMENT_BY_ID = new Map(
  FLASH_DEPARTMENT_FEEDS.map((feed) => [feed.id, feed] as const),
);

/** Misma codificación que copia Amazon desde el navegador (doble encode). */
export function buildAmazonDealsDepartmentUrl(departmentId: string): string {
  const payload = {
    state: {
      refinementFilters: {
        departments: [String(departmentId)],
      },
    },
    version: 1,
  };
  const widget = encodeURIComponent(
    encodeURIComponent(JSON.stringify(JSON.stringify(payload))),
  );
  return `https://www.amazon.es/events/deals/?discounts-widget=${widget}`;
}

export function flashCategorySlugForDepartmentId(
  departmentId: string | null | undefined,
): SiteCategorySlug | null {
  if (!departmentId) return null;
  return FLASH_DEPARTMENT_BY_ID.get(String(departmentId))?.slug ?? null;
}

export function flashDepartmentIdFromFeedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let widget = parsed.searchParams.get("discounts-widget");
    if (!widget) return null;
    for (let i = 0; i < 3; i += 1) {
      try {
        const next = decodeURIComponent(widget);
        if (next === widget) break;
        widget = next;
      } catch {
        break;
      }
    }
    const jsonText =
      widget.startsWith('"') && widget.endsWith('"')
        ? (JSON.parse(widget) as string)
        : widget;
    const payload = JSON.parse(jsonText) as {
      state?: { refinementFilters?: { departments?: string[] } };
    };
    const id = payload.state?.refinementFilters?.departments?.[0];
    return id ? String(id) : null;
  } catch {
    const match = url.match(/departments.*?(\d{8,12})/i);
    return match?.[1] ?? null;
  }
}

function parseFeedUrlsFromEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[\n,]+/)
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ];
}

function buildWeightedDepartmentPool(): FlashDepartmentFeed[] {
  const pool: FlashDepartmentFeed[] = [];
  for (const feed of FLASH_DEPARTMENT_FEEDS) {
    const times = Math.max(1, Math.floor(feed.weight));
    for (let i = 0; i < times; i += 1) pool.push(feed);
  }
  return pool;
}

/**
 * Feeds a scrapear en esta pasada.
 * - `AMAZON_FLASH_FEED_URLS`: lista fija (coma o salto de línea).
 * - Si no: N departamentos con peso (Belleza/Moda más frecuentes).
 * - Goldbox/deals solo cada 5 slots (evita sesgo Tecnología/Hogar).
 */
export function resolveFlashFeedUrls(options?: {
  now?: number;
  departmentFeedsPerRun?: number;
  slotMs?: number;
}): string[] {
  const fromEnv = parseFeedUrlsFromEnv(process.env.AMAZON_FLASH_FEED_URLS);
  if (fromEnv.length > 0) return fromEnv;

  const perRunRaw = Number(
    options?.departmentFeedsPerRun ??
      process.env.AMAZON_FLASH_DEPARTMENT_FEEDS_PER_RUN ??
      3,
  );
  const perRun =
    Number.isFinite(perRunRaw) && perRunRaw > 0
      ? Math.min(Math.floor(perRunRaw), FLASH_DEPARTMENT_FEEDS.length)
      : 3;
  const slotMs = options?.slotMs ?? 3 * 60 * 1000;
  const now = options?.now ?? Date.now();
  const slot = Math.floor(now / slotMs);
  const pool = buildWeightedDepartmentPool();

  const picked: FlashDepartmentFeed[] = [];
  const seenIds = new Set<string>();
  let cursor = 0;
  while (picked.length < perRun && cursor < pool.length * 3) {
    const feed = pool[(slot * perRun + cursor) % pool.length]!;
    cursor += 1;
    if (seenIds.has(feed.id)) continue;
    seenIds.add(feed.id);
    picked.push(feed);
  }

  const departmentUrls = picked.map((feed) =>
    buildAmazonDealsDepartmentUrl(feed.id),
  );

  // Goldbox genérico sesga a tech/hogar: solo de vez en cuando (1 URL).
  if (slot % 10 === 0) {
    return ["https://www.amazon.es/gp/goldbox", ...departmentUrls];
  }
  return departmentUrls;
}

export interface DiscoveredListingItem {
  asin: string;
  amazonUrl: string;
  titleHint?: string;
  priceHint?: number;
  listPriceHint?: number;
  sourceUrl: string;
  /** Origen: listado live de Amazon o simulación / feed inyectado. */
  origin: "live" | "simulated" | "injected";
  /** Categoría esperada según el departamento del feed. */
  expectedCategorySlug?: SiteCategorySlug | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectAsinsFromHtml(
  html: string,
  sourceUrl: string,
  expectedCategorySlug?: SiteCategorySlug | null,
): DiscoveredListingItem[] {
  const $ = cheerio.load(html);
  const byAsin = new Map<string, DiscoveredListingItem>();

  const upsert = (asinRaw: string, extras?: Partial<DiscoveredListingItem>) => {
    const asin = asinRaw.toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) return;
    const existing = byAsin.get(asin);
    byAsin.set(asin, {
      asin,
      amazonUrl: extras?.amazonUrl ?? existing?.amazonUrl ?? generateAmazonUrl(asin),
      sourceUrl,
      origin: extras?.origin ?? existing?.origin ?? "live",
      titleHint: extras?.titleHint ?? existing?.titleHint,
      priceHint: extras?.priceHint ?? existing?.priceHint,
      listPriceHint: extras?.listPriceHint ?? existing?.listPriceHint,
      expectedCategorySlug:
        extras?.expectedCategorySlug ??
        existing?.expectedCategorySlug ??
        expectedCategorySlug ??
        null,
    });
  };

  $('a[href*="/dp/"], a[href*="/gp/product/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const asin = extractAsin(href);
    if (!asin) return;

    const card = $(el).closest(
      "[data-asin], .DealCard-module__card, .octopus-pc-item, .a-carousel-card, li",
    );
    const titleHint =
      $(el).attr("aria-label")?.trim() ||
      card.find("img[alt]").attr("alt")?.trim() ||
      $(el).text().replace(/\s+/g, " ").trim().slice(0, 160) ||
      undefined;

    const priceText =
      card.find(".a-price .a-offscreen").first().text() ||
      card.find(".a-price").first().text();
    const listText =
      card.find(".a-price.a-text-price .a-offscreen").first().text() ||
      card.find("[data-a-strike='true']").first().text();

    upsert(asin, {
      origin: "live",
      titleHint: titleHint && titleHint.length > 3 ? titleHint : undefined,
      priceHint: parseAmazonPriceText(priceText) ?? undefined,
      listPriceHint: parseAmazonPriceText(listText) ?? undefined,
      amazonUrl: href.startsWith("http")
        ? href.split("?")[0]!
        : generateAmazonUrl(asin),
    });
  });

  $("[data-asin]").each((_, el) => {
    const asin = ($(el).attr("data-asin") ?? "").trim().toUpperCase();
    if (asin) upsert(asin, { origin: "live" });
  });

  for (const match of html.matchAll(/"asin"\s*:\s*"([A-Z0-9]{10})"/gi)) {
    upsert(match[1]!, { origin: "live" });
  }
  for (const match of html.matchAll(/\/dp\/([A-Z0-9]{10})/gi)) {
    upsert(match[1]!, { origin: "live" });
  }

  return [...byAsin.values()];
}

/** Listado simulado de chollos cuando Amazon bloquea o no hay feeds live. */
export function buildSimulatedFlashListings(
  maxItems = 12,
): DiscoveredListingItem[] {
  return DEFAULT_MOCK_CATALOG.filter(
    (item) =>
      item.previousPrice != null &&
      item.previousPrice > item.price &&
      (item.previousPrice - item.price) / item.previousPrice >= 0.1,
  )
    .slice(0, maxItems)
    .map((item) => ({
      asin: item.asin.toUpperCase(),
      amazonUrl: item.amazonUrl ?? generateAmazonUrl(item.asin),
      titleHint: item.title,
      priceHint: item.price,
      listPriceHint: item.previousPrice,
      sourceUrl: "simulated://amazon.es/gp/goldbox",
      origin: "simulated" as const,
    }));
}

export function listingsFromInjectedAsins(
  asins: string[],
): DiscoveredListingItem[] {
  const items: DiscoveredListingItem[] = [];
  for (const raw of asins) {
    const asin = extractAsin(raw)?.toUpperCase();
    if (!asin) continue;
    items.push({
      asin,
      amazonUrl: raw.includes("http") ? raw.trim() : generateAmazonUrl(asin),
      sourceUrl: "injected://feed",
      origin: "injected",
    });
  }
  return items;
}

/**
 * Escanea listados públicos (Gold Box / Deals), feeds inyectados o simulación.
 */
export async function discoverFlashDealListings(options?: {
  feedUrls?: string[];
  /** ASINs o URLs inyectados (feeds dinámicos / tests). */
  injectedAsins?: string[];
  maxItems?: number;
  delayMs?: number;
  timeoutMs?: number;
  /** Si los feeds live fallan o vienen vacíos, usar listado simulado. */
  allowSimulatedFallback?: boolean;
}): Promise<{
  feedsFetched: number;
  feedErrors: Array<{ url: string; message: string }>;
  usedSimulation: boolean;
  items: DiscoveredListingItem[];
}> {
  const maxItems = options?.maxItems ?? 40;
  const delayMs = options?.delayMs ?? 900;
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const allowSimulatedFallback = options?.allowSimulatedFallback ?? true;

  const merged = new Map<string, DiscoveredListingItem>();
  const feedErrors: Array<{ url: string; message: string }> = [];
  let feedsFetched = 0;
  let usedSimulation = false;

  for (const item of listingsFromInjectedAsins(options?.injectedAsins ?? [])) {
    merged.set(item.asin, item);
  }

  const feedUrls = [
    ...new Set(
      (options?.feedUrls?.length
        ? options.feedUrls
        : resolveFlashFeedUrls()
      )
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ];

  for (let index = 0; index < feedUrls.length; index += 1) {
    const url = feedUrls[index]!;
    const expectedCategorySlug = flashCategorySlugForDepartmentId(
      flashDepartmentIdFromFeedUrl(url),
    );
    try {
      const html = await fetchAmazonPageHtml(url, { timeoutMs });
      feedsFetched += 1;
      for (const item of collectAsinsFromHtml(
        html,
        url,
        expectedCategorySlug,
      )) {
        if (!merged.has(item.asin)) {
          merged.set(item.asin, item);
        }
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

  if (merged.size === 0 && allowSimulatedFallback) {
    usedSimulation = true;
    for (const item of buildSimulatedFlashListings(maxItems)) {
      merged.set(item.asin, item);
    }
  }

  return {
    feedsFetched,
    feedErrors,
    usedSimulation,
    items: [...merged.values()].slice(0, maxItems),
  };
}
