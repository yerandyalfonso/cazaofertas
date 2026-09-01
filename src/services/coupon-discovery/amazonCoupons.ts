/**
 * Cupones clip de Amazon ES (deals → bubble cups).
 * URL: https://www.amazon.es/deals?bubble-id=deals-collection-coupons
 *
 * El JSON de deals ordena campos como asin → title → coupon.
 * Un regex title→asin→promo asociaba el ASIN del producto siguiente.
 * Las condiciones viven en la ficha (`Aplicar cupón…` + validez).
 */

import * as cheerio from "cheerio";
import { extractAsin, generateAffiliateUrl } from "@/lib/affiliate";
import type { DiscoveredCoupon } from "./types";
import { fetchHtml } from "./http";

export const AMAZON_COUPON_DEALS_URL =
  process.env.AMAZON_COUPON_DEALS_URL?.trim() ||
  "https://www.amazon.es/deals?ref_=nav_cs_gb&bubble-id=deals-collection-coupons";

const MAX_ENRICH = Math.min(
  Number(process.env.AMAZON_COUPON_ENRICH_MAX ?? "40") || 40,
  80,
);

type DealHit = {
  asin: string;
  title: string;
  promoId: string;
  productPath?: string;
  payWithCoupon?: string;
};

function decodeJsonString(raw: string): string {
  return raw
    .replace(/\\"/g, '"')
    .replace(/\\u([\dA-Fa-f]{4})/g, (_, h: string) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    )
    .replace(/\\n/g, " ")
    .trim();
}

function parseDealsHtml(html: string): DealHit[] {
  // Orden real en el payload: asin, title, …, coupon{… id:/promo/XXX }
  const re =
    /"asin"\s*:\s*"([A-Z0-9]{10})"\s*,\s*"title"\s*:\s*"((?:\\.|[^"\\]){8,400})"([\s\S]{0,4200}?"coupon"\s*:\s*\{[\s\S]{0,1400}?"id"\s*:\s*"\/promo\/([A-Z0-9]+)")/gi;

  const byAsin = new Map<string, DealHit>();

  for (const match of html.matchAll(re)) {
    const asin = match[1];
    const title = decodeJsonString(match[2]).slice(0, 160);
    const tail = match[3] ?? "";
    const promoId = match[4];
    if (!asin || !title || !promoId) continue;

    const linkMatch = tail.match(
      /"link"\s*:\s*"(\/(?:[^"\\]|\\.)*\/dp\/[A-Z0-9]{10}(?:[^"\\]|\\.)*)"/i,
    );
    let productPath: string | undefined;
    if (linkMatch?.[1]) {
      productPath = decodeJsonString(linkMatch[1]).split("?")[0];
      if (!productPath.includes(`/dp/${asin}`)) productPath = undefined;
    }

    let payWithCoupon: string | undefined;
    const money = tail.match(
      /"coupon"\s*:\s*\{[\s\S]{0,600}?"money"\s*:\s*\{"amount"\s*:\s*"([\d.]+)"/,
    );
    if (money?.[1]) {
      const amount = money[1].replace(".", ",");
      payWithCoupon = `Pagas ${amount}€ con cupón`;
    }

    byAsin.set(asin, { asin, title, promoId, productPath, payWithCoupon });
  }

  return [...byAsin.values()];
}

function productUrl(hit: DealHit): string {
  const asin = extractAsin(hit.asin) ?? hit.asin;
  try {
    return generateAffiliateUrl({ asin });
  } catch {
    if (hit.productPath?.startsWith("/")) {
      return `https://www.amazon.es${hit.productPath}`;
    }
    return `https://www.amazon.es/dp/${asin}`;
  }
}

function extractProductCouponMeta(html: string): {
  discountLabel?: string;
  validUntil?: string;
  terms?: string;
  expiresAt?: string;
} {
  const $ = cheerio.load(html);
  $(
    "#promoPriceBlockMessage_feature_div style, #promoPriceBlockMessage_feature_div script",
  ).remove();
  $("[id*=coupon] style, [id*=coupon] script").remove();

  const blob = [
    $("#promoPriceBlockMessage_feature_div").text(),
    $("[id*=coupon]").text(),
    $(".couponLabelText").text(),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const discount =
    blob.match(/Aplicar cup[oó]n de\s+([\d.,]+\s*€?%?)/i)?.[0] ??
    blob.match(/cup[oó]n de descuento de\s+([\d.,]+\s*€?%?)/i)?.[0] ??
    undefined;

  const validUntil =
    blob.match(/Cup[oó]n v[aá]lido hasta[^.…]{0,80}/i)?.[0]?.trim() ??
    undefined;

  const months: Record<string, string> = {
    enero: "01",
    febrero: "02",
    marzo: "03",
    abril: "04",
    mayo: "05",
    junio: "06",
    julio: "07",
    agosto: "08",
    septiembre: "09",
    setiembre: "09",
    octubre: "10",
    noviembre: "11",
    diciembre: "12",
  };
  let expiresAt: string | undefined;
  const esDate = validUntil?.match(
    /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i,
  );
  if (esDate) {
    const month = months[esDate[2].toLowerCase()];
    if (month) {
      expiresAt = `${esDate[3]}-${month}-${esDate[1].padStart(2, "0")}`;
    }
  }

  const parts = [discount, validUntil].filter(Boolean) as string[];
  const terms = parts.length
    ? `${parts.join(". ")}. Sin código: actívalo en la ficha («Aplicar cupón») antes de comprar. Sujeto a stock y TyC de Amazon.`
    : undefined;

  return {
    discountLabel: discount,
    validUntil,
    terms,
    expiresAt,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return out;
}

export async function discoverAmazonClipCoupons(): Promise<DiscoveredCoupon[]> {
  const html = await fetchHtml(AMAZON_COUPON_DEALS_URL, {
    referer: "https://www.amazon.es/",
  });
  if (!html) return [];

  const hits = parseDealsHtml(html);
  if (hits.length === 0) {
    console.warn("[coupons] Amazon deals: 0 cupones parseados");
    return [];
  }

  const toEnrich = hits.slice(0, MAX_ENRICH);
  const enriched = await mapPool(toEnrich, 4, async (hit) => {
    const url = productUrl(hit);
    const phtml = await fetchHtml(url, {
      referer: AMAZON_COUPON_DEALS_URL,
      timeoutMs: 18_000,
    });
    const meta = phtml ? extractProductCouponMeta(phtml) : {};
    return { hit, meta, url };
  });

  const fallbackTerms =
    "Cupón Amazon sin código: ábrelo en la ficha del producto y pulsa «Aplicar cupón» antes de comprar. Sujeto a stock y TyC de Amazon.";

  const found: DiscoveredCoupon[] = [];

  for (const row of enriched) {
    const { hit, meta, url } = row;
    const discountBit =
      meta.discountLabel ??
      hit.payWithCoupon ??
      "Cupón clip (activar en ficha)";
    const description = [discountBit, `ASIN ${hit.asin}`]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 280);

    found.push({
      retailer: "amazon",
      // Código interno único por producto (no es canjeable; la UI lo oculta).
      code: `CLIP-${hit.asin}`,
      title: hit.title.slice(0, 120),
      description,
      url,
      source: "scrape",
      externalId: `amazon:asin:${hit.asin}`,
      terms: meta.terms ?? fallbackTerms,
      expiresAt: meta.expiresAt,
    });
  }

  // Resto sin enriquecer (mismo ASIN→URL correcto; terms genéricos).
  for (const hit of hits.slice(MAX_ENRICH)) {
    found.push({
      retailer: "amazon",
      code: `CLIP-${hit.asin}`,
      title: hit.title.slice(0, 120),
      description: [hit.payWithCoupon ?? "Cupón clip", `ASIN ${hit.asin}`]
        .join(" · ")
        .slice(0, 280),
      url: productUrl(hit),
      source: "scrape",
      externalId: `amazon:asin:${hit.asin}`,
      terms: fallbackTerms,
    });
  }

  console.log(
    `[coupons] Amazon catálogo cupones → ${found.length} (${AMAZON_COUPON_DEALS_URL})`,
  );
  return found;
}
