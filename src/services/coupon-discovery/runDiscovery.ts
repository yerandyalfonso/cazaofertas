import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { discoverAllCoupons } from "./discoverers";
import type { CouponDiscoveryResult } from "./types";
import {
  deactivateExpiredCoupons,
  deactivateUnseenScrapedCoupons,
  deleteExampleCoupons,
  upsertDiscoveredCoupons,
} from "./supabase";

export async function runCouponDiscovery(options?: {
  writeBackupJson?: boolean;
}): Promise<CouponDiscoveryResult> {
  if (process.env.COUPON_DISCOVERY_ENABLED === "0") {
    return {
      found: 0,
      examplesDeleted: 0,
      expiredDeactivated: 0,
      staleDeactivated: 0,
      inserted: 0,
      updated: 0,
      byRetailer: {},
    };
  }

  const examplesDeleted = await deleteExampleCoupons();
  const discovered = await discoverAllCoupons();

  const byRetailer: Record<string, number> = {};
  for (const c of discovered) {
    byRetailer[c.retailer] = (byRetailer[c.retailer] ?? 0) + 1;
  }

  const expiredDeactivated = await deactivateExpiredCoupons();
  const { inserted, updated } = await upsertDiscoveredCoupons(discovered);

  const seen = new Set<string>();
  for (const c of discovered) {
    seen.add(`${c.retailer}:${c.code.toUpperCase()}`);
    if (c.externalId) seen.add(c.externalId);
  }
  const staleDeactivated = await deactivateUnseenScrapedCoupons(seen);

  if (options?.writeBackupJson !== false) {
    const outPath = resolve(
      process.cwd(),
      "apps/chollosdehoy/data/discovered-coupons.json",
    );
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), coupons: discovered },
        null,
        2,
      ),
    );
  }

  return {
    found: discovered.length,
    examplesDeleted,
    expiredDeactivated,
    staleDeactivated,
    inserted,
    updated,
    byRetailer,
  };
}
