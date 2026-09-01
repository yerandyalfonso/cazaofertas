import * as cheerio from "cheerio";
import { discoverAmazonClipCoupons } from "./amazonCoupons";
import { discoverAwinCoupons } from "./awin";
import { discoverMiraviaCatalogueCoupons } from "./miraviaCatalogue";
import type { DiscoveredCoupon } from "./types";
import { extractExpiry, fetchHtml, pageTitle } from "./http";

function uniqueByCode(items: DiscoveredCoupon[]): DiscoveredCoupon[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.retailer}:${item.code.toUpperCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function slugCode(prefix: string, label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${prefix}-${slug || "PROMO"}`.slice(0, 32);
}

function isPlausibleRedeemCode(code: string): boolean {
  const c = code.toUpperCase();
  if (c.length < 4 || c.length > 20) return false;
  if (c.startsWith("_") || c.includes("_")) return false;
  if (/[^A-Z0-9-]/.test(c)) return false;
  // Debe mezclar letras y números, o ser keyword promo conocida
  const hasDigit = /\d/.test(c);
  const hasLetter = /[A-Z]/.test(c);
  if (!(hasDigit && hasLetter) && !/^(WELCOME|NEWSLETTER|PROMO|VIP|SAVE|OFFER)/.test(c)) {
    return false;
  }
  const deny = [
    "HTTP",
    "HTTPS",
    "HTML",
    "JSON",
    "TRUE",
    "FALSE",
    "NULL",
    "AMAZON",
    "KIABI",
    "MIRAVIA",
    "CARREFOUR",
    "PEDIDO",
    "CUPON",
    "CUPÓN",
    "DESCUENTO",
    "PROMOCION",
    "OFERTA",
    "TICKET",
    "COLOR",
    "IMAGE",
    "BUTTON",
    "SCRIPT",
    "STYLE",
    "WIDTH",
    "HEIGHT",
    "MARCAS",
    "FESTIVAL",
    "QUIERO",
    "CANJEADOS",
    "CIONES",
  ];
  if (deny.some((d) => c === d || c.includes(d))) return false;
  return true;
}

function coupon(opts: {
  retailer: string;
  code: string;
  title: string;
  description: string;
  url: string;
  text?: string;
  externalId?: string;
  terms?: string;
}): DiscoveredCoupon {
  const code = opts.code.toUpperCase();
  return {
    retailer: opts.retailer,
    title: opts.title.slice(0, 120),
    code,
    description: opts.description.slice(0, 280),
    url: opts.url,
    expiresAt: opts.text ? extractExpiry(opts.text) : undefined,
    source: "scrape",
    externalId: opts.externalId ?? `${opts.retailer}:${code}`,
    terms: opts.terms?.trim() || undefined,
  };
}

function codesNearKeywords(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(
    /(?:c[oó]digo(?:\s+de\s+descuento)?|cup[oó]n|voucher|promo\s*code)\s*[:\-#]?\s*([A-Z0-9-]{4,16})/gi,
  )) {
    const code = match[1]?.toUpperCase();
    if (code && isPlausibleRedeemCode(code)) found.push(code);
  }
  return found;
}

function jsonVoucherCodes(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(
    /"(?:voucherCode|couponCode|promoCode|promotionCode|discountCode)"\s*:\s*"([^"]+)"/gi,
  )) {
    const code = match[1]?.trim().toUpperCase();
    if (code && isPlausibleRedeemCode(code)) found.push(code);
  }
  return found;
}

/** Miravia: Centro de cupones (catálogo oficial). */
export async function discoverMiraviaCoupons(): Promise<DiscoveredCoupon[]> {
  return discoverMiraviaCatalogueCoupons();
}

export async function discoverKiabiCoupons(): Promise<DiscoveredCoupon[]> {
  const urls = [
    "https://www.kiabi.es/promociones_464410",
    "https://www.kiabi.es/",
  ];
  const found: DiscoveredCoupon[] = [];

  for (const url of urls) {
    const html = await fetchHtml(url, { referer: "https://www.kiabi.es/" });
    if (!html) continue;

    const title = pageTitle(html) ?? "Promociones Kiabi";
    const $ = cheerio.load(html);
    const bodyText = $("body").text().replace(/\s+/g, " ").slice(0, 20_000);

    for (const code of [...codesNearKeywords(bodyText), ...jsonVoucherCodes(html)]) {
      found.push(
        coupon({
          retailer: "kiabi",
          code,
          title: `Cupón Kiabi ${code}`,
          description: `Detectado en ${title}.`,
          url,
          text: bodyText,
        }),
      );
    }

    if (/promo|rebaj|descuento|-%/i.test(title) || /rebaj|descuento/i.test(bodyText.slice(0, 2500))) {
      found.push(
        coupon({
          retailer: "kiabi",
          code: "PROMO-KIABI",
          title: title.slice(0, 120),
          description:
            "Promoción activa en Kiabi (sin código público; el descuento se aplica en tienda).",
          url: "https://www.kiabi.es/promociones_464410",
          text: bodyText,
          externalId: "kiabi:promociones",
        }),
      );
    }
  }

  return uniqueByCode(found);
}

/** Amazon: deals → cupones clip (condiciones en cada ficha). */
export async function discoverAmazonCoupons(): Promise<DiscoveredCoupon[]> {
  return discoverAmazonClipCoupons();
}

export async function discoverCarrefourCoupons(): Promise<DiscoveredCoupon[]> {
  const urls = [
    "https://www.carrefour.es/promociones",
    "https://www.carrefour.es/",
  ];
  const found: DiscoveredCoupon[] = [];

  // Mismos headers/reintentos que el scrape de productos (menos 403 genérico).
  const { fetchCarrefourHtml } = await import(
    "@/providers/retail/carrefour/carrefourHttp"
  );

  for (const url of urls) {
    let html: string;
    try {
      html = await fetchCarrefourHtml(url, {
        referer: "https://www.carrefour.es/",
        timeoutMs: 18_000,
      });
    } catch (error) {
      console.warn(`[coupons] Carrefour ${url}:`, (error as Error).message);
      continue;
    }

    if (/just a moment|cf-browser-verification|challenge-platform/i.test(html)) {
      console.warn(`[coupons] Carrefour bloqueado (CF): ${url}`);
      continue;
    }

    const title = pageTitle(html) ?? "Promociones Carrefour";
    const $ = cheerio.load(html);
    const bodyText = $("body").text().replace(/\s+/g, " ").slice(0, 20_000);

    for (const code of [...codesNearKeywords(bodyText), ...jsonVoucherCodes(html)]) {
      found.push(
        coupon({
          retailer: "carrefour",
          code,
          title: `Cupón Carrefour ${code}`,
          description: `Detectado en ${title}.`,
          url,
          text: bodyText,
        }),
      );
    }

    if (/club carrefour|promoci|descuento|cup[oó]n/i.test(bodyText.slice(0, 2500))) {
      found.push(
        coupon({
          retailer: "carrefour",
          code: "CLUB-CARREFOUR",
          title: "Club Carrefour y promociones",
          description:
            "Cupones del Club Carrefour (suelen requerir cuenta). Revisa promociones activas.",
          url: "https://www.carrefour.es/promociones",
          text: bodyText,
          externalId: "carrefour:promociones",
        }),
      );
    }
  }

  return uniqueByCode(found);
}

export async function discoverAllCoupons(): Promise<DiscoveredCoupon[]> {
  const scrapeEnabled = process.env.COUPON_SCRAPE_ENABLED !== "0";
  const awinEnabled = process.env.COUPON_AWIN_ENABLED === "1";

  const tasks: Promise<DiscoveredCoupon[]>[] = [];
  if (scrapeEnabled) {
    tasks.push(
      discoverMiraviaCoupons(),
      discoverKiabiCoupons(),
      discoverAmazonCoupons(),
      discoverCarrefourCoupons(),
    );
  }
  if (awinEnabled) {
    tasks.push(discoverAwinCoupons());
  }

  if (tasks.length === 0) {
    console.log(
      "[coupons] Sin fuentes automáticas (COUPON_SCRAPE_ENABLED=0 y Awin off). Usa el admin para cupones manuales.",
    );
    return [];
  }

  const batches = await Promise.all(tasks);
  // Preferir afiliado (si está) sobre scrape ante el mismo código.
  return uniqueByCode(batches.flat());
}
