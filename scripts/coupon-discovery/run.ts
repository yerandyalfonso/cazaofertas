#!/usr/bin/env tsx
/**
 * Descubre cupones por tienda y los guarda en Supabase `coupons`.
 *
 *   npm run coupons:discover
 *
 * Requiere .env.local con Supabase (service role).
 */

import { runCouponDiscovery } from "../../src/services/coupon-discovery/runDiscovery";

async function main() {
  if (process.env.COUPON_DISCOVERY_ENABLED === "0") {
    console.log("COUPON_DISCOVERY_ENABLED=0 — omitiendo descubrimiento.");
    return;
  }

  console.log("🔍 Descubriendo cupones (todas las tiendas)…");
  const result = await runCouponDiscovery({ writeBackupJson: true });

  console.log(`   Ejemplos eliminados: ${result.examplesDeleted}`);
  console.log(`   Encontrados: ${result.found}`);
  if (Object.keys(result.byRetailer).length) {
    console.log(
      "   por tienda →",
      Object.entries(result.byRetailer)
        .map(([k, v]) => `${k}:${v}`)
        .join(" "),
    );
  }
  console.log(`   Caducados desactivados: ${result.expiredDeactivated}`);
  console.log(`   Obsoletos desactivados: ${result.staleDeactivated}`);
  console.log(
    `   Insertados: ${result.inserted}, actualizados: ${result.updated}`,
  );
  console.log("✓ Cupones actualizados en Supabase");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
