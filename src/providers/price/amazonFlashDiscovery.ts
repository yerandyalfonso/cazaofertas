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
 * El grueso va por feeds rotados con pesos (Belleza/Moda/Mascotas más a menudo).
 */
export const DEFAULT_FLASH_FEED_URLS = [
  "https://www.amazon.es/gp/goldbox",
  "https://www.amazon.es/deals",
] as const;

export type FlashFeedSource =
  | {
      kind: "department";
      id: string;
      slug: SiteCategorySlug;
      weight: number;
    }
  | {
      kind: "url";
      url: string;
      slug: SiteCategorySlug;
      weight: number;
    };

/**
 * Fuentes de descubrimiento flash.
 * Nota: el filtro `departments` de /events/deals NO funciona bien para Mascotas
 * (Amazon devuelve chollos genéricos). Usamos búsquedas `i=pets` / keywords.
 */
export const FLASH_FEED_SOURCES: readonly FlashFeedSource[] = [
  { kind: "department", id: "6198055031", slug: "belleza", weight: 3 },
  { kind: "department", id: "3677431031", slug: "belleza", weight: 2 },
  { kind: "department", id: "2846221031", slug: "moda", weight: 3 },
  { kind: "department", id: "1571263031", slug: "moda", weight: 2 },
  { kind: "department", id: "1703496031", slug: "bebe", weight: 1 },
  { kind: "department", id: "1951052031", slug: "automovil", weight: 1 },
  { kind: "department", id: "2665403031", slug: "deportes", weight: 1 },
  { kind: "department", id: "599392031", slug: "hogar", weight: 1 },
  { kind: "department", id: "667050031", slug: "tecnologia", weight: 1 },
  { kind: "department", id: "1571260031", slug: "jardin", weight: 1 },
  { kind: "department", id: "599386031", slug: "juguetes", weight: 1 },
  { kind: "department", id: "599383031", slug: "videojuegos", weight: 1 },
  // Mascotas: búsquedas de ofertas reales (el node en /events/deals no filtra).
  {
    kind: "url",
    url: "https://www.amazon.es/s?i=pets&bbn=12472654031&rh=p_n_deal_type%3A23566065031",
    slug: "mascotas",
    weight: 2,
  },
  {
    kind: "url",
    url: "https://www.amazon.es/s?k=pienso+perro&rh=p_n_deal_type%3A23566065031",
    slug: "mascotas",
    weight: 1,
  },
  {
    kind: "url",
    url: "https://www.amazon.es/s?k=arena+gatos&rh=p_n_deal_type%3A23566065031",
    slug: "mascotas",
    weight: 1,
  },
  {
    kind: "url",
    url: "https://www.amazon.es/s?k=collar+perro&rh=p_n_deal_type%3A23566065031",
    slug: "mascotas",
    weight: 1,
  },
] as const;

/** @deprecated alias — usa FLASH_FEED_SOURCES. */
export const FLASH_DEPARTMENT_FEEDS = FLASH_FEED_SOURCES.filter(
  (feed): feed is Extract<FlashFeedSource, { kind: "department" }> =>
    feed.kind === "department",
);

/** @deprecated Usa FLASH_FEED_SOURCES. */
export const FLASH_DEPARTMENT_IDS = FLASH_DEPARTMENT_FEEDS.map(
  (feed) => feed.id,
);

const FLASH_DEPARTMENT_BY_ID = new Map(
  FLASH_DEPARTMENT_FEEDS.map((feed) => [feed.id, feed] as const),
);

const FLASH_URL_BY_EXACT = new Map(
  FLASH_FEED_SOURCES.filter(
    (feed): feed is Extract<FlashFeedSource, { kind: "url" }> =>
      feed.kind === "url",
  ).map((feed) => [feed.url, feed] as const),
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

export function flashFeedUrl(feed: FlashFeedSource): string {
  return feed.kind === "url"
    ? feed.url
    : buildAmazonDealsDepartmentUrl(feed.id);
}

export function flashFeedKey(feed: FlashFeedSource): string {
  return feed.kind === "url" ? `url:${feed.url}` : `dept:${feed.id}`;
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

export function flashCategorySlugForFeedUrl(
  url: string,
): SiteCategorySlug | null {
  const exact = FLASH_URL_BY_EXACT.get(url);
  if (exact) return exact.slug;

  const fromDept = flashCategorySlugForDepartmentId(
    flashDepartmentIdFromFeedUrl(url),
  );
  if (fromDept) return fromDept;

  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("i") === "pets") return "mascotas";
    if (parsed.searchParams.get("bbn") === "12472654031") return "mascotas";
  } catch {
    /* ignore */
  }
  return null;
}

/** Descarta basura cuando el feed de categoría trae chollos de otra sección. */
export function titleConflictsWithFeedCategory(
  title: string | null | undefined,
  expectedSlug: SiteCategorySlug | null | undefined,
): boolean {
  if (!expectedSlug || !title?.trim()) return false;
  const t = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const isTech =
    /\b(smartphone|iphone|galaxy|portatil|laptop|chromebook|televisor|\btv\b|auriculares|airpods|xbox|playstation|nintendo)\b/.test(
      t,
    );
  const isPet =
    /\b(perro|gato|mascota|pienso|collar|correa|arena|rascador|comedero|juguete para|cachorro)\b/.test(
      t,
    );

  if (expectedSlug === "mascotas") {
    if (isTech && !isPet) return true;
    if (
      /\b(smartphone|portatil|televisor|chromebook|dji mic|ideaPad)\b/.test(t)
    ) {
      return true;
    }
  }
  return false;
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

function buildWeightedFeedPool(): FlashFeedSource[] {
  const pool: FlashFeedSource[] = [];
  for (const feed of FLASH_FEED_SOURCES) {
    const times = Math.max(1, Math.floor(feed.weight));
    for (let i = 0; i < times; i += 1) pool.push(feed);
  }
  return pool;
}

/**
 * Feeds a scrapear en esta pasada.
 * - `AMAZON_FLASH_FEED_URLS`: lista fija (coma o salto de línea).
 * - Si no: N fuentes con peso (Belleza/Moda/Mascotas más frecuentes).
 * - Goldbox genérico solo de vez en cuando.
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
      ? Math.min(Math.floor(perRunRaw), FLASH_FEED_SOURCES.length)
      : 3;
  const slotMs = options?.slotMs ?? 3 * 60 * 1000;
  const now = options?.now ?? Date.now();
  const slot = Math.floor(now / slotMs);
  const pool = buildWeightedFeedPool();

  const picked: FlashFeedSource[] = [];
  const seenKeys = new Set<string>();
  let cursor = 0;
  while (picked.length < perRun && cursor < pool.length * 3) {
    const feed = pool[(slot * perRun + cursor) % pool.length]!;
    cursor += 1;
    const key = flashFeedKey(feed);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    picked.push(feed);
  }

  const urls = picked.map((feed) => flashFeedUrl(feed));

  if (slot % 10 === 0) {
    return ["https://www.amazon.es/gp/goldbox", ...urls];
  }
  return urls;
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
    const expectedCategorySlug = flashCategorySlugForFeedUrl(url);
    try {
      const html = await fetchAmazonPageHtml(url, { timeoutMs });
      feedsFetched += 1;
      for (const item of collectAsinsFromHtml(
        html,
        url,
        expectedCategorySlug,
      )) {
        if (
          titleConflictsWithFeedCategory(
            item.titleHint,
            expectedCategorySlug,
          )
        ) {
          continue;
        }
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
