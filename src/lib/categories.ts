import {
  inferAmazonCategorySlug,
  type AmazonCategoryInferenceInput,
} from "@/lib/amazon-category";
import type { SiteCategorySlug } from "@/lib/site-categories";
import type { TypedSupabaseClient } from "@/lib/supabase";

export type { SiteCategorySlug };

export async function resolveCategoryIdBySlug(
  client: TypedSupabaseClient,
  slug: string | null | undefined,
): Promise<{ id: string; name: string; slug: string } | null> {
  if (!slug?.trim()) return null;

  const { data } = await client
    .from("categories")
    .select("id, name, slug")
    .eq("slug", slug.trim())
    .eq("is_active", true)
    .maybeSingle();

  return data ?? null;
}

export async function resolveAmazonProductCategoryId(
  client: TypedSupabaseClient,
  input: AmazonCategoryInferenceInput & { categorySlug?: string | null },
): Promise<string | null> {
  const slug =
    input.categorySlug?.trim() ||
    inferAmazonCategorySlug({
      breadcrumbs: input.breadcrumbs,
      title: input.title,
      brand: input.brand,
    });

  if (!slug) return null;

  const category = await resolveCategoryIdBySlug(client, slug);
  return category?.id ?? null;
}
