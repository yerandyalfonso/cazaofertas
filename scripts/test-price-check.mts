import { runAmazonPriceCheck } from "../src/services/amazonPriceCheck";

async function main() {
  try {
    const r = await runAmazonPriceCheck({ limit: 1, notify: false });
    console.log(
      JSON.stringify(
        {
          ok: r.ok,
          provider: r.provider,
          scoped: r.scoped,
          processed: r.stats.processed,
          updated: r.stats.updated,
          errors: r.stats.errors.slice(0, 5),
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error("THREW:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}

void main();
