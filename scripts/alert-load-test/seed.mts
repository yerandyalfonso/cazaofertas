/**
 * Test de carga de alertas: 100 usuarios de prueba (`is_test`) con 5 alertas
 * de URL cada uno.
 * - 70 usuarios «test_nuevos_NNN»: productos que están en oferta ahora en
 *   Amazon (categorías que más cambian de precio) y que NO están en el
 *   catálogo. La primera revisión los crea (camino real de un usuario que pega
 *   un enlace nuevo); quedan públicos como cualquier producto de alerta.
 * - 30 usuarios «test_catalogo_NNN»: productos del catálogo (Amazon, Miravia,
 *   Kiabi).
 * Cada producto lo siguen ~2 usuarios. Los avisos llegan al chat del admin.
 * Uso: npx tsx scripts/alert-load-test/seed.mts
 * Limpieza: npx tsx scripts/alert-load-test/cleanup.mts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { createSupabaseServiceClient } = await import("@/lib/supabase");
const { ProductAvailability } = await import("@/types");
const { discoverFlashDealListings, buildAmazonDealsDepartmentUrl } = await import(
  "@/providers/price/amazonFlashDiscovery"
);

const PER_USER = 5;
const NEW_USERS = 70;
const CATALOG_USERS = 30;
const FOLLOWERS_PER_PRODUCT = 2;
// Departamentos de Amazon cuyos precios más se mueven (electrónica, informática,
// videojuegos, hogar/pequeño electrodoméstico, juguetes, deportes).
const VOLATILE_DEPARTMENTS = ["667050031", "599383031", "599392031", "599386031", "2665403031"];
const FAKE_ID_BASE = -9_000_000_000_000;

const sb = createSupabaseServiceClient();

const { count: existing } = await sb.from("users").select("id", { count: "exact", head: true }).eq("is_test", true);
if (existing) {
  console.error(`Ya hay ${existing} usuarios de prueba. Ejecuta cleanup.mts antes.`);
  process.exit(1);
}

// 1) Productos nuevos en oferta (no están en la base de datos).
const wantNew = Math.ceil((NEW_USERS * PER_USER) / FOLLOWERS_PER_PRODUCT);
// Además de las ofertas del día (que el descubrimiento flash ya suele dar de
// alta), «Los que más suben» y «Los más vendidos»: productos con mucho
// movimiento de precio y ventas que no solemos tener.
const LIST_PAGES = ["electronics", "computers", "videogames", "kitchen", "home", "toys", "sports"].flatMap(
  (node) => [
    `https://www.amazon.es/gp/movers-and-shakers/${node}`,
    `https://www.amazon.es/gp/bestsellers/${node}`,
  ],
);
const discovered = await discoverFlashDealListings({
  feedUrls: [
    "https://www.amazon.es/gp/goldbox",
    ...VOLATILE_DEPARTMENTS.map(buildAmazonDealsDepartmentUrl),
    ...LIST_PAGES,
  ],
  maxItems: wantNew * 4,
  delayMs: 2_500,
  allowSimulatedFallback: false,
});
console.log(`Ofertas leídas: ${discovered.items.length} (${discovered.feedsFetched} listados, ${discovered.feedErrors.length} con error)`);
const candidates = discovered.items.filter((item) => item.origin === "live");
const known = new Set<string>();
for (let i = 0; i < candidates.length; i += 100) {
  const { data, error } = await sb
    .from("products")
    .select("asin")
    .in("asin", candidates.slice(i, i + 100).map((c) => c.asin));
  if (error) throw error;
  for (const row of data ?? []) known.add(row.asin);
}
const fresh = candidates
  .filter((c) => !known.has(c.asin))
  .sort(() => Math.random() - 0.5)
  .slice(0, wantNew)
  .map((c) => ({ url: `https://www.amazon.es/dp/${c.asin}`, productId: null as string | null }));
console.log(`Nuevos (no en catálogo): ${fresh.length}/${wantNew} (descartados ${known.size} que ya teníamos)`);
if (fresh.length < wantNew / 2) {
  console.error("Muy pocos productos nuevos (¿bloqueo de Amazon?). No se crea nada.");
  process.exit(1);
}

// 2) Productos del catálogo.
const wantCatalog = Math.ceil((CATALOG_USERS * PER_USER) / FOLLOWERS_PER_PRODUCT);
const MIX: Record<string, number> = { amazon: 0.5, miravia: 0.3, kiabi: 0.2 };
const catalog: { url: string; productId: string | null }[] = [];
for (const [retailer, share] of Object.entries(MIX)) {
  const want = Math.round(wantCatalog * share);
  const { data, error } = await sb
    .from("products")
    .select("id, product_url, amazon_url")
    .eq("is_active", true)
    .eq("retailer", retailer)
    .eq("availability", ProductAvailability.IN_STOCK)
    .order("last_checked_at", { ascending: false })
    .limit(want * 3);
  if (error) throw error;
  const rows = (data ?? [])
    .map((p) => ({ productId: p.id, url: (retailer === "amazon" ? p.amazon_url : p.product_url ?? p.amazon_url)?.trim() ?? "" }))
    .filter((p) => /^https?:\/\//.test(p.url))
    .sort(() => Math.random() - 0.5)
    .slice(0, want);
  console.log(`Catálogo ${retailer}: ${rows.length}/${want}`);
  catalog.push(...rows);
}

async function createGroup(prefix: string, count: number, offset: number, pool: { url: string; productId: string | null }[]) {
  const users = Array.from({ length: count }, (_, i) => ({
    telegram_id: FAKE_ID_BASE - offset - i,
    telegram_username: `${prefix}_${String(i + 1).padStart(3, "0")}`,
    is_test: true,
  }));
  const { data: created, error } = await sb.from("users").insert(users).select("id");
  if (error) throw error;
  const alerts = created!.flatMap((user, u) =>
    Array.from({ length: PER_USER }, (_, k) => {
      const p = pool[(u * PER_USER + k) % pool.length]!;
      return { user_id: user.id, url: p.url, product_id: p.productId, is_active: true };
    }),
  );
  for (let i = 0; i < alerts.length; i += 200) {
    const { error: alertError } = await sb.from("alerts").insert(alerts.slice(i, i + 200));
    if (alertError) throw alertError;
  }
  console.log(`${prefix}: ${created!.length} usuarios, ${alerts.length} alertas sobre ${pool.length} productos`);
}

await createGroup("test_nuevos", NEW_USERS, 0, fresh);
await createGroup("test_catalogo", CATALOG_USERS, NEW_USERS, catalog);
