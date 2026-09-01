import type { SubcategoryRule } from "@/lib/subcategory-inference-types";

function dedupeKeywords(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function mergeSubcategoryRules(
  base: SubcategoryRule[],
  extensions: SubcategoryRule[],
): SubcategoryRule[] {
  const bySlug = new Map<string, SubcategoryRule>();

  for (const rule of base) {
    bySlug.set(rule.slug, {
      slug: rule.slug,
      breadcrumbPatterns: [...rule.breadcrumbPatterns],
      titleKeywords: [...rule.titleKeywords],
    });
  }

  for (const rule of extensions) {
    const existing = bySlug.get(rule.slug);
    if (existing) {
      existing.titleKeywords = dedupeKeywords([
        ...existing.titleKeywords,
        ...rule.titleKeywords,
      ]);
      existing.breadcrumbPatterns = [
        ...existing.breadcrumbPatterns,
        ...rule.breadcrumbPatterns,
      ];
    } else {
      bySlug.set(rule.slug, {
        slug: rule.slug,
        breadcrumbPatterns: [...rule.breadcrumbPatterns],
        titleKeywords: dedupeKeywords(rule.titleKeywords),
      });
    }
  }

  return [...bySlug.values()];
}
