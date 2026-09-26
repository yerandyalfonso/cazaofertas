import type { MetadataRoute } from "next";
import {
  getCategoryNodes,
  getRetailerCounts,
  listActiveProductSlugs,
} from "@/lib/catalog";
import {
  categoryHref,
  retailerHref,
  subcategoryHasPage,
} from "@/lib/links";
import { absoluteUrl } from "@/lib/site";

// Se regenera como mucho cada hora (el catálogo cambia a diario).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, nodes, retailers] = await Promise.all([
    listActiveProductSlugs(),
    getCategoryNodes(),
    getRetailerCounts(),
  ]);
  const parents = nodes.filter((n) => !n.parentId && n.productCount > 0);
  const slugById = new Map(parents.map((n) => [n.id, n.slug]));
  const listingPaths = [
    ...parents.map((n) => categoryHref(n.slug)),
    ...nodes.flatMap((n) => {
      const parentSlug = n.parentId ? slugById.get(n.parentId) : undefined;
      return parentSlug && subcategoryHasPage(n, parentSlug)
        ? [categoryHref(parentSlug, n.slug)]
        : [];
    }),
    ...retailers.map((r) => retailerHref(r.id)),
  ];
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/cupones"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...listingPaths.map((path) => ({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/oferta/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
