/**
 * Informe del test de carga: cuántas alertas de prueba se han revisado y
 * hace cuánto. Uso: npx tsx scripts/alert-load-test/report.mts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
const { createSupabaseServiceClient } = await import("@/lib/supabase");
const sb = createSupabaseServiceClient();

const { data: users } = await sb.from("users").select("id").eq("is_test", true);
const ids = (users ?? []).map((u) => u.id);
if (ids.length === 0) {
  console.log("No hay usuarios de prueba.");
  process.exit(0);
}
const alerts: { url: string | null; last_checked_at: string | null; last_known_price: number | null }[] = [];
for (let i = 0; i < ids.length; i += 50) {
  const { data, error } = await sb
    .from("alerts")
    .select("url, last_checked_at, last_known_price")
    .in("user_id", ids.slice(i, i + 50));
  if (error) throw error;
  alerts.push(...(data ?? []));
}
const now = Date.now();
const hours = (a: (typeof alerts)[number]) =>
  a.last_checked_at ? (now - new Date(a.last_checked_at).getTime()) / 3_600_000 : Infinity;
const buckets = { "<1 h": 0, "1–3 h": 0, "3–6 h": 0, "6–12 h": 0, ">12 h": 0, "nunca": 0 };
for (const a of alerts) {
  const h = hours(a);
  if (h === Infinity) buckets.nunca += 1;
  else if (h < 1) buckets["<1 h"] += 1;
  else if (h < 3) buckets["1–3 h"] += 1;
  else if (h < 6) buckets["3–6 h"] += 1;
  else if (h < 12) buckets["6–12 h"] += 1;
  else buckets[">12 h"] += 1;
}
const byStore = new Map<string, { total: number; checked: number; withPrice: number }>();
for (const a of alerts) {
  const store = (a.url ?? "").match(/amazon|miravia|kiabi|carrefour|aliexpress|pccomponentes/)?.[0] ?? "otra";
  const s = byStore.get(store) ?? { total: 0, checked: 0, withPrice: 0 };
  s.total += 1;
  if (a.last_checked_at) s.checked += 1;
  if (a.last_known_price !== null) s.withPrice += 1;
  byStore.set(store, s);
}
const checkedLastHour = alerts.filter((a) => hours(a) < 1).length;
console.log(`Alertas de prueba: ${alerts.length} (${ids.length} usuarios)`);
console.log(`Revisadas en la última hora: ${checkedLastHour}`);
console.log("Última revisión:", buckets);
console.log("Por tienda (revisadas / con precio leído / total):");
for (const [store, s] of byStore) console.log(`  ${store}: ${s.checked} / ${s.withPrice} / ${s.total}`);
