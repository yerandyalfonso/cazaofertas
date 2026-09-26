/**
 * Auditoría aleatoria de precios: compara lo guardado con la ficha real de la
 * tienda. Solo lectura (no escribe nada). Muestra sesgada hacia descuentos
 * altos, que es donde un precio mal leído hace más daño.
 *
 * Despacio a propósito (una ficha cada --delay segundos) para no provocar
 * bloqueos; ejecutar desde el Mac (IP residencial).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/audit-prices.ts
 *   npx tsx --env-file=.env.local scripts/audit-prices.ts --high=15 --random=5 --delay=10
 */
import { createClient } from "@supabase/supabase-js";
import { previewAmazonProductPage } from "@/providers/price/AmazonHtmlPriceProvider";
import { previewProductPage } from "@/services/productScrape";

function arg(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  const value = raw ? Number(raw.split("=")[1]) : fallback;
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const HIGH = arg("high", 12);
const RANDOM = arg("random", 6);
const DELAY_MS = arg("delay", 10) * 1000;
/** Diferencia de precio a partir de la cual se marca como incorrecto. */
const TOLERANCE = 0.05;

type Row = {
  id: string;
  asin: string;
  retailer: string;
  title: string;
  current_price: number | string;
  previous_price: number | string | null;
  discount_percentage: number | string | null;
  product_url: string | null;
  amazon_url: string | null;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const select =
    "id, asin, retailer, title, current_price, previous_price, discount_percentage, product_url, amazon_url";

  const { data: high, error: highError } = await client
    .from("products")
    .select(select)
    .eq("is_active", true)
    .gte("discount_percentage", 50)
    .limit(1000);
  if (highError) throw new Error(highError.message);

  const { data: pool, error: poolError } = await client
    .from("products")
    .select(select)
    .eq("is_active", true)
    .lt("discount_percentage", 50)
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (poolError) throw new Error(poolError.message);

  const sample = [
    ...shuffle((high ?? []) as Row[]).slice(0, HIGH),
    ...shuffle((pool ?? []) as Row[]).slice(0, RANDOM),
  ];
  console.log(
    `Muestra: ${sample.length} (${HIGH} con ≥50 % de ${high?.length ?? 0}, ${RANDOM} al azar). Una ficha cada ${DELAY_MS / 1000}s.\n`,
  );

  const wrong: string[] = [];
  let ok = 0;
  let unreadable = 0;

  for (const [index, row] of sample.entries()) {
    const stored = Number(row.current_price);
    let live: number | null = null;
    let note = "";
    try {
      if (row.retailer === "amazon") {
        live = (await previewAmazonProductPage(row.amazon_url || row.asin, { timeoutMs: 25_000 })).price;
      } else if (row.product_url) {
        live = (await previewProductPage(row.product_url, { timeoutMs: 25_000 })).price;
      }
    } catch (error) {
      note = error instanceof Error ? error.message.slice(0, 60) : "error";
    }

    const discount = Math.round(Number(row.discount_percentage ?? 0));
    const label = `${row.retailer.padEnd(8)} ${row.asin.padEnd(20)} −${String(discount).padStart(2)}%  guardado ${stored.toFixed(2).padStart(8)} €`;
    if (live == null) {
      unreadable += 1;
      console.log(`?  ${label}  tienda: sin leer ${note}`);
    } else if (Math.abs(live - stored) / Math.max(live, 0.01) > TOLERANCE) {
      wrong.push(`${row.asin} ${stored} → ${live} · ${row.title.slice(0, 50)}`);
      console.log(`✗  ${label}  tienda ${live.toFixed(2).padStart(8)} €  ${row.title.slice(0, 40)}`);
    } else {
      ok += 1;
      console.log(`✓  ${label}  tienda ${live.toFixed(2).padStart(8)} €`);
    }

    if (index < sample.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`\nCorrectos: ${ok} · Distintos (>${TOLERANCE * 100} %): ${wrong.length} · Sin leer: ${unreadable}`);
  if (wrong.length > 0) {
    console.log("\nDistintos (puede ser un cambio de precio real desde la última revisión):");
    for (const line of wrong) console.log(`  ${line}`);
  }
}

void main();
