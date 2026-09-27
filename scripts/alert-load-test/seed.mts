/**
 * Test de carga de alertas: crea 100 usuarios de prueba (`is_test`) con 5
 * alertas de URL cada uno sobre ~250 productos reales del catálogo (cada
 * producto lo siguen ~2 usuarios). Los avisos llegan al chat privado del
 * admin. Uso: npx tsx scripts/alert-load-test/seed.mts [usuarios] [alertasPorUsuario]
 * Limpieza: npx tsx scripts/alert-load-test/cleanup.mts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
const { createSupabaseServiceClient } = await import("@/lib/supabase");
const { ProductAvailability } = await import("@/types");

const USERS = Number(process.argv[2]) || 100;
const PER_USER = Number(process.argv[3]) || 5;
const TOTAL = USERS * PER_USER;
const PRODUCTS = Math.ceil(TOTAL / 2);
// Reparto por tienda (las que el cron revisa desde el VPS y el Mac).
const MIX: Record<string, number> = { amazon: 0.6, miravia: 0.2, kiabi: 0.1, carrefour: 0.05, aliexpress: 0.05 };
// telegram_id inventados, fuera de cualquier rango real de Telegram.
const FAKE_ID_BASE = -9_000_000_000_000;

const sb = createSupabaseServiceClient();

const { count: existing } = await sb.from("users").select("id", { count: "exact", head: true }).eq("is_test", true);
if (existing) {
  console.error(`Ya hay ${existing} usuarios de prueba. Ejecuta cleanup.mts antes.`);
  process.exit(1);
}

const products: { id: string; url: string; retailer: string; title: string }[] = [];
for (const [retailer, share] of Object.entries(MIX)) {
  const want = Math.round(PRODUCTS * share);
  const { data, error } = await sb
    .from("products")
    .select("id, retailer, title, product_url, amazon_url")
    .eq("is_active", true)
    .eq("retailer", retailer)
    .eq("availability", ProductAvailability.IN_STOCK)
    .order("last_checked_at", { ascending: false })
    .limit(want * 3);
  if (error) throw error;
  const rows = (data ?? [])
    .map((p) => ({ id: p.id, retailer: p.retailer, title: p.title, url: (retailer === "amazon" ? p.amazon_url : p.product_url ?? p.amazon_url)?.trim() ?? "" }))
    .filter((p) => /^https?:\/\//.test(p.url))
    .sort(() => Math.random() - 0.5)
    .slice(0, want);
  console.log(`${retailer}: ${rows.length}/${want} productos`);
  products.push(...rows);
}
if (products.length === 0) throw new Error("No hay productos para la prueba.");

const users = Array.from({ length: USERS }, (_, i) => ({
  telegram_id: FAKE_ID_BASE - i,
  telegram_username: `test_alertas_${String(i + 1).padStart(3, "0")}`,
  is_test: true,
}));
const { data: createdUsers, error: userError } = await sb.from("users").insert(users).select("id");
if (userError) throw userError;

// Cada usuario sigue 5 productos distintos; se recorre la lista en bucle para
// que cada producto quede con ~2 seguidores.
const alerts = createdUsers!.flatMap((user, u) =>
  Array.from({ length: PER_USER }, (_, k) => {
    const p = products[(u * PER_USER + k) % products.length]!;
    return { user_id: user.id, url: p.url, product_id: p.id, is_active: true };
  }),
);
for (let i = 0; i < alerts.length; i += 200) {
  const { error } = await sb.from("alerts").insert(alerts.slice(i, i + 200));
  if (error) throw error;
}
console.log(`Creados ${createdUsers!.length} usuarios de prueba y ${alerts.length} alertas sobre ${products.length} productos.`);
