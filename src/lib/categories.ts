import {
  inferProductSubcategorySlug,
  normalizeCategorySlugForStorage,
  type AmazonCategoryInferenceInput,
} from "@/lib/product-category-inference";
import {
  DEFAULT_SUBCATEGORY_BY_PARENT,
  GENERAL_CHILD_SLUG,
  parseSubcategorySlug,
  resolveCategoryDisplayMeta,
  resolveParentSlug,
} from "@/lib/category-taxonomy";
import type { SiteCategorySlug } from "@/lib/site-categories";
import type { TypedSupabaseClient } from "@/lib/supabase";

export type { SiteCategorySlug };

export async function resolveCategoryIdBySlug(
  client: TypedSupabaseClient,
  slug: string | null | undefined,
  options?: { parentSlug?: string | null },
): Promise<{ id: string; name: string; slug: string; parent_id: string | null } | null> {
  if (!slug?.trim()) return null;

  const parsed = parseSubcategorySlug(slug, options?.parentSlug);
  if (!parsed) {
    const { data } = await client
      .from("categories")
      .select("id, name, slug, parent_id")
      .eq("slug", slug.trim())
      .is("parent_id", null)
      .eq("is_active", true)
      .maybeSingle();
    return data ?? null;
  }

  const { data: parent } = await client
    .from("categories")
    .select("id")
    .eq("slug", parsed.parentSlug)
    .is("parent_id", null)
    .eq("is_active", true)
    .maybeSingle();

  if (!parent?.id) return null;

  const { data: childRow } = await client
    .from("categories")
    .select("id, name, slug, parent_id")
    .eq("parent_id", parent.id)
    .eq("slug", parsed.childSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (childRow) return childRow;

  const legacySlugs = [parsed.lookupKey];
  if (parsed.childSlug === GENERAL_CHILD_SLUG) {
    legacySlugs.push(
      `${parsed.parentSlug}-${GENERAL_CHILD_SLUG}`,
      `${parsed.parentSlug}-${parsed.parentSlug}`,
    );
  }

  for (const legacySlug of legacySlugs) {
    const { data: legacyRow } = await client
      .from("categories")
      .select("id, name, slug, parent_id")
      .eq("slug", legacySlug)
      .eq("is_active", true)
      .maybeSingle();
    if (legacyRow) return legacyRow;
  }

  return null;
}

export async function resolveProductCategoryId(
  client: TypedSupabaseClient,
  input: AmazonCategoryInferenceInput & { categorySlug?: string | null },
): Promise<string | null> {
  const subSlug = normalizeCategorySlugForStorage(
    input.categorySlug ?? inferProductSubcategorySlug(input),
  );
  const category = await resolveCategoryIdBySlug(client, subSlug);
  return category?.id ?? null;
}

export async function resolveAmazonProductCategoryId(
  client: TypedSupabaseClient,
  input: AmazonCategoryInferenceInput & { categorySlug?: string | null },
): Promise<string | null> {
  return resolveProductCategoryId(client, input);
}

export async function resolveCategoryMetaForDeal(
  client: TypedSupabaseClient,
  slug: string | null | undefined,
): Promise<{
  categoryId: string | null;
  subcategorySlug: string;
  subcategoryName: string;
  parentSlug: SiteCategorySlug;
  parentName: string;
}> {
  const lookupKey = normalizeCategorySlugForStorage(slug);
  const parsed =
    parseSubcategorySlug(slug) ?? parseSubcategorySlug(lookupKey);
  const row = await resolveCategoryIdBySlug(client, slug ?? lookupKey);
  const display =
    resolveCategoryDisplayMeta(row?.slug ?? lookupKey, parsed?.parentSlug) ??
    resolveCategoryDisplayMeta(lookupKey) ??
    resolveCategoryDisplayMeta(DEFAULT_SUBCATEGORY_BY_PARENT.otros)!;

  return {
    categoryId: row?.id ?? null,
    subcategorySlug: display.subcategorySlug,
    subcategoryName: display.subcategoryName,
    parentSlug: display.parentSlug,
    parentName: display.parentName,
  };
}

export { inferProductSubcategorySlug, resolveParentSlug };
