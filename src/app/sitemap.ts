import type { MetadataRoute } from "next";
import { getCategories } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/site";
import { getPublishedArticles } from "@/services/blog";

export const revalidate = 3600;

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

  // Las fichas de producto no van aquí: su URL canónica es la del
  // marketplace (chollosdhoy.com/oferta/…), que tiene su propio sitemap.
  const [categories, articles] = await Promise.all([
    getCategories(),
    getPublishedArticles(),
  ]);

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
    ...categoryRoutes,
    ...articleRoutes,
  ];
}
