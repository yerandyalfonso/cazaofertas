import {
  BLOG_POSTS,
  collectProductSlugs,
  type BlogBlock,
  type BlogPost,
} from "@/lib/blog";
import { BLOG_IMAGES } from "@/lib/blog-images";
import {
  isArticleDocument,
  type ArticleDocument,
} from "@/lib/admin-article-editor";
import type { BlogTemplate } from "@/lib/blog-templates";
import {
  getProductsBySlugs,
  toCatalogProduct,
  type CatalogProduct,
} from "@/lib/catalog";
import { createSupabaseServiceClient } from "@/lib/supabase";
import type { ArticleRow, CategoryRow, Json, ProductRow } from "@/types/database";

type ProductWithCategory = ProductRow & {
  categories?:
    | Pick<CategoryRow, "id" | "name" | "slug">
    | Pick<CategoryRow, "id" | "name" | "slug">[]
    | null;
};

type ArticleProductJoin = {
  position: number;
  products: ProductWithCategory | ProductWithCategory[] | null;
};

type ArticleQueryRow = ArticleRow & {
  article_products?: ArticleProductJoin[] | null;
};

export interface BlogArticleResult {
  post: BlogPost;
  products: CatalogProduct[];
  source: "supabase" | "fallback";
}

function getClient() {
  try {
    return createSupabaseServiceClient();
  } catch {
    return null;
  }
}

export function isBlogBlock(value: unknown): value is BlogBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as { type?: string };
  switch (block.type) {
    case "paragraph":
      return typeof (value as { text?: unknown }).text === "string";
    case "heading": {
      const level = (value as { level?: unknown }).level;
      return (
        (level === 2 || level === 3) &&
        typeof (value as { text?: unknown }).text === "string"
      );
    }
    case "image":
      return (
        typeof (value as { src?: unknown }).src === "string" &&
        typeof (value as { alt?: unknown }).alt === "string"
      );
    case "product":
      return typeof (value as { slug?: unknown }).slug === "string";
    case "productGrid":
      return Array.isArray((value as { slugs?: unknown }).slugs);
    case "blockquote":
      return typeof (value as { text?: unknown }).text === "string";
    case "divider":
      return true;
    case "prosCons":
      return (
        Array.isArray((value as { pros?: unknown }).pros) &&
        Array.isArray((value as { cons?: unknown }).cons)
      );
    default:
      return false;
  }
}

function looksLikeHtml(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.startsWith("<") ||
    /<\/?(p|h[1-6]|div|section|article|ul|ol|li|blockquote|hr|img|figure)\b/i.test(
      trimmed,
    )
  );
}

function looksLikeJsonDocument(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("[") || trimmed.startsWith("{");
}

/**
 * Normaliza `articles.content` (jsonb | text | stringified JSON | HTML | documento editorial)
 * a bloques tipados o HTML seguro — nunca vuelca JSON crudo a la UI.
 */
export function parseContent(content: Json | string | null | undefined): {
  body: BlogBlock[];
  html?: string;
  template?: BlogTemplate;
  pullQuote?: string;
  pros?: string[];
  cons?: string[];
} {
  if (content == null) {
    return { body: [] };
  }

  let value: unknown = content;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (looksLikeJsonDocument(trimmed)) {
      try {
        value = JSON.parse(trimmed) as unknown;
      } catch {
        if (looksLikeHtml(trimmed)) {
          return { body: [], html: trimmed };
        }
        return { body: [] };
      }
    } else if (looksLikeHtml(trimmed)) {
      return { body: [], html: trimmed };
    } else {
      return { body: [] };
    }
  }

  if (isArticleDocument(value)) {
    const doc = value as ArticleDocument;
    return {
      body: doc.blocks.filter(isBlogBlock),
      template: doc.template,
      pullQuote: doc.pullQuote,
      pros: doc.pros,
      cons: doc.cons,
    };
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as { html?: unknown }).html === "string"
  ) {
    const html = (value as { html: string }).html;
    return { body: [], html: looksLikeHtml(html) ? html : undefined };
  }

  if (Array.isArray(value)) {
    return { body: value.filter(isBlogBlock) };
  }

  return { body: [] };
}

function formatReadingTime(minutes: number): string {
  const value = Number.isFinite(minutes) && minutes > 0 ? minutes : 5;
  return `${value} min`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

const FEATURED_CATEGORIES = new Set([
  "Comparativas",
  "Guías",
  "Tecnología",
  "Hogar",
]);

function enrichFromFallback(post: BlogPost): BlogPost {
  const fallback = BLOG_POSTS.find((item) => item.slug === post.slug);
  if (!fallback) return post;

  const needsBody = post.body.length === 0 && !post.html;
  return {
    ...fallback,
    ...post,
    body: needsBody ? fallback.body : post.body,
    html: post.html ?? (needsBody ? fallback.html : undefined),
    relatedProductSlugs:
      post.relatedProductSlugs && post.relatedProductSlugs.length > 0
        ? post.relatedProductSlugs
        : fallback.relatedProductSlugs,
    coverImage: post.coverImage || fallback.coverImage,
    coverAlt: post.coverAlt || fallback.coverAlt,
    template: post.template ?? fallback.template,
    pros: post.pros ?? fallback.pros,
    cons: post.cons ?? fallback.cons,
    pullQuote: post.pullQuote ?? fallback.pullQuote,
    reviewedAt: post.reviewedAt ?? fallback.reviewedAt,
  };
}

function mapArticleRow(row: ArticleQueryRow): BlogPost {
  const coverImage = row.featured_image ?? BLOG_IMAGES.laptopDeals;
  const parsed = parseContent(row.content);
  const relatedFromJoin = productsFromArticleJoin(row).map((p) => p.slug);

  const mapped: BlogPost = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    category: row.category,
    readingTime: formatReadingTime(row.reading_time),
    publishedAt: formatDate(row.created_at),
    featured: FEATURED_CATEGORIES.has(row.category),
    coverImage,
    coverAlt: row.title,
    body: parsed.body,
    html: parsed.html,
    relatedProductSlugs: relatedFromJoin,
    template: parsed.template,
    pullQuote: parsed.pullQuote,
    pros: parsed.pros,
    cons: parsed.cons,
    reviewedAt: formatDate(row.updated_at),
  };

  return enrichFromFallback(mapped);
}

function productsFromArticleJoin(row: ArticleQueryRow): CatalogProduct[] {
  const links = [...(row.article_products ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  const products: CatalogProduct[] = [];
  for (const link of links) {
    const raw = link.products;
    const product = Array.isArray(raw) ? raw[0] : raw;
    if (!product || product.is_active === false) continue;
    products.push(toCatalogProduct(product));
  }
  return products;
}

async function mergeProducts(
  post: BlogPost,
  related: CatalogProduct[],
): Promise<CatalogProduct[]> {
  const bySlug = new Map(related.map((product) => [product.slug, product]));
  const missing = collectProductSlugs(post).filter((slug) => !bySlug.has(slug));
  if (missing.length > 0) {
    const fetched = await getProductsBySlugs(missing);
    for (const product of fetched) {
      bySlug.set(product.slug, product);
    }
  }
  return [...bySlug.values()];
}

async function fetchPublishedArticles(): Promise<ArticleQueryRow[]> {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from("articles")
    .select(
      `
      *,
      article_products (
        position,
        products (*, categories(id, name, slug))
      )
    `,
    )
    .eq("status", "published")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[blog] fetchPublishedArticles", error.message);
    return [];
  }

  return (data ?? []) as ArticleQueryRow[];
}

/** Artículos publicados desde Supabase; si la tabla está vacía, usa el mock editorial. */
export async function getPublishedArticles(): Promise<BlogPost[]> {
  const rows = await fetchPublishedArticles();
  if (rows.length === 0) {
    return BLOG_POSTS;
  }
  return rows.map(mapArticleRow);
}

export async function getFeaturedArticles(): Promise<BlogPost[]> {
  const posts = await getPublishedArticles();
  const featured = posts.filter((post) => post.featured);
  return featured.length > 0 ? featured : posts.slice(0, 2);
}

export async function getArticleBySlug(
  slug: string,
): Promise<BlogArticleResult | null> {
  const client = getClient();

  if (client) {
    try {
      const { data, error } = await client
        .from("articles")
        .select(
          `
        *,
        article_products (
          position,
          products (*, categories(id, name, slug))
        )
      `,
        )
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();

      if (error) {
        console.error("[blog] getArticleBySlug", error.message);
      } else if (data) {
        const row = data as ArticleQueryRow;
        const post = mapArticleRow(row);
        const products = await mergeProducts(post, productsFromArticleJoin(row));
        return { post, products, source: "supabase" };
      }
    } catch (error) {
      console.error(
        "[blog] getArticleBySlug aborted/failed",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const fallback = BLOG_POSTS.find((post) => post.slug === slug);
  if (!fallback) return null;

  try {
    const products = await getProductsBySlugs(collectProductSlugs(fallback));
    return { post: fallback, products, source: "fallback" };
  } catch {
    return { post: fallback, products: [], source: "fallback" };
  }
}

export async function getArticleSlugs(): Promise<string[]> {
  const posts = await getPublishedArticles();
  return posts.map((post) => post.slug);
}
