/**
 * Recupera el título real de productos Miravia guardados como
 * «Producto Miravia <id>» (el importador lo usaba cuando el listado no traía
 * nombre). Lee og:title de la ficha y, con el título ya bueno, reasigna la
 * categoría si estaba en «general». El slug no se toca (URLs ya indexadas).
 *
 * Ejecutar desde el Mac (IP residencial): desde el VPS Miravia da captcha.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/fix-miravia-titles.ts
 *   npx tsx --env-file=.env.local scripts/fix-miravia-titles.ts --apply
 *   npx tsx --env-file=.env.local scripts/fix-miravia-titles.ts --limit=5
 *   npx tsx --env-file=.env.local scripts/fix-miravia-titles.ts --apply --delay=45
 *
 * Miravia pide captcha tras ~10 fichas seguidas: con --delay (segundos
 * entre fichas, 1.5 por defecto) se puede dejar corriendo en segundo plano.
 *
 * Por defecto solo dry-run.
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

function isGeneralSlug(slug: string | null | undefined): boolean {
  if (!slug) return true;
  return slug === "general" || slug.endsWith("-general");
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 1000;
  const delayArg = process.argv.find((a) => a.startsWith("--delay="));
  const delayMs = delayArg ? Number(delayArg.split("=")[1]) * 1000 : 1500;

  const { createSupabaseServiceClient } = await import("@/lib/supabase");
  const { resolveCategoryMetaForDeal } = await import("@/lib/categories");
  const { inferProductSubcategorySlug } = await import(
    "@/lib/product-category-inference"
  );
  const { ensureCategoryKeywordRulesLoaded } = await import(
    "@/services/categoryKeywords"
  );
  const { isPlaceholderMiraviaTitle, scrapeMiraviaProductPage } = await import(
    "@/providers/retail/miravia"
  );

  await ensureCategoryKeywordRulesLoaded(true);
  const client = createSupabaseServiceClient();

  const { data: products, error } = await client
    .from("products")
    .select("id, title, product_url, categories(slug)")
    .eq("retailer", "miravia")
    .like("title", "Producto Miravia %")
    .order("updated_at", { ascending: false })
    .limit(Number.isFinite(limit) && limit > 0 ? limit : 1000);
  if (error) throw new Error(error.message);

  let fixed = 0;
  let recategorized = 0;
  const failed: string[] = [];

  for (const product of products ?? []) {
    if (!isPlaceholderMiraviaTitle(product.title) || !product.product_url) continue;

    let title: string | null = null;
    try {
      const quote = await scrapeMiraviaProductPage(product.product_url, {
        timeoutMs: 14_000,
      });
      if (!isPlaceholderMiraviaTitle(quote.title)) title = quote.title;
    } catch (scrapeError) {
      const message =
        scrapeError instanceof Error ? scrapeError.message : String(scrapeError);
      if (/captcha/i.test(message)) {
        console.error("Miravia pide captcha: se para aquí (reintenta más tarde).");
        break;
      }
    }

    if (!title) {
      failed.push(product.product_url);
      await new Promise((done) => setTimeout(done, delayMs));
      continue;
    }

    const current = Array.isArray(product.categories)
      ? product.categories[0]
      : product.categories;
    const patch: { title: string; category_id?: string } = { title };
    if (isGeneralSlug(current?.slug)) {
      const meta = await resolveCategoryMetaForDeal(
        client,
        inferProductSubcategorySlug({ title }),
      );
      if (meta.categoryId && !isGeneralSlug(meta.subcategorySlug)) {
        patch.category_id = meta.categoryId;
        recategorized += 1;
      }
    }

    console.log(`${product.title} → ${title}`);
    fixed += 1;
    if (apply) {
      const { error: updateError } = await client
        .from("products")
        .update(patch)
        .eq("id", product.id);
      if (updateError) throw new Error(updateError.message);
    }

    // Ritmo prudente para no disparar el anti-bot.
    await new Promise((done) => setTimeout(done, delayMs));
  }

  console.log(
    `\n${apply ? "Corregidos" : "Se corregirían"}: ${fixed} (con categoría nueva: ${recategorized}). Sin título en la ficha: ${failed.length}.`,
  );
  for (const url of failed) console.log(`  - ${url}`);
  if (!apply) console.log("\nDry-run. Añade --apply para guardar.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
