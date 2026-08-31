import {
  inferProductSubcategorySlug,
  normalizeCategorySlugForStorage,
  type AmazonCategoryInferenceInput,
} from "@/lib/product-category-inference";
import {
  resolveCategoryDisplayMeta,
  resolveParentSlug,
} from "@/lib/category-taxonomy";
import type { SiteCategorySlug } from "@/lib/site-categories";
import type { TypedSupabaseClient } from "@/lib/supabase";

export type { SiteCategorySlug };

export async function resolveCategoryIdBySlug(
  client: TypedSupabaseClient,
  slug: string | null | undefined,
): Promise<{ id: string; name: string; slug: string; parent_id: string | null } | null> {
  if (!slug?.trim()) return null;

  const { data } = await client
    .from("categories")
    .select("id, name, slug, parent_id")
    .eq("slug", slug.trim())
    .eq("is_active", true)
    .maybeSingle();

  return data ?? null;
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
  const normalized = normalizeCategorySlugForStorage(slug);
  const row = await resolveCategoryIdBySlug(client, normalized);
  const display =
    resolveCategoryDisplayMeta(normalized) ??
    resolveCategoryDisplayMeta("otros-general")!;

  return {
    categoryId: row?.id ?? null,
    subcategorySlug: display.subcategorySlug,
    subcategoryName: display.subcategoryName,
    parentSlug: display.parentSlug,
    parentName: display.parentName,
  };
}

export { inferProductSubcategorySlug, resolveParentSlug };
