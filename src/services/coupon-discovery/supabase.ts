import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DiscoveredCoupon } from "./types";

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const EXAMPLE_CODES = [
  "PRIME",
  "MODA15",
  "NEWSLETTER",
  "REBAJAS",
  "APP",
  "WELCOME",
  "CLUB",
];

export async function deactivateExpiredCoupons(
  client = getClient(),
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client
    .from("coupons")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("is_active", true)
    .not("expires_at", "is", null)
    .lt("expires_at", today)
    .select("id");

  if (error) throw new Error(`deactivateExpiredCoupons: ${error.message}`);
  return data?.length ?? 0;
}

export async function deleteExampleCoupons(
  client = getClient(),
): Promise<number> {
  const { data, error } = await client
    .from("coupons")
    .delete()
    .eq("source", "manual")
    .in("code", EXAMPLE_CODES)
    .select("id");

  if (error) throw new Error(`deleteExampleCoupons: ${error.message}`);
  return data?.length ?? 0;
}

export async function deactivateStaleScrapedCoupons(
  seenKeys: Set<string>,
  maxAgeHours = 48,
  client = getClient(),
): Promise<number> {
  const cutoff = new Date(
    Date.now() - maxAgeHours * 60 * 60 * 1000,
  ).toISOString();

  const { data: rows, error } = await client
    .from("coupons")
    .select("id, retailer, code, external_id, last_seen_at")
    .eq("is_active", true)
    .eq("source", "scrape")
    .lt("last_seen_at", cutoff);

  if (error) throw new Error(`deactivateStaleScrapedCoupons: ${error.message}`);
  if (!rows?.length) return 0;

  const toDisable = rows.filter((row) => {
    const byExternal = row.external_id ? seenKeys.has(row.external_id) : false;
    const byCode = seenKeys.has(`${row.retailer}:${row.code}`);
    return !byExternal && !byCode;
  });

  if (toDisable.length === 0) return 0;

  const ids = toDisable.map((r) => r.id);
  const { error: updError } = await client
    .from("coupons")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("id", ids);

  if (updError) {
    throw new Error(`deactivateStaleScrapedCoupons update: ${updError.message}`);
  }
  return ids.length;
}

/** Desactiva scrapes que no salen en esta pasada (limpieza inmediata). */
export async function deactivateUnseenScrapedCoupons(
  seenKeys: Set<string>,
  client = getClient(),
): Promise<number> {
  const { data: rows, error } = await client
    .from("coupons")
    .select("id, retailer, code, external_id")
    .eq("is_active", true)
    .in("source", ["scrape", "affiliate"]);

  if (error) throw new Error(`deactivateUnseenScrapedCoupons: ${error.message}`);
  if (!rows?.length) return 0;

  const toDisable = rows.filter((row) => {
    const byExternal = row.external_id ? seenKeys.has(row.external_id) : false;
    const byCode = seenKeys.has(`${row.retailer}:${row.code}`);
    return !byExternal && !byCode;
  });
  if (!toDisable.length) return 0;

  const ids = toDisable.map((r) => r.id);
  const { error: updError } = await client
    .from("coupons")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (updError) {
    throw new Error(`deactivateUnseenScrapedCoupons update: ${updError.message}`);
  }
  return ids.length;
}

export async function upsertDiscoveredCoupons(
  coupons: DiscoveredCoupon[],
  client = getClient(),
): Promise<{ inserted: number; updated: number }> {
  if (coupons.length === 0) return { inserted: 0, updated: 0 };

  const now = new Date().toISOString();
  let inserted = 0;
  let updated = 0;

  for (const coupon of coupons) {
    const row = {
      retailer: coupon.retailer,
      title: coupon.title,
      code: coupon.code.toUpperCase(),
      description: coupon.description,
      url: coupon.url,
      starts_at: coupon.startsAt ?? null,
      expires_at: coupon.expiresAt ?? null,
      highlight: Boolean(coupon.highlight),
      source: coupon.source,
      is_active: true,
      external_id: coupon.externalId ?? null,
      last_seen_at: now,
      updated_at: now,
    };
    const terms = coupon.terms?.trim() || "";

    const { data: existing } = await client
      .from("coupons")
      .select("id")
      .eq("retailer", row.retailer)
      .eq("code", row.code)
      .maybeSingle();

    if (existing?.id) {
      const updatePayload = { ...row, terms };
      let { error } = await client
        .from("coupons")
        .update(updatePayload)
        .eq("id", existing.id);
      // Compat: si aún no se aplicó migración 0023 (columna terms).
      if (error?.message?.includes("'terms' column")) {
        const { terms: _omit, ...withoutTerms } = updatePayload;
        ({ error } = await client
          .from("coupons")
          .update(withoutTerms)
          .eq("id", existing.id));
      }
      if (error) throw new Error(`update ${row.code}: ${error.message}`);
      updated += 1;
    } else {
      const insertPayload = { ...row, terms };
      let { error } = await client.from("coupons").insert(insertPayload);
      if (error?.message?.includes("'terms' column")) {
        const { terms: _omit, ...withoutTerms } = insertPayload;
        ({ error } = await client.from("coupons").insert(withoutTerms));
      }
      if (error) throw new Error(`insert ${row.code}: ${error.message}`);
      inserted += 1;
    }
  }

  return { inserted, updated };
}
