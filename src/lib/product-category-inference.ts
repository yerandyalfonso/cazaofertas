import {
  DEFAULT_SUBCATEGORY_BY_PARENT,
  type BlogCategorySlug,
  resolveParentSlug,
  resolveSubcategorySlug,
} from "@/lib/category-taxonomy";
import {
  inferAmazonCategorySlug,
  type AmazonCategoryInferenceInput,
} from "@/lib/amazon-category";
import { getCachedCategoryKeywordRules } from "@/services/categoryKeywords";

export type { AmazonCategoryInferenceInput };

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scorePatterns(text: string, patterns: RegExp[]): number {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(normalized)) score += 6;
  }
  return score;
}

/** Keywords: frases = includes; tokens cortos = límites de palabra. */
function scoreKeywords(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let score = 0;
  for (const keyword of keywords) {
    const needle = normalizeText(keyword);
    if (!needle) continue;
    if (needle.includes(" ") || needle.length >= 8) {
      if (normalized.includes(needle)) score += 5;
      continue;
    }
    const re = new RegExp(
      `(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:[^a-z0-9]|$)`,
    );
    if (re.test(normalized)) score += 5;
  }
  return score;
}

const MIN_SUBCATEGORY_SCORE = 5;

/**
 * Infiere subcategoría interna (bot / Telegram / BD).
 *
 * Orden:
 * 1) Reglas finas desde `category_keywords` (breadcrumbs + keywords admin)
 * 2) Padre inferido del título/breadcrumbs (nunca del feed)
 * 3) Feed Amazon solo como último respaldo
 * 4) otros-general
 *
 * Antes de usarla en crons/API, llama a `ensureCategoryKeywordRulesLoaded()`.
 */
export function inferProductSubcategorySlug(
  input: AmazonCategoryInferenceInput,
): string {
  const breadcrumbs = (input.breadcrumbs ?? [])
    .map((crumb) => crumb.trim())
    .filter(Boolean);
  const title = input.title?.trim() ?? "";
  const brand = input.brand?.trim() ?? "";
  const breadcrumbBlob = breadcrumbs.join(" ");
  const titleBlob = [brand, title].filter(Boolean).join(" ");

  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const rule of getCachedCategoryKeywordRules()) {
    const score =
      scorePatterns(breadcrumbBlob, rule.breadcrumbPatterns) +
      scoreKeywords(titleBlob, rule.titleKeywords) +
      scoreKeywords(breadcrumbBlob, rule.titleKeywords);
    if (score > bestScore) {
      bestScore = score;
      bestSlug = rule.slug;
    }
  }

  if (bestSlug && bestScore >= MIN_SUBCATEGORY_SCORE) {
    return bestSlug;
  }

  const inferredParent = inferAmazonCategorySlug({
    breadcrumbs,
    title,
    brand,
    feedCategorySlug: null,
  });

  const parent =
    inferredParent ??
    (input.feedCategorySlug
      ? resolveParentSlug(input.feedCategorySlug) ?? input.feedCategorySlug
      : null);

  if (parent && parent in DEFAULT_SUBCATEGORY_BY_PARENT) {
    return DEFAULT_SUBCATEGORY_BY_PARENT[parent as BlogCategorySlug];
  }

  return DEFAULT_SUBCATEGORY_BY_PARENT.otros;
}

/** Slug de blog (padre) a partir de subcategoría o padre legacy. */
export function inferBlogCategorySlug(
  input: AmazonCategoryInferenceInput,
): BlogCategorySlug {
  const sub = inferProductSubcategorySlug(input);
  return resolveParentSlug(sub) ?? "otros";
}

export function normalizeCategorySlugForStorage(
  slug: string | null | undefined,
): string {
  return resolveSubcategorySlug(slug) ?? DEFAULT_SUBCATEGORY_BY_PARENT.otros;
}
