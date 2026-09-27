/**
 * Repara precios de Amazon guardados como cuota de financiación («O 35,02 € /
 * x24», «4 plazos») entre el 25 y el 27/09/2026, antes del arreglo del
 * scraper. Candidatos: precio actual < 40 % del máximo registrado, tocados
 * desde el 25-09. Relee cada ficha y solo corrige si difiere más de un 5 %.
 *
 * Uso (desde el Mac o el VPS, despacio a propósito):
 *   npx tsx --env-file=.env.local scripts/repair-installment-prices.ts            (dry-run)
 *   npx tsx --env-file=.env.local scripts/repair-installment-prices.ts --apply --delay=8
 */
import { createClient } from "@supabase/supabase-js";
import { previewAmazonProductPage } from "@/providers/price/AmazonHtmlPriceProvider";

const apply = process.argv.includes("--apply");
const delayArg = process.argv.find((a) => a.startsWith("--delay="));
const DELAY_MS = (Number(delayArg?.split("=")[1]) || 8) * 1000;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

async function main() {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  type Row = {
    id: string;
    asin: string;
    title: string;
    current_price: number | string;
    highest_price: number | string | null;
  };
  let rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("products")
      .select("id, asin, title, current_price, highest_price")
      .eq("retailer", "amazon")
      .eq("is_active", true)
      .gte("updated_at", "2026-09-25")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows = rows.concat(data as Row[]);
  }
  const candidates = rows.filter(
    (row) =>
      Number(row.highest_price) > 0 &&
      Number(row.current_price) < Number(row.highest_price) * 0.4,
  );
  console.log(`Candidatos: ${candidates.length} (apply=${apply}, una ficha cada ${DELAY_MS / 1000}s)`);

  let fixed = 0;
  let ok = 0;
  let unreadable = 0;
  for (const [index, row] of candidates.entries()) {
    const stored = Number(row.current_price);
    const highest = Number(row.highest_price);
    let live: number | null = null;
    let list: number | null = null;
    try {
      const preview = await previewAmazonProductPage(row.asin, { timeoutMs: 25_000 });
      live = preview.price;
      list = preview.listPrice;
    } catch (error) {
      console.log(`? ${row.asin} ${error instanceof Error ? error.message.slice(0, 60) : "error"}`);
    }

    if (live == null) {
      unreadable += 1;
    } else if (Math.abs(live - stored) / live <= 0.05) {
      ok += 1;
    } else {
      fixed += 1;
      const reference =
        list != null && list > live
          ? list
          : highest > live && highest < live * 3
            ? highest
            : live;
      const discount = reference > live ? round(((reference - live) / reference) * 100) : 0;
      console.log(
        `✗ ${row.asin} ${stored} → ${live} (ref ${reference}, −${discount}%) ${row.title.slice(0, 45)}`,
      );
      if (apply) {
        const now = new Date().toISOString();
        await client
          .from("products")
          .update({
            current_price: live,
            previous_price: reference,
            lowest_price: live,
            discount_percentage: discount,
            last_checked_at: now,
            updated_at: now,
          })
          .eq("id", row.id);
        await client
          .from("channel_notifications")
          .delete()
          .eq("product_id", row.id)
          .eq("status", "pending");
        await client
          .from("meta_post_queue")
          .update({ status: "skipped" })
          .eq("product_id", row.id)
          .eq("status", "pending");
      }
    }

    if (index < candidates.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`\nCorregidos: ${fixed} · Ya correctos: ${ok} · Sin leer: ${unreadable}`);
}

void main();
