import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/site";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getPublishedArticles } from "@/services/blog";

export const revalidate = 3600;

async function getProductSitemapEntries(): Promise<
  Array<{ slug: string; lastModified: Date }>
> {
  try {
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("products")
      .select("slug, updated_at, last_checked_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (error || !data) return [];

    return data
      .filter((row) => Boolean(row.slug))
      .map((row) => ({
        slug: row.slug,
        lastModified: new Date(
          row.last_checked_at ?? row.updated_at ?? Date.now(),
        ),
      }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "hourly", priority: 1 },
    {
      url: `${base}/ofertas`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${base}/categorias`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${base}/aviso-legal`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${base}/privacidad`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const [products, categories, articles] = await Promise.all([
    getProductSitemapEntries(),
    getCategories(),
    getPublishedArticles(),
  ]);

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${base}/producto/${product.slug}`,
    lastModified: product.lastModified,
    changeFrequency: "hourly",
    priority: 0.85,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${base}/categorias/${category.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.75,
  }));

  const articleRoutes: MetadataRoute.Sitemap = articles.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.reviewedAt ?? post.publishedAt),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...productRoutes,
    ...categoryRoutes,
    ...articleRoutes,
  ];
}
