/**
 * Reclasifica productos activos según título/brand (misma inferencia que los crons).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/reclassify-products.ts
 *   npx tsx --env-file=.env.local scripts/reclassify-products.ts --apply
 *   npx tsx --env-file=.env.local scripts/reclassify-products.ts --apply --limit=200
 *
 * Por defecto solo dry-run. Solo propone cambio si:
 * - la categoría actual es `general` (o null), y
 * - la inferencia es más específica (no acaba en -general / otros-general),
 * - el título no es genérico tipo "Producto Miravia 123…".
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

function isGenericTitle(title: string): boolean {
  return /^producto\s+(miravia|kiabi|amazon)\s+\d+/i.test(title.trim());
}

function isGeneralSlug(slug: string | null | undefined): boolean {
  if (!slug) return true;
  return slug === "general" || slug.endsWith("-general");
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 500;

  const { createSupabaseServiceClient } = await import("@/lib/supabase");
  const { resolveCategoryMetaForDeal } = await import("@/lib/categories");
  const { inferProductSubcategorySlug } = await import(
    "@/lib/product-category-inference"
  );
  const { ensureCategoryKeywordRulesLoaded } = await import(
    "@/services/categoryKeywords"
  );

  await ensureCategoryKeywordRulesLoaded(true);
  const client = createSupabaseServiceClient();

  const { data: products, error } = await client
    .from("products")
    .select(
      "id, title, brand, retailer, category_id, categories(id, name, slug, parent_id, parent:parent_id(slug))",
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(Number.isFinite(limit) && limit > 0 ? limit : 500);

  if (error) throw new Error(error.message);

  let checked = 0;
  let wouldChange = 0;
  let changed = 0;
  let skippedGeneric = 0;
  let skippedSpecific = 0;

  for (const product of products ?? []) {
    checked += 1;
    if (isGenericTitle(product.title)) {
      skippedGeneric += 1;
      continue;
    }

    const current = Array.isArray(product.categories)
      ? product.categories[0]
      : product.categories;
    const currentParent = current?.parent
      ? Array.isArray(current.parent)
        ? current.parent[0]
        : current.parent
      : null;

    // Solo tocamos productos mal/poco clasificados (general o sin categoría).
    if (!isGeneralSlug(current?.slug)) {
      skippedSpecific += 1;
      continue;
    }

    const inferredSlug = inferProductSubcategorySlug({
      title: product.title,
      brand: product.brand,
    });
    const meta = await resolveCategoryMetaForDeal(client, inferredSlug);
    if (!meta.categoryId) continue;

    // No bajar a otro general / otros-general (no aporta).
    if (isGeneralSlug(meta.subcategorySlug)) continue;

    const currentParentSlug = currentParent?.slug ?? null;
    // Solo upgrade dentro del mismo padre, o escape desde "otros".
    // Evita falsos positivos tipo arena gatos → perfumes, LEGO → muebles.
    if (
      currentParentSlug &&
      currentParentSlug !== "otros" &&
      meta.parentSlug !== currentParentSlug
    ) {
      continue;
    }

    const same = product.category_id === meta.categoryId;
    if (same) continue;

    wouldChange += 1;
    console.log(
      [
        apply ? "UPDATE" : "DRY",
        (product.retailer ?? "?").padEnd(7),
        `${currentParent?.slug ?? "-"}/${current?.slug ?? "null"}`.padEnd(28),
        "→",
        `${meta.parentSlug}/${meta.subcategorySlug}`.padEnd(28),
        product.title.slice(0, 55),
      ].join(" "),
    );

    if (apply) {
      const { error: updErr } = await client
        .from("products")
        .update({ category_id: meta.categoryId })
        .eq("id", product.id);
      if (updErr) {
        console.warn("  fail", updErr.message);
      } else {
        changed += 1;
      }
    }
  }

  console.log(
    `\nRevisados ${checked} (omitidos: ${skippedGeneric} títulos genéricos, ${skippedSpecific} ya específicos).`,
  );
  console.log(
    `Cambios ${apply ? "aplicados" : "propuestos"}: ${apply ? changed : wouldChange}.`,
  );
  if (!apply && wouldChange > 0) {
    console.log("Pasa --apply para escribir en la BD.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
