/**
 * Clasificación editable (tabla category_keywords).
 * Fuente única de titleKeywords + breadcrumbPatterns; cache ~30s.
 */

import {
  composeSubcategorySlug,
  GENERAL_CHILD_SLUG,
  getSubcategory,
  subcategoryLookupKey,
} from "@/lib/category-taxonomy";
import {
  compileBreadcrumbPatterns,
  normalizeBreadcrumbPatterns,
  parseBreadcrumbPatternList,
} from "@/lib/breadcrumb-patterns";
import {
  normalizeKeywordList,
  parseKeywordList,
} from "@/lib/keyword-list";
import type { SubcategoryRule } from "@/lib/subcategory-inference-types";
import { createSupabaseServiceClient } from "@/lib/supabase";

export {
  formatKeywordList,
  normalizeKeywordList,
  parseKeywordList,
} from "@/lib/keyword-list";
export {
  formatBreadcrumbPatternList,
  normalizeBreadcrumbPatterns,
  parseBreadcrumbPatternList,
} from "@/lib/breadcrumb-patterns";

const CACHE_TTL_MS = 30_000;

type KeywordCache = {
  rules: SubcategoryRule[];
  expiresAt: number;
};

let cache: KeywordCache | null = null;

type CategoryJoin = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  parent?:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null;
};

export type CategoryKeywordRecord = {
  id: string;
  keywords: string[];
  breadcrumbPatterns: string[];
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  parentSlug: string | null;
  parentName: string | null;
  lookupSlug: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const SELECT_WITH_CATEGORY =
  "id, keywords, breadcrumb_patterns, category_id, is_active, notes, created_at, updated_at, categories(id, name, slug, parent_id, parent:parent_id(id, name, slug))";

function resolveParentNode(
  category: CategoryJoin,
): { id: string; name: string; slug: string } | null {
  const raw = category.parent;
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** Slug de lookup usado por la inferencia (p. ej. hogar-cocina / hogar-general). */
export function categoryToLookupSlug(category: {
  slug: string;
  parentSlug?: string | null;
}): string {
  const slug = category.slug.trim().toLowerCase();
  const parent = category.parentSlug?.trim().toLowerCase() || null;

  if (parent) {
    const sub = getSubcategory(slug, parent);
    if (sub) return subcategoryLookupKey(sub);
    if (slug === GENERAL_CHILD_SLUG) {
      return composeSubcategorySlug(parent, GENERAL_CHILD_SLUG);
    }
    if (slug.startsWith(`${parent}-`)) return slug;
    return composeSubcategorySlug(parent, slug);
  }

  const sub = getSubcategory(slug);
  if (sub) return subcategoryLookupKey(sub);
  return slug;
}

type DbRow = {
  id: string;
  keywords: string[] | null;
  breadcrumb_patterns?: string[] | null;
  category_id: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  categories: CategoryJoin | CategoryJoin[] | null;
};

function mapRow(row: DbRow): CategoryKeywordRecord | null {
  const categoryRaw = row.categories;
  const category = Array.isArray(categoryRaw)
    ? (categoryRaw[0] ?? null)
    : categoryRaw;
  if (!category) return null;

  const parent = resolveParentNode(category);
  const lookupSlug = categoryToLookupSlug({
    slug: category.slug,
    parentSlug: parent?.slug ?? null,
  });
  const keywords = normalizeKeywordList(row.keywords ?? []);
  const breadcrumbPatterns = normalizeBreadcrumbPatterns(
    row.breadcrumb_patterns ?? [],
  );
  if (keywords.length === 0 && breadcrumbPatterns.length === 0) return null;

  return {
    id: row.id,
    keywords,
    breadcrumbPatterns,
    categoryId: row.category_id,
    categoryName: category.name,
    categorySlug: category.slug,
    parentSlug: parent?.slug ?? null,
    parentName: parent?.name ?? null,
    lookupSlug,
    isActive: row.is_active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rulesFromGroups(groups: CategoryKeywordRecord[]): SubcategoryRule[] {
  return groups
    .filter(
      (item) =>
        item.isActive &&
        (item.keywords.length > 0 || item.breadcrumbPatterns.length > 0),
    )
    .map((item) => ({
      slug: item.lookupSlug,
      breadcrumbPatterns: compileBreadcrumbPatterns(item.breadcrumbPatterns),
      titleKeywords: item.keywords,
    }));
}

function assertHasContent(keywords: string[], patterns: string[]): void {
  if (keywords.length === 0 && patterns.length === 0) {
    throw new Error("Añade al menos keywords o patrones de breadcrumb.");
  }
}

export function invalidateCategoryKeywordCache(): void {
  cache = null;
}

export function getCachedCategoryKeywordRules(): SubcategoryRule[] {
  if (cache && cache.expiresAt > Date.now()) return cache.rules;
  return cache?.rules ?? [];
}

/** Carga reglas activas desde BD (cache ~30s). */
export async function ensureCategoryKeywordRulesLoaded(
  force = false,
): Promise<SubcategoryRule[]> {
  if (!force && cache && cache.expiresAt > Date.now()) {
    return cache.rules;
  }

  try {
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("category_keywords")
      .select(SELECT_WITH_CATEGORY)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("[category-keywords]", error.message);
      cache = { rules: cache?.rules ?? [], expiresAt: Date.now() + 5_000 };
      return cache.rules;
    }

    const mapped = (data ?? [])
      .map((row) => mapRow(row as unknown as DbRow))
      .filter((row): row is CategoryKeywordRecord => Boolean(row));

    const rules = rulesFromGroups(mapped);
    cache = { rules, expiresAt: Date.now() + CACHE_TTL_MS };
    return rules;
  } catch (error) {
    console.warn(
      "[category-keywords]",
      error instanceof Error ? error.message : error,
    );
    return cache?.rules ?? [];
  }
}

export async function listCategoryKeywords(options?: {
  includeInactive?: boolean;
}): Promise<CategoryKeywordRecord[]> {
  const client = createSupabaseServiceClient();
  let query = client
    .from("category_keywords")
    .select(SELECT_WITH_CATEGORY)
    .order("updated_at", { ascending: false });

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => mapRow(row as unknown as DbRow))
    .filter((row): row is CategoryKeywordRecord => Boolean(row))
    .sort((a, b) => {
      const pa = a.parentName ?? a.parentSlug ?? "";
      const pb = b.parentName ?? b.parentSlug ?? "";
      const parentCmp = pa.localeCompare(pb, "es");
      if (parentCmp !== 0) return parentCmp;
      return a.categoryName.localeCompare(b.categoryName, "es");
    });
}

export async function createCategoryKeyword(input: {
  keywords?: string | string[];
  breadcrumbPatterns?: string | string[];
  categoryId: string;
  isActive?: boolean;
  notes?: string | null;
}): Promise<CategoryKeywordRecord> {
  const keywords = parseKeywordList(input.keywords ?? "");
  const breadcrumbPatterns = parseBreadcrumbPatternList(
    input.breadcrumbPatterns ?? "",
  );
  assertHasContent(keywords, breadcrumbPatterns);
  if (!input.categoryId.trim()) throw new Error("Falta categoryId.");

  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("category_keywords")
    .insert({
      keywords,
      breadcrumb_patterns: breadcrumbPatterns,
      category_id: input.categoryId.trim(),
      is_active: input.isActive !== false,
      notes: input.notes?.trim() || null,
    })
    .select(SELECT_WITH_CATEGORY)
    .single();

  if (error) {
    if (/unique|duplicate/i.test(error.message)) {
      throw new Error("Ya existe un grupo para esa categoría.");
    }
    throw new Error(error.message);
  }

  const mapped = mapRow(data as unknown as DbRow);
  if (!mapped) throw new Error("No se pudo mapear el grupo creado.");
  invalidateCategoryKeywordCache();
  return mapped;
}

export async function updateCategoryKeyword(input: {
  id: string;
  keywords?: string | string[];
  breadcrumbPatterns?: string | string[];
  categoryId?: string;
  isActive?: boolean;
  notes?: string | null;
}): Promise<CategoryKeywordRecord> {
  if (!input.id.trim()) throw new Error("Falta id.");

  const patch: {
    keywords?: string[];
    breadcrumb_patterns?: string[];
    category_id?: string;
    is_active?: boolean;
    notes?: string | null;
    updated_at: string;
  } = { updated_at: new Date().toISOString() };

  if (input.keywords !== undefined) {
    patch.keywords = parseKeywordList(input.keywords);
  }
  if (input.breadcrumbPatterns !== undefined) {
    patch.breadcrumb_patterns = parseBreadcrumbPatternList(
      input.breadcrumbPatterns,
    );
  }
  if (input.keywords !== undefined || input.breadcrumbPatterns !== undefined) {
    // Validación completa: si solo se manda un campo, el otro se deja en BD;
    // comprobamos el resultado esperado solo cuando ambos vienen, si no
    // confiamos en el check de BD + lectura posterior.
    if (
      input.keywords !== undefined &&
      input.breadcrumbPatterns !== undefined
    ) {
      assertHasContent(patch.keywords ?? [], patch.breadcrumb_patterns ?? []);
    }
  }
  if (input.categoryId !== undefined) {
    if (!input.categoryId.trim()) throw new Error("Falta categoryId.");
    patch.category_id = input.categoryId.trim();
  }
  if (input.isActive !== undefined) patch.is_active = Boolean(input.isActive);
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("category_keywords")
    .update(patch)
    .eq("id", input.id)
    .select(SELECT_WITH_CATEGORY)
    .single();

  if (error) {
    if (/unique|duplicate|check|content_nonempty/i.test(error.message)) {
      throw new Error(
        /unique|duplicate/i.test(error.message)
          ? "Ya existe un grupo para esa categoría."
          : "Añade al menos keywords o patrones de breadcrumb.",
      );
    }
    throw new Error(error.message);
  }

  const mapped = mapRow(data as unknown as DbRow);
  if (!mapped) throw new Error("No se pudo mapear el grupo actualizado.");
  invalidateCategoryKeywordCache();
  return mapped;
}

export async function deleteCategoryKeyword(id: string): Promise<void> {
  if (!id.trim()) throw new Error("Falta id.");
  const client = createSupabaseServiceClient();
  const { error } = await client.from("category_keywords").delete().eq("id", id);
  if (error) throw new Error(error.message);
  invalidateCategoryKeywordCache();
}
