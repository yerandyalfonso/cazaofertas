/**
 * Descubrimiento de rebajas Carrefour (solo Mac: necesita Google Chrome con
 * ventana real para pasar Cloudflare).
 *
 *   npm run cron:local:carrefour                 # escribe y avisa
 *   npm run cron:local:carrefour -- --dry-run    # solo muestra qué haría
 *   npm run cron:local:carrefour -- --pages=2 --limit=10
 *   npm run cron:local:carrefour -- --backfill-images   # sube fotos ya guardadas
 */
function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const started = new Date().toISOString();
  console.log(`[local-cron] carrefour-deals started ${started}`);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  }

  const { backfillCarrefourProductImages, runCarrefourDealsCheck } = await import(
    "@/services/carrefourDeals"
  );
  if (process.argv.includes("--backfill-images")) {
    console.log(JSON.stringify(await backfillCarrefourProductImages(), null, 2));
    return;
  }
  const pages = Number(readFlag("pages"));
  const limit = Number(readFlag("limit"));
  const result = await runCarrefourDealsCheck({
    dryRun: process.argv.includes("--dry-run"),
    notify: !process.argv.includes("--no-notify"),
    pagesPerFeed: Number.isFinite(pages) && pages > 0 ? pages : undefined,
    limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
  });
  console.log(JSON.stringify(result, null, 2));
  console.log(`[local-cron] carrefour-deals finished ${new Date().toISOString()}`);
}

main().catch((error) => {
  console.error("[local-cron] carrefour-deals failed", error);
  process.exit(1);
});
