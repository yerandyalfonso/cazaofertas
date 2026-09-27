export const MARKETPLACE_PAGE_SIZE = 24;

export type CouponSource = "manual" | "scrape" | "affiliate";

export interface CouponOffer {
  id: string;
  retailer: string;
  title: string;
  code: string;
  description: string;
  url: string;
  startsAt?: string;
  expiresAt?: string;
  highlight?: boolean;
  source?: CouponSource;
  /** Condiciones / T&C visibles en la ficha del cupón. */
  terms?: string;
}

export function isCouponActive(coupon: CouponOffer, now = new Date()): boolean {
  const today = now.toISOString().slice(0, 10);
  if (coupon.startsAt && coupon.startsAt > today) return false;
  if (coupon.expiresAt && coupon.expiresAt < today) return false;
  return true;
}

export function getCouponsByRetailer(
  coupons: CouponOffer[],
  retailer?: string,
): Record<string, CouponOffer[]> {
  const filtered = retailer
    ? coupons.filter((c) => c.retailer === retailer)
    : coupons;

  return filtered.reduce<Record<string, CouponOffer[]>>((acc, coupon) => {
    const list = acc[coupon.retailer] ?? [];
    list.push(coupon);
    acc[coupon.retailer] = list;
    return acc;
  }, {});
}

export function formatCouponExpiry(expiresAt?: string): string | null {
  if (!expiresAt) return null;
  const date = new Date(`${expiresAt}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Lo que vale el cupón, para destacarlo en la tarjeta:
 * «Aplicar cupón de 15€» → { value: "−15 €", label: "de descuento" },
 * «Pagas 10,00€ con cupón» → { value: "10,00 €", label: "con cupón" }.
 */
export function couponHighlight(
  description: string,
): { value: string; label: string } | null {
  const off = description.match(/cup[oó]n de\s*(\d+(?:[.,]\d+)?)\s*(€|%)/i);
  if (off) {
    return { value: `−${off[1]} ${off[2]}`, label: "de descuento" };
  }
  const pay = description.match(/pagas\s*(\d+(?:[.,]\d+)?)\s*€\s*con cup[oó]n/i);
  if (pay) return { value: `${pay[1]} €`, label: "con cupón" };
  return null;
}

/** Descripción sin datos internos (ASIN) ni lo que ya muestra couponHighlight. */
export function couponDetails(description: string): string[] {
  return description
    .split("·")
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter(
      (part) =>
        part &&
        !/^ASIN\b/i.test(part) &&
        !/cup[oó]n de\s*\d|pagas\s*\d/i.test(part),
    );
}
