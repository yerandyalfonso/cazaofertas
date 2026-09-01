import { getSupabaseServer } from "@/lib/supabase";
import type { CouponOffer } from "@/lib/coupons";
import { isCouponActive } from "@/lib/coupons";

type CouponRow = {
  id: string;
  retailer: string;
  title: string;
  code: string;
  description: string;
  url: string;
  starts_at: string | null;
  expires_at: string | null;
  highlight: boolean;
  source: string;
  is_active: boolean;
  terms: string | null;
};

function mapRow(row: CouponRow): CouponOffer {
  return {
    id: row.id,
    retailer: row.retailer,
    title: row.title,
    code: row.code,
    description: row.description,
    url: row.url,
    startsAt: row.starts_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    highlight: row.highlight,
    source: row.source as CouponOffer["source"],
    terms: row.terms?.trim() || undefined,
  };
}

export async function fetchActiveCouponsFromDb(): Promise<CouponOffer[]> {
  const client = getSupabaseServer();

  const { data, error } = await client
    .from("coupons")
    .select(
      "id, retailer, title, code, description, url, starts_at, expires_at, highlight, source, is_active, terms",
    )
    .eq("is_active", true)
    .order("highlight", { ascending: false })
    .order("expires_at", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[coupons-db] fetch", error.message);
    return [];
  }

  return (data as CouponRow[])
    .map(mapRow)
    .filter((coupon) => isCouponActive(coupon));
}

/** Cupones activos desde Supabase. */
export async function getActiveCoupons(): Promise<CouponOffer[]> {
  return fetchActiveCouponsFromDb();
}
