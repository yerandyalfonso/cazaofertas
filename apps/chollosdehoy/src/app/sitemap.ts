import type { MetadataRoute } from "next";
import { listActiveProductSlugs } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";

// Se regenera como mucho cada hora (el catálogo cambia a diario).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await listActiveProductSlugs();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/cupones"), lastModified: now, changeFrequency: "daily", priority: 0.7 },
    ...products.map((product) => ({
      url: absoluteUrl(`/oferta/${product.slug}`),
      lastModified: new Date(product.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
