import type { CatalogProduct } from "@/lib/catalog";
import { marketplaceAbsoluteUrl } from "@/lib/site";

export interface ArticleMarketplaceCategory {
  slug: string;
  name: string;
  /** Listado de la categoría en el marketplace (chollosdhoy.com). */
  href: string;
}

/**
 * Categoría padre más repetida entre los productos del artículo. La etiqueta
 * del artículo («Guías», «Comparativas») no sirve: es editorial, no de
 * producto. Empate → la del primer producto que aparece.
 */
export function resolveArticleMarketplaceCategory(
  products: CatalogProduct[],
): ArticleMarketplaceCategory | null {
  const counts = new Map<string, { name: string; count: number }>();
  for (const product of products) {
    const category = product.category;
    if (!category) continue;
    const slug = category.parentSlug ?? category.slug;
    const name = category.parentName ?? category.name;
    const entry = counts.get(slug) ?? { name, count: 0 };
    entry.count += 1;
    counts.set(slug, entry);
  }

  let best: { slug: string; name: string; count: number } | null = null;
  for (const [slug, entry] of counts) {
    if (!best || entry.count > best.count) best = { slug, ...entry };
  }
  if (!best || best.slug === "otros") return null;

  return {
    slug: best.slug,
    name: best.name,
    href: marketplaceAbsoluteUrl(`/categoria/${best.slug}`),
  };
}
