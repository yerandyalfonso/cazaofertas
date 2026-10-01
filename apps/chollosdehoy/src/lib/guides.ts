import { cache } from "react";
import { getSupabaseServer } from "@/lib/supabase";

/** Blog de CazaOfertas (guías y comparativas). */
const BLOG_URL = (
  process.env.NEXT_PUBLIC_BLOG_URL ?? "https://unamicadetot.com"
).replace(/\/$/, "");

export interface GuideLink {
  title: string;
  excerpt: string;
  href: string;
}

type ArticleProductRow = {
  articles: { slug: string; title: string; excerpt: string; status: string } | null;
  products: {
    categories: { slug: string; parent: { slug: string } | null } | null;
  } | null;
};

/**
 * Artículos publicados del blog que enlazan productos de la categoría padre,
 * ordenados por cuántos de sus productos son de ella. La tabla
 * `article_products` es pequeña: se lee entera (la página va con ISR).
 */
export const getGuidesForCategory = cache(
  async (parentSlug: string, limit = 3): Promise<GuideLink[]> => {
    const { data, error } = await getSupabaseServer()
      .from("article_products")
      .select(
        "articles(slug, title, excerpt, status), products(categories(slug, parent:parent_id(slug)))",
      );
    if (error || !data) {
      if (error) console.error("[guides]", error.message);
      return [];
    }

    const scores = new Map<string, { guide: GuideLink; count: number }>();
    for (const row of data as unknown as ArticleProductRow[]) {
      const article = row.articles;
      const category = row.products?.categories;
      if (!article || article.status !== "published" || !category) continue;
      if ((category.parent?.slug ?? category.slug) !== parentSlug) continue;
      const entry = scores.get(article.slug) ?? {
        guide: {
          title: article.title,
          excerpt: article.excerpt,
          href: `${BLOG_URL}/blog/${article.slug}`,
        },
        count: 0,
      };
      entry.count += 1;
      scores.set(article.slug, entry);
    }

    return [...scores.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((entry) => entry.guide);
  },
);
