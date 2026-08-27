/**
 * Corrige productos insertados desde Vercel con precios Amazon ES sin IVA (÷1,21).
 * Re-scrape la ficha desde esta máquina (IP ES) y escribe precio/lista reales.
 *
 * Uso: npx tsx scripts/fix-vat-stripped-prices.mts [--dry-run] [--since=2026-08-27]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { roundMoney, toNumber } from "../src/lib/money";
import {
  maybeRestoreSpanishVatPair,
  previewAmazonProductPage,
} from "../src/providers/price/AmazonHtmlPriceProvider";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i <= 0) continue;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const sinceArg = process.argv.find((a) => a.startsWith("--since="));
  const since = sinceArg?.slice("--since=".length) ?? "2026-08-27";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  }

  const sb = createClient(url, key);
  const { data: rows, error } = await sb
    .from("products")
    .select(
      "id, asin, title, current_price, previous_price, lowest_price, highest_price, amazon_url, created_at",
    )
    .eq("is_active", true)
    .gte("created_at", `${since}T00:00:00.000Z`)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  console.log(`Productos desde ${since}: ${rows?.length ?? 0} (dryRun=${dryRun})`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const asin = String(row.asin).toUpperCase();
    const stored = toNumber(row.current_price);
    const storedPrev = toNumber(row.previous_price);

    try {
      // 1) Intento scrape real (preferido).
      let nextPrice: number | null = null;
      let nextList: number | null = null;
      try {
        const preview = await previewAmazonProductPage(
          row.amazon_url || asin,
          { timeoutMs: 20_000 },
        );
        nextPrice = preview.price;
        nextList =
          preview.listPrice != null &&
          preview.price != null &&
          preview.listPrice > preview.price
            ? preview.listPrice
            : null;
      } catch (scrapeError) {
        console.warn(
          asin,
          "scrape falló, pruebo restore ×1.21:",
          scrapeError instanceof Error ? scrapeError.message : scrapeError,
        );
      }

      // 2) Fallback: restore heurístico del par guardado.
      if (nextPrice == null && stored != null) {
        const restored = maybeRestoreSpanishVatPair(stored, storedPrev);
        nextPrice = restored.price;
        nextList = restored.listPrice;
      }

      if (nextPrice == null) {
        skipped += 1;
        console.log(asin, "SKIP sin precio");
        continue;
      }

      nextPrice = roundMoney(nextPrice);
      nextList =
        nextList != null && nextList > nextPrice ? roundMoney(nextList) : null;

      const changed =
        stored == null ||
        Math.abs(stored - nextPrice) >= 0.01 ||
        (nextList != null &&
          (storedPrev == null || Math.abs(storedPrev - nextList) >= 0.01));

      if (!changed) {
        skipped += 1;
        console.log(asin, "OK ya correcto", nextPrice, nextList);
        await sleep(800);
        continue;
      }

      console.log(
        asin,
        `${stored} → ${nextPrice}`,
        storedPrev != null ? `ref ${storedPrev} → ${nextList}` : "",
        dryRun ? "(dry)" : "",
      );

      if (!dryRun) {
        const now = new Date().toISOString();
        const previousLowest = toNumber(row.lowest_price);
        const previousHighest = toNumber(row.highest_price);
        const reference = nextList ?? nextPrice;
        const discount =
          nextList != null
            ? roundMoney(((nextList - nextPrice) / nextList) * 100)
            : null;

        const { error: updateError } = await sb
          .from("products")
          .update({
            current_price: nextPrice,
            previous_price: reference,
            discount_percentage: discount,
            lowest_price:
              previousLowest == null
                ? nextPrice
                : roundMoney(Math.min(previousLowest, nextPrice)),
            highest_price: roundMoney(
              Math.max(
                previousHighest ?? nextPrice,
                nextPrice,
                reference,
              ),
            ),
            last_checked_at: now,
            updated_at: now,
          })
          .eq("id", row.id);

        if (updateError) throw new Error(updateError.message);

        await sb.from("price_history").insert({
          product_id: row.id,
          price: nextPrice,
          source: "amazon",
        });
      }

      updated += 1;
      await sleep(1_100);
    } catch (error) {
      failed += 1;
      console.error(
        asin,
        "FAIL",
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log({ updated, skipped, failed });
}

void main();
