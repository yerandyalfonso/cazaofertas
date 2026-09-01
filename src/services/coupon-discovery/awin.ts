import type { DiscoveredCoupon } from "./types";

type AwinOffer = {
  promotionId?: number;
  type?: string;
  title?: string;
  description?: string;
  terms?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  urlTracking?: string;
  advertiser?: { id?: number; name?: string; joined?: boolean };
  voucher?: { code?: string | null; exclusive?: boolean };
};

function slugifyRetailer(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "tienda";
}

/** Mapea anunciantes Awin a nuestros ids de marketplace cuando aplica. */
export function mapAwinAdvertiserToRetailer(name: string): string {
  const n = name.toLowerCase();
  if (/\bamazon\b/.test(n)) return "amazon";
  if (/\bkiabi\b/.test(n)) return "kiabi";
  if (/\bcarrefour\b/.test(n)) return "carrefour";
  if (/\bmiravia\b|\baliexpress\b/.test(n)) return "miravia";
  return slugifyRetailer(name);
}

function toDateOnly(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
}

function offerToCoupon(offer: AwinOffer): DiscoveredCoupon | null {
  const advertiserName = offer.advertiser?.name?.trim();
  if (!advertiserName) return null;

  const retailer = mapAwinAdvertiserToRetailer(advertiserName);
  const promoId = offer.promotionId;
  if (!promoId) return null;

  const voucherCode = offer.voucher?.code?.trim();
  const isVoucher = offer.type === "voucher";
  const code = voucherCode
    ? voucherCode.toUpperCase()
    : `AWIN-${promoId}`;

  const title =
    offer.title?.trim() ||
    (voucherCode
      ? `Cupón ${voucherCode} · ${advertiserName}`
      : `Oferta ${advertiserName}`);

  const descriptionParts = [
    offer.description?.trim(),
    offer.terms?.trim() ? `Condiciones: ${offer.terms.trim().slice(0, 200)}` : null,
    !voucherCode && isVoucher
      ? "Únete al programa en Awin para ver el código."
      : null,
  ].filter(Boolean);

  const url =
    offer.urlTracking?.trim() ||
    offer.url?.trim() ||
    "https://www.awin1.com/";

  return {
    retailer,
    title: title.slice(0, 160),
    code,
    description:
      descriptionParts.join(" ").slice(0, 400) ||
      `Promoción Awin · ${advertiserName}`,
    url,
    startsAt: toDateOnly(offer.startDate),
    expiresAt: toDateOnly(offer.endDate),
    source: "affiliate",
    externalId: `awin:${promoId}`,
    highlight: Boolean(offer.voucher?.exclusive),
  };
}

/**
 * Cupones/promos ES vía Awin Offers API (gratis con cuenta publisher).
 * Requiere AWIN_PUBLISHER_ID + AWIN_API_TOKEN en .env.local
 * Token: https://ui.awin.com/awin-api
 */
export async function discoverAwinCoupons(): Promise<DiscoveredCoupon[]> {
  const publisherId = process.env.AWIN_PUBLISHER_ID?.trim();
  const token = process.env.AWIN_API_TOKEN?.trim();

  if (!publisherId || !token) {
    console.log(
      "[coupons] Awin omitido — define AWIN_PUBLISHER_ID y AWIN_API_TOKEN (y COUPON_AWIN_ENABLED=1).",
    );
    return [];
  }

  const region = (process.env.AWIN_REGION || "ES").toUpperCase();
  const membership =
    process.env.AWIN_MEMBERSHIP === "all" ? "all" : "joined";
  const maxPages = Math.min(
    Number(process.env.AWIN_MAX_PAGES ?? "5") || 5,
    20,
  );
  const pageSize = Math.min(
    Math.max(Number(process.env.AWIN_PAGE_SIZE ?? "100") || 100, 10),
    200,
  );

  const found: DiscoveredCoupon[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const endpoint = new URL(
      `https://api.awin.com/publisher/${publisherId}/promotions`,
    );
    endpoint.searchParams.set("accessToken", token);

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          filters: {
            regionCodes: [region],
            status: "active",
            type: "all",
            membership,
          },
          pagination: { page, pageSize },
        }),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (error) {
      console.warn("[coupons] Awin fetch:", (error as Error).message);
      break;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[coupons] Awin HTTP ${res.status}: ${body.slice(0, 200)}`,
      );
      break;
    }

    const json = (await res.json()) as {
      data?: AwinOffer[];
      pagination?: { totalPages?: number; page?: number };
    };

    const batch = json.data ?? [];
    for (const offer of batch) {
      const coupon = offerToCoupon(offer);
      if (coupon) found.push(coupon);
    }

    const totalPages = json.pagination?.totalPages ?? page;
    if (page >= totalPages || batch.length === 0) break;
  }

  console.log(`[coupons] Awin → ${found.length} ofertas (${region}, ${membership})`);
  return found;
}
