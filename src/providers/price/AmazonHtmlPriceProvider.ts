import * as cheerio from "cheerio";
import { extractAsin, generateAmazonUrl } from "@/lib/affiliate";
import { formatDescriptionForStorage } from "@/lib/product-description";
import type { PriceProvider, ProductPriceData } from "@/providers/price/types";
import { ProductAvailability } from "@/types";

export interface AmazonHtmlPriceProviderOptions {
  /** Mapa ASIN → URL de producto en Amazon. */
  urlByAsin?: Map<string, string>;
  /** Pausa entre peticiones para reducir bloqueos (ms). */
  delayMs?: number;
  /** Timeout por petición (ms). */
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const BROWSER_HEADERS_BASE: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

/** CP Madrid: fuerza catálogo ES con IVA aunque el fetch salga desde Vercel (IP US). */
const AMAZON_ES_ZIP = (process.env.AMAZON_ES_ZIP ?? "28001").trim() || "28001";
const AMAZON_ES_ADDRESS_CHANGE =
  "https://www.amazon.es/gp/delivery/ajax/address-change.html";

/** Céntimos habituales en precios de escaparate Amazon ES. */
const AMAZON_SHELF_CENTS = new Set([
  0, 5, 9, 10, 20, 25, 30, 40, 45, 49, 50, 60, 70, 75, 80, 90, 95, 99,
]);

type CookieJar = Map<string, string>;

let sharedCookieJar: CookieJar | null = null;
let spainDeliveryReady = false;
let spainDeliveryPromise: Promise<CookieJar> | null = null;

function defaultCookieJar(): CookieJar {
  return new Map([
    ["lc-acbes", "es_ES"],
    ["i18n-prefs", "EUR"],
    ["skin", "noskin"],
    ["sp-cdn", '"L5Z9:ES"'],
  ]);
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function absorbSetCookies(jar: CookieJar, response: Response): void {
  const list =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  for (const raw of list) {
    const segments = raw.split(";");
    const first = segments[0];
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    let expiresAt: number | null = null;
    for (const segment of segments.slice(1)) {
      const [rawKey, ...rest] = segment.split("=");
      const key = rawKey?.trim().toLowerCase();
      if (key === "expires" && rest.length > 0) {
        const parsed = Date.parse(rest.join("=").trim());
        if (Number.isFinite(parsed)) expiresAt = parsed;
      }
    }
    // Marcadores de borrado (value "-" + Expires pasado) no deben pisar la sesión.
    if (expiresAt !== null && expiresAt < Date.now()) {
      continue;
    }
    if (value === "-") continue;
    jar.set(name, value);
  }
}

function browserHeaders(jar: CookieJar, extra?: HeadersInit): HeadersInit {
  return {
    ...BROWSER_HEADERS_BASE,
    Cookie: cookieHeader(jar),
    ...(extra ?? {}),
  };
}

/**
 * ¿Parece un precio de etiqueta Amazon ES (99 céntimos, .90, entero…)?
 * Los importes «sin IVA» (p.ej. 793,38 = 959,99/1,21) suelen fallar este test.
 */
export function looksLikeAmazonShelfPrice(value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  const cents = Math.round(value * 100) % 100;
  return AMAZON_SHELF_CENTS.has(cents);
}

/**
 * Legacy no-op: solo operamos amazon.es con IVA ya incluido.
 * Se mantiene exportado por compatibilidad; no multiplica ×1,21.
 */
export function maybeRestoreSpanishVat(
  value: number,
  _options: { foreignDelivery?: boolean } = {},
): number {
  return Math.round(value * 100) / 100;
}

/** Legacy no-op: devolvemos el par tal cual viene de Amazon ES. */
export function maybeRestoreSpanishVatPair(
  price: number,
  listPrice: number | null,
  _options: { foreignDelivery?: boolean } = {},
): { price: number; listPrice: number | null } {
  const roundedPrice = Math.round(price * 100) / 100;
  const roundedList =
    listPrice != null && listPrice > 0
      ? Math.round(listPrice * 100) / 100
      : null;
  return {
    price: roundedPrice,
    listPrice:
      roundedList != null && roundedList > roundedPrice ? roundedList : null,
  };
}

function glowDeliveryText(html: string): string {
  const line1 =
    html.match(/id="glow-ingress-line1"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
  const line2 =
    html.match(/id="glow-ingress-line2"[^>]*>([\s\S]*?)<\//i)?.[1] ?? "";
  return `${line1} ${line2}`.replace(/\s+/g, " ").trim();
}

function isForeignDeliveryGlow(html: string): boolean {
  const glow = glowDeliveryText(html);
  if (!glow) return false;
  if (/españa|spain|\bES\b|madrid|barcelona|28001/i.test(glow)) return false;
  return /estados unidos|united states|deutschland|france|italy|united kingdom|japan/i.test(
    glow,
  );
}

/** Última respuesta HTML venía con entrega fuera de ES (p. ej. Vercel → US). */
let lastFetchForeignDelivery = false;

function extractGlowCsrfToken(html: string): string | null {
  return (
    html.match(/name="anti-csrftoken-a2z"\s+value="([^"]+)"/i)?.[1] ??
    html.match(/anti-csrftoken-a2z["'\s:=]+["']?([^"'\s]+)/i)?.[1] ??
    html.match(/glowValidationToken["'\s:=]+["']?([^"'\s]+)/i)?.[1] ??
    html.match(/CSRF_TOKEN\s*:\s*"([^"]+)"/i)?.[1] ??
    null
  );
}

async function postSpainAddressChange(
  fetchImpl: typeof fetch,
  jar: CookieJar,
  signal: AbortSignal,
  csrf: string | null,
): Promise<boolean> {
  const endpoints = [
    AMAZON_ES_ADDRESS_CHANGE,
    "https://www.amazon.es/portal-migration/hz/glow/address-change",
  ];

  const bodies = [
    new URLSearchParams({
      locationType: "LOCATION_INPUT",
      zipCode: AMAZON_ES_ZIP,
      storeContext: "generic",
      deviceType: "web",
      pageType: "Gateway",
      actionSource: "glow",
      almBrandId: "undefined",
    }),
    new URLSearchParams({
      locationType: "LOCATION_INPUT",
      zipCode: AMAZON_ES_ZIP,
      countryCode: "ES",
      storeContext: "generic",
      deviceType: "web",
      pageType: "Gateway",
      actionSource: "glow",
      almBrandId: "undefined",
    }),
  ];

  for (const endpoint of endpoints) {
    for (const body of bodies) {
      const change = await fetchImpl(endpoint, {
        method: "POST",
        headers: browserHeaders(jar, {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json, text/javascript, */*; q=0.01",
          ...(csrf ? { "anti-csrftoken-a2z": csrf } : {}),
          Referer: "https://www.amazon.es/",
          Origin: "https://www.amazon.es",
        }),
        body,
        signal,
        redirect: "follow",
      });
      absorbSetCookies(jar, change);
      const payload = (await change.json().catch(() => null)) as {
        isValidAddress?: number | boolean;
        successful?: number | boolean;
        address?: { countryCode?: string; zipCode?: string };
      } | null;

      if (payload?.isValidAddress || payload?.successful) {
        return true;
      }
    }
  }
  return false;
}

async function ensureSpainDeliverySession(
  fetchImpl: typeof fetch,
  timeoutMs: number,
  options: { force?: boolean } = {},
): Promise<CookieJar> {
  if (!options.force && spainDeliveryReady && sharedCookieJar) {
    return sharedCookieJar;
  }
  if (spainDeliveryPromise) return spainDeliveryPromise;

  spainDeliveryPromise = (async () => {
    const jar = options.force
      ? defaultCookieJar()
      : (sharedCookieJar ?? defaultCookieJar());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const home = await fetchImpl("https://www.amazon.es/?language=es_ES", {
        method: "GET",
        headers: browserHeaders(jar),
        signal: controller.signal,
        redirect: "follow",
      });
      absorbSetCookies(jar, home);
      const homeHtml = await home.text().catch(() => "");
      const csrf = extractGlowCsrfToken(homeHtml);

      // Token fresco del modal de dirección (mejor en IPs fuera de ES).
      let glowCsrf = csrf;
      try {
        const selections = await fetchImpl(
          "https://www.amazon.es/gp/glow/get-address-selections.html?deviceType=desktop&pageType=Gateway&storeContext=NoStoreName&actionSource=desktop-modal",
          {
            method: "GET",
            headers: browserHeaders(jar, {
              ...(csrf ? { "anti-csrftoken-a2z": csrf } : {}),
              Accept: "text/html,*/*",
              Referer: "https://www.amazon.es/",
            }),
            signal: controller.signal,
            redirect: "follow",
          },
        );
        absorbSetCookies(jar, selections);
        const selHtml = await selections.text().catch(() => "");
        glowCsrf = extractGlowCsrfToken(selHtml) ?? glowCsrf;
      } catch {
        // endpoint a veces 404; el POST directo suele bastar
      }

      const ok = await postSpainAddressChange(
        fetchImpl,
        jar,
        controller.signal,
        glowCsrf,
      );

      if (!ok) {
        console.warn(
          "[AmazonHtml] No se pudo fijar CP España; se continúa (restore IVA si hace falta).",
        );
      }

      sharedCookieJar = jar;
      spainDeliveryReady = true;
      return jar;
    } catch (error) {
      console.warn(
        "[AmazonHtml] Pin de entrega ES falló:",
        error instanceof Error ? error.message : error,
      );
      sharedCookieJar = jar;
      spainDeliveryReady = true;
      return jar;
    } finally {
      clearTimeout(timer);
    }
  })();

  try {
    return await spainDeliveryPromise;
  } finally {
    spainDeliveryPromise = null;
  }
}

function amazonEsProductUrl(asin: string, preferredUrl?: string): string {
  if (preferredUrl && /amazon\.es\//i.test(preferredUrl) && preferredUrl.includes(asin)) {
    try {
      const url = new URL(preferredUrl);
      url.searchParams.set("language", "es_ES");
      url.searchParams.set("currency", "EUR");
      url.searchParams.set("th", "1");
      url.searchParams.set("psc", "1");
      return url.toString();
    } catch {
      // fall through
    }
  }
  return `https://www.amazon.es/dp/${asin}?language=es_ES&currency=EUR&th=1&psc=1`;
}

function collectPricesFromSelectors(
  $: cheerio.CheerioAPI,
  selectors: string[],
): number[] {
  const values: number[] = [];
  const seen = new Set<number>();
  for (const selector of selectors) {
    const nodes = $(selector);
    for (let i = 0; i < nodes.length; i += 1) {
      const price = parseAmazonPriceText(nodes.eq(i).text());
      if (price === null || seen.has(price)) continue;
      seen.add(price);
      values.push(price);
    }
  }
  return values;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parsea importes estilo ES (79,99 / 1.234,56) o EN (79.99). */
export function parseAmazonPriceText(raw: string): number | null {
  let text = raw
    .replace(/\u00a0/g, " ")
    .replace(/[^\d,.\-]/g, "")
    .trim();

  if (!text) return null;

  // Entero de .a-price-whole suele venir como "9," (coma sobrante).
  if (/^\d+[.,]$/.test(text)) return null;

  // whole+fraction mal unidos → "9,,79"
  text = text.replace(/,{2,}/g, ",").replace(/\.{2,}/g, ".");

  let normalized = text;
  if (/\d{1,3}(\.\d{3})+,\d{1,2}$/.test(text) || /^\d+,\d{1,2}$/.test(text)) {
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (/\d{1,3}(,\d{3})+\.\d{1,2}$/.test(text)) {
    normalized = text.replace(/,/g, "");
  } else if (text.includes(",") && !text.includes(".")) {
    normalized = text.replace(",", ".");
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 100_000) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function firstPriceFromSelectors(
  $: cheerio.CheerioAPI,
  selectors: string[],
): number | null {
  for (const selector of selectors) {
    const nodes = $(selector);
    for (let i = 0; i < nodes.length; i += 1) {
      const text = nodes.eq(i).text();
      const price = parseAmazonPriceText(text);
      if (price !== null) return price;
    }
  }
  return null;
}

/** Fallback cuando `.a-offscreen` viene vacío pero hay whole+fraction. */
function priceFromWholeFraction(
  $: cheerio.CheerioAPI,
  rootSelector: string,
): number | null {
  const roots = $(rootSelector);
  for (let i = 0; i < roots.length; i += 1) {
    const root = roots.eq(i);
    if (root.hasClass("a-text-price")) continue;
    const el = roots.get(i);
    if (el && isSecondaryOfferPriceNode($, el)) continue;
    // Solo dígitos: Amazon deja "9," en .a-price-whole.
    const whole = root.find(".a-price-whole").first().text().replace(/[^\d]/g, "");
    const fraction = root
      .find(".a-price-fraction")
      .first()
      .text()
      .replace(/[^\d]/g, "");
    if (!whole) continue;
    const combined = fraction ? `${whole},${fraction}` : whole;
    const price = parseAmazonPriceText(combined);
    if (price !== null && price >= 1) return price;
  }
  return null;
}

/**
 * Precio de «Comprar nuevo» (one-time). Ignora Suscríbete y ahorra / 2ª mano.
 * En fichas con acordeón, esos bloques también usan .priceToPay y el whole
 * "8," se parseaba antes como 8,00 €.
 */
function priceFromOneTimeBuyBox($: cheerio.CheerioAPI): number | null {
  const preferredRoots = [
    "#apex_desktop_newAccordionRow",
    "#ppd_newAccordionRow",
    "#newAccordionRow",
    "#newAccordionRow_0",
    "#buyBoxAccordion .a-accordion-active",
  ];

  for (const root of preferredRoots) {
    if ($(root).length === 0) continue;
    const fromOffscreen = firstPriceFromSelectors($, [
      `${root} .reinventPricePriceToPayMargin.priceToPay span.a-offscreen`,
      `${root} .apex-pricetopay-value span.a-offscreen`,
      `${root} span.a-price.priceToPay:not(.a-text-price) span.a-offscreen`,
      `${root} span.a-price[data-a-size='l'] span.a-offscreen`,
      `${root} span.a-price:not(.a-text-price) span.a-offscreen`,
    ]);
    if (fromOffscreen !== null && fromOffscreen >= 1) return fromOffscreen;

    const fromParts = priceFromWholeFraction(
      $,
      [
        `${root} .reinventPricePriceToPayMargin.priceToPay`,
        `${root} .apex-pricetopay-value`,
        `${root} span.a-price.priceToPay`,
        `${root} span.a-price[data-a-size='l']`,
      ].join(", "),
    );
    if (fromParts !== null && fromParts >= 1) return fromParts;
  }

  return null;
}

function isSecondaryOfferPriceNode(
  $: cheerio.CheerioAPI,
  el: Parameters<cheerio.CheerioAPI>[0],
): boolean {
  const $el = $(el);
  const chain = [$el, ...$el.parents().toArray().map((p) => $(p))]
    .map((node) => `${node.attr("id") ?? ""} ${node.attr("class") ?? ""}`)
    .join(" ")
    .toLowerCase();
  return /sns|subscribe|subscription|usedaccordion|apex_desktop_used|apex_desktop_sns|tiered-price/.test(
    chain,
  );
}

/** Recoge precios de selectores ignorando SNS / 2ª mano / precio unitario. */
function collectBuyBoxPayPrices(
  $: cheerio.CheerioAPI,
  selectors: string[],
): number[] {
  const values: number[] = [];
  const seen = new Set<number>();
  for (const selector of selectors) {
    const nodes = $(selector);
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes.get(i);
      if (!el || isSecondaryOfferPriceNode($, el)) continue;
      const price = parseAmazonPriceText(nodes.eq(i).text());
      // Descarta €/unidad (0,27€) y basura.
      if (price === null || price < 1 || seen.has(price)) continue;
      seen.add(price);
      values.push(price);
    }
  }
  return values;
}

function priceFromPageScripts(html: string): number | null {
  // Solo señales del precio a pagar. Nunca el primer priceAmount suelto (puede ser un relacionado).
  const patterns = [
    /"priceToPay"\s*:\s*\{[^}]{0,120}?"amount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"priceToPay"[\s\S]{0,160}?"value"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"buyingPrice"\s*:\s*\{[^}]{0,80}?"amount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/i,
    /"desktop_buybox"[\s\S]{0,400}?"displayPrice"\s*:\s*"([^"]+)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const price = parseAmazonPriceText(match[1]);
    if (price !== null) return price;
  }
  return null;
}

function availabilityFromHtml($: cheerio.CheerioAPI): ProductAvailability {
  const availability = $("#availability").text().toLowerCase();
  if (
    availability.includes("no disponible") ||
    availability.includes("agotado") ||
    availability.includes("currently unavailable")
  ) {
    return ProductAvailability.OUT_OF_STOCK;
  }
  if (availability.includes("preventa") || availability.includes("pre-order")) {
    return ProductAvailability.PREORDER;
  }
  return ProductAvailability.IN_STOCK;
}

function listPriceFromPageScripts(html: string): number | null {
  const patterns = [
    /"basisPrice"\s*:\s*"?([0-9]+(?:[.,][0-9]+)?)"?/,
    /"basisPriceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
    /"landingAsinPrice"[\s\S]{0,200}?"basisPriceAmount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const price = parseAmazonPriceText(match[1]);
    if (price !== null) return price;
  }
  return null;
}

const BUYBOX_ROOTS = [
  "#corePrice_feature_div",
  "#corePriceDisplay_desktop_feature_div",
  "#apex_desktop",
  "#desktop_buybox",
  "#buybox",
] as const;

function buyboxSelectors(suffix: string): string[] {
  return BUYBOX_ROOTS.map((root) => `${root} ${suffix}`);
}

/** Solo badges del bloque de precio principal (nunca carruseles / relacionados). */
function discountFromSavingsBadge($: cheerio.CheerioAPI): number | null {
  const selectors = buyboxSelectors("span.savingsPercentage").concat([
    "#dealprice_savingspercentage",
  ]);

  for (const selector of selectors) {
    const text = $(selector).first().text();
    const match = text.match(/(\d{1,3})\s*%/);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isFinite(value) && value > 0 && value < 100) return value;
  }
  return null;
}

function detectFlashDeal($: cheerio.CheerioAPI, html: string): boolean {
  const badgeText = [
    $("#dealBadge_feature_div").text(),
    $("#gatedDealsBadge_feature_div").text(),
    $("[data-feature-name='dealBadge']").text(),
    $(".dealBadge").text(),
    $("#dealBadgeSupportingText").text(),
    $("[id*='dealBadge']").text(),
  ]
    .join(" ")
    .toLowerCase();

  if (
    /oferta\s*flash|lightning\s*deal|oferta\s*rel[aá]mpago|deal of the day|oferta del d[ií]a|precio\s*rel[aá]mpago|ventas\s*r[aá]pidas|oferta\s*con\s*ventas/.test(
      badgeText,
    )
  ) {
    return true;
  }

  if (
    /isLightningDeal["\s:]*true|dealType["\s:]*["']LIGHTNING|lightningDeal|OFERTA\s*FLASH|ventas\s*r[aá]pidas/i.test(
      html,
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Precio actual (a pagar) vs referencia (precio recomendado / lista).
 * Evita tomar el «mínimo 30 días» como lista y precios de widgets secundarios.
 */
export function extractPriceFromAmazonHtml(html: string): {
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  isFlashDeal: boolean;
  title?: string;
  brand?: string;
  imageUrl?: string;
  description?: string;
  availability: ProductAvailability;
} {
  const $ = cheerio.load(html);

  // 1) «Comprar nuevo» del acordeón (evita SNS 8,81 / usado / whole "8," → 8,00).
  // 2) Buy box genérico excluyendo bloques secundarios.
  // 3) whole+fraction y scripts.
  const payCandidates = collectBuyBoxPayPrices(
    $,
    buyboxSelectors(
      ".reinventPricePriceToPayMargin.priceToPay span.a-offscreen",
    ).concat(
      buyboxSelectors(".apex-pricetopay-value span.a-offscreen"),
      buyboxSelectors(
        "span.a-price.priceToPay:not(.a-text-price) span.a-offscreen",
      ),
      buyboxSelectors("span.a-price:not(.a-text-price) span.a-offscreen"),
      ["#priceblock_dealprice", "#priceblock_saleprice", "#priceblock_ourprice"],
    ),
  );
  let price =
    priceFromOneTimeBuyBox($) ??
    payCandidates[0] ??
    priceFromWholeFraction(
      $,
      [
        "#apex_desktop_newAccordionRow .reinventPricePriceToPayMargin.priceToPay",
        "#apex_desktop_newAccordionRow .apex-pricetopay-value",
        ...buyboxSelectors(
          ".reinventPricePriceToPayMargin.priceToPay, .apex-pricetopay-value, .priceToPay",
        ),
      ].join(", "),
    ) ??
    // Último recurso: solo patrones priceToPay en JSON (no priceAmount suelto).
    priceFromPageScripts(html);

  // Precio recomendado / lista: solo basis del buy box (nunca mini de relacionados).
  const listCandidates = collectPricesFromSelectors(
    $,
    buyboxSelectors(".apex-basisprice-value span.a-offscreen").concat(
      buyboxSelectors(".basisPrice .a-offscreen"),
      buyboxSelectors(
        "span.a-price.a-text-price:not(.srpPriceBlockAUI) span.a-offscreen",
      ),
      ["#listPrice"],
    ),
  );
  const scriptList = listPriceFromPageScripts(html);
  if (scriptList !== null && !listCandidates.includes(scriptList)) {
    listCandidates.push(scriptList);
  }

  const badgeDiscount = discountFromSavingsBadge($);
  let listPrice =
    listCandidates.length > 0 ? Math.max(...listCandidates) : null;

  // Alinear lista con el badge del buy box (−33%, etc.).
  if (price !== null && badgeDiscount !== null && listCandidates.length > 0) {
    const impliedList =
      Math.round((price / (1 - badgeDiscount / 100)) * 100) / 100;
    let best: number | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const candidate of listCandidates) {
      if (candidate <= price) continue;
      const pct = ((candidate - price) / candidate) * 100;
      const delta = Math.abs(pct - badgeDiscount);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = candidate;
      }
    }
    if (best !== null && bestDelta <= 6) {
      listPrice = Math.round(best * 100) / 100;
    } else if (impliedList > price) {
      listPrice = impliedList;
    }
  } else if (
    (listPrice === null || (price !== null && listPrice <= price)) &&
    price !== null &&
    badgeDiscount !== null
  ) {
    const reconstructed =
      Math.round((price / (1 - badgeDiscount / 100)) * 100) / 100;
    if (reconstructed > price) listPrice = reconstructed;
  }

  if (listPrice !== null && price !== null && listPrice <= price) {
    listPrice = null;
  }

  let discountPercentage: number | null = null;
  if (price !== null && listPrice !== null && listPrice > price) {
    discountPercentage =
      Math.round(((listPrice - price) / listPrice) * 10000) / 100;
  } else if (badgeDiscount !== null) {
    discountPercentage = badgeDiscount;
  }

  const isFlashDeal =
    detectFlashDeal($, html) ||
    (discountPercentage !== null &&
      discountPercentage >= 20 &&
      listPrice !== null);

  const title =
    $("#productTitle").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    undefined;

  const brandRaw =
    $("#bylineInfo").text().trim() ||
    $("#brand").text().trim() ||
    $("a#brand").text().trim() ||
    $("tr.po-brand td.a-span9 span").text().trim() ||
    $("th:contains('Marca')").next("td").text().trim() ||
    "";
  const brand =
    brandRaw
      .replace(/^visita la tienda de\s+/i, "")
      .replace(/^marca:\s*/i, "")
      .replace(/^brand:\s*/i, "")
      .trim() || undefined;

  let imageUrl: string | undefined =
    $("#landingImage").attr("data-old-hires") ||
    $("#imgTagWrapperId img").attr("data-old-hires") ||
    $("#landingImage").attr("src") ||
    $("#imgTagWrapperId img").attr("src") ||
    $("meta[property='og:image']").attr("content")?.trim() ||
    $("img#main-image").attr("src") ||
    undefined;

  const dynamicImage = $("#landingImage").attr("data-a-dynamic-image");
  if ((!imageUrl || imageUrl.startsWith("data:")) && dynamicImage) {
    try {
      const map = JSON.parse(dynamicImage) as Record<string, unknown>;
      const first = Object.keys(map)[0];
      if (first && /^https?:\/\//i.test(first)) imageUrl = first;
    } catch {
      const match = dynamicImage.match(/"(https:[^"]+)"/);
      if (match?.[1]) imageUrl = match[1];
    }
  }

  const cleanImageUrl =
    imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined;
  const cleanBrand = brand && brand.length > 1 ? brand.slice(0, 120) : undefined;

  const bulletPoints: string[] = [];
  $("#feature-bullets ul li span.a-list-item, #feature-bullets li span").each(
    (_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (
        text.length > 12 &&
        !/^\s*ver más\s*$/i.test(text) &&
        !bulletPoints.includes(text)
      ) {
        bulletPoints.push(text);
      }
    },
  );
  const productDescription =
    $("#productDescription p")
      .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .join("\n\n") ||
    $("#productDescription").text().replace(/\s+/g, " ").trim() ||
    "";

  // También A+ / expander si existen (texto plano).
  const aplusBits: string[] = [];
  $(
    "#aplus_feature_div .a-spacing-base, #aplusStandalone_feature_div p, #productFactsDesktop_feature_div .a-spacing-small span",
  ).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 40 && text.length < 500 && !aplusBits.includes(text)) {
      aplusBits.push(text);
    }
  });

  const description = formatDescriptionForStorage(
    [...bulletPoints.slice(0, 12), ...aplusBits.slice(0, 6)],
    productDescription,
  );

  // amazon.es ya incluye IVA: usar el precio del buy box tal cual (sin ×1,21).
  if (listPrice !== null && price !== null && listPrice <= price) {
    listPrice = null;
  }
  if (price !== null && listPrice !== null && listPrice > price) {
    discountPercentage =
      Math.round(((listPrice - price) / listPrice) * 10000) / 100;
  }

  return {
    price,
    listPrice,
    discountPercentage,
    isFlashDeal,
    title,
    brand: cleanBrand,
    imageUrl: cleanImageUrl,
    description,
    availability: availabilityFromHtml($),
  };
}

function isRetryableAmazonFetchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /anti-bot|bloqueado|HTTP 503|HTTP 429|temporalmente no disponible|aborted|timeout/i.test(
    message,
  );
}

function resetAmazonHtmlSession(): void {
  sharedCookieJar = null;
  spainDeliveryReady = false;
  spainDeliveryPromise = null;
}

async function fetchAmazonPageHtml(
  url: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    /** Si false, no intenta fijar CP España (tests). Default true. */
    pinSpainDelivery?: boolean;
  } = {},
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const pinSpainDelivery = options.pinSpainDelivery !== false;
  // En Vercel las IPs de datacenter fallan más: más reintentos y backoff.
  const maxAttempts = process.env.VERCEL ? 3 : 2;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      if (attempt > 0) {
        resetAmazonHtmlSession();
        await sleep(1_600 * attempt + Math.round(Math.random() * 900));
      }

      let jar = pinSpainDelivery
        ? await ensureSpainDeliverySession(
            fetchImpl,
            Math.min(timeoutMs, 12_000),
            attempt > 0 ? { force: true } : undefined,
          )
        : sharedCookieJar ?? defaultCookieJar();

      const doFetch = async (): Promise<string> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(url, {
            method: "GET",
            headers: browserHeaders(jar),
            signal: controller.signal,
            redirect: "follow",
          });
          absorbSetCookies(jar, response);
          sharedCookieJar = jar;

          if (response.status === 503 || response.status === 429) {
            throw new Error(
              `Amazon temporalmente no disponible (HTTP ${response.status}).`,
            );
          }

          if (!response.ok) {
            throw new Error(
              `Respuesta HTTP ${response.status} al consultar Amazon.`,
            );
          }

          const html = await response.text();

          if (
            html.includes("api-services-support@amazon.com") ||
            html.includes("Enter the characters you see below") ||
            html.toLowerCase().includes("robot check")
          ) {
            throw new Error(
              "Amazon devolvió un challenge anti-bot (bloqueado).",
            );
          }

          return html;
        } finally {
          clearTimeout(timer);
        }
      };

      let html = await doFetch();

      // Si glow sigue en EE. UU., re-pin forzado y un reintento (no tumbar el feed).
      if (pinSpainDelivery && isForeignDeliveryGlow(html)) {
        console.warn(
          "[AmazonHtml] Glow fuera de ES; reintentando pin CP",
          AMAZON_ES_ZIP,
          "—",
          glowDeliveryText(html).slice(0, 60),
        );
        spainDeliveryReady = false;
        jar = await ensureSpainDeliverySession(
          fetchImpl,
          Math.min(timeoutMs, 12_000),
          { force: true },
        );
        html = await doFetch();
      }

      lastFetchForeignDelivery = isForeignDeliveryGlow(html);
      if (lastFetchForeignDelivery) {
        console.warn(
          "[AmazonHtml] Entrega aún fuera de ES (se mantiene el precio leído, sin ×IVA). Glow:",
          glowDeliveryText(html).slice(0, 80),
        );
      }

      return html;
    } catch (error) {
      lastError = error;
      if (!isRetryableAmazonFetchError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      console.warn(
        `[AmazonHtml] Intento ${attempt + 1}/${maxAttempts} falló, reintento:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("No se pudo leer Amazon.");
}

/** @deprecated Usar fetchAmazonPageHtml */
async function fetchAmazonProductHtml(
  url: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<string> {
  return fetchAmazonPageHtml(url, options);
}

export { fetchAmazonPageHtml };

/** Prefill admin: título/precio/lista sin exigir precio válido. */
export async function previewAmazonProductPage(
  urlOrAsin: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<{
  asin: string;
  title?: string;
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  isFlashDeal: boolean;
  amazonUrl: string;
  availability: ProductAvailability;
  brand?: string;
  imageUrl?: string;
  description?: string;
}> {
  const asin =
    extractAsin(urlOrAsin)?.toUpperCase() ||
    (/^[A-Z0-9]{10}$/i.test(urlOrAsin.trim())
      ? urlOrAsin.trim().toUpperCase()
      : null);

  if (!asin) {
    throw new Error("URL o ASIN de Amazon no válidos.");
  }

  const preferred =
    urlOrAsin.includes("http") && extractAsin(urlOrAsin) ? urlOrAsin.trim() : undefined;
  const amazonUrl = amazonEsProductUrl(asin, preferred);

  const html = await fetchAmazonPageHtml(amazonUrl, options);
  const extracted = extractPriceFromAmazonHtml(html);

  return {
    asin,
    title: extracted.title,
    price: extracted.price,
    listPrice: extracted.listPrice,
    discountPercentage: extracted.discountPercentage,
    isFlashDeal: extracted.isFlashDeal,
    amazonUrl,
    availability: extracted.availability,
    brand: extracted.brand,
    imageUrl: extracted.imageUrl,
    description: extracted.description,
  };
}

export async function scrapeAmazonProductPage(
  url: string,
  asin: string,
  options: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<ProductPriceData> {
  const amazonUrl = amazonEsProductUrl(asin, url);
  const html = await fetchAmazonPageHtml(amazonUrl, options);
  const extracted = extractPriceFromAmazonHtml(html);

  if (extracted.price === null) {
    throw new Error("No se pudo extraer el precio del HTML de Amazon.");
  }

  return {
    asin,
    price: extracted.price,
    currency: "EUR",
    availability: extracted.availability,
    title: extracted.title,
    brand: extracted.brand,
    imageUrl: extracted.imageUrl,
    amazonUrl,
    previousPrice: extracted.listPrice ?? undefined,
    discountPercentage: extracted.discountPercentage ?? undefined,
  };
}

/**
 * Proveedor de precios vía HTML de la ficha de Amazon.
 * Frágil frente a cambios de maqueta / bloqueos: preferir PA-API o Keepa a medio plazo.
 */
export class AmazonHtmlPriceProvider implements PriceProvider {
  private readonly urlByAsin: Map<string, string>;
  private readonly delayMs: number;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: AmazonHtmlPriceProviderOptions = {}) {
    this.urlByAsin = options.urlByAsin ?? new Map();
    const onVercel = Boolean(process.env.VERCEL);
    this.delayMs = options.delayMs ?? (onVercel ? 2_200 : 1_250);
    this.timeoutMs = options.timeoutMs ?? (onVercel ? 18_000 : 12_000);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getProduct(asin: string): Promise<ProductPriceData> {
    const url = this.urlByAsin.get(asin) ?? generateAmazonUrl(asin);
    return scrapeAmazonProductPage(url, asin, {
      timeoutMs: this.timeoutMs,
      fetchImpl: this.fetchImpl,
    });
  }

  async getProducts(asins: string[]): Promise<ProductPriceData[]> {
    const results: ProductPriceData[] = [];

    for (let index = 0; index < asins.length; index += 1) {
      const asin = asins[index];
      try {
        const quote = await this.getProduct(asin);
        results.push(quote);
      } catch (error) {
        console.warn(
          `[AmazonHtmlPriceProvider] ASIN ${asin}:`,
          error instanceof Error ? error.message : error,
        );
      }

      if (index < asins.length - 1 && this.delayMs > 0) {
        await sleep(this.delayMs);
      }
    }

    return results;
  }
}
