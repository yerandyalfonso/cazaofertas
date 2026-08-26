import { NextRequest, NextResponse } from "next/server";
import {
  estimateBlocksReadingTime,
  isArticleDocument,
  type ArticleDocument,
} from "@/lib/admin-article-editor";
import { formatEnvError } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { parseContent } from "@/services/blog";
import type { Json } from "@/types/database";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeContentPayload(raw: unknown): {
  content: Json;
  readingHint: string;
} {
  if (raw && typeof raw === "object" && isArticleDocument(raw)) {
    const doc = raw as ArticleDocument;
    const text = doc.blocks
      .map((block) => {
        if (
          block.type === "paragraph" ||
          block.type === "heading" ||
          block.type === "blockquote"
        ) {
          return block.text;
        }
        if (block.type === "prosCons") {
          return [...block.pros, ...block.cons].join(" ");
        }
        return "";
      })
      .join(" ");
    return { content: doc as unknown as Json, readingHint: text };
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { content: { html: "" }, readingHint: "" };
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (isArticleDocument(parsed)) {
          return normalizeContentPayload(parsed);
        }
        return { content: parsed as Json, readingHint: trimmed };
      } catch {
        return { content: { html: trimmed }, readingHint: trimmed };
      }
    }
    return { content: { html: trimmed }, readingHint: trimmed };
  }

  return { content: { html: "" }, readingHint: "" };
}

export async function GET() {
  try {
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("articles")
      .select(
        `
        id,
        title,
        slug,
        excerpt,
        category,
        status,
        featured_image,
        author,
        reading_time,
        created_at,
        updated_at,
        content,
        article_products (
          position,
          product_id,
          products ( id, title, asin, slug )
        )
      `,
      )
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    const articles = (data ?? []).map((row) => {
      const links = [...(row.article_products ?? [])].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0),
      );
      const products = links
        .map((link) => {
          const product = Array.isArray(link.products)
            ? link.products[0]
            : link.products;
          if (!product) return null;
          return {
            id: product.id as string,
            title: product.title as string,
            asin: product.asin as string,
            slug: product.slug as string,
            position: link.position ?? 0,
          };
        })
        .filter(Boolean);

      const parsed = parseContent(row.content);

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        category: row.category,
        status: row.status,
        featuredImage: row.featured_image,
        author: row.author,
        readingTime: row.reading_time,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        template: parsed.template ?? null,
        products,
      };
    });

    const { data: products } = await client
      .from("products")
      .select("id, title, asin, slug")
      .eq("is_active", true)
      .order("title")
      .limit(300);

    return NextResponse.json({
      ok: true,
      articles,
      products: products ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: unknown;
      featuredImage?: string;
      author?: string;
      category?: string;
      status?: string;
      seoTitle?: string;
      seoDescription?: string;
      productIds?: string[];
    };

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json(
        { ok: false, error: "El título es obligatorio." },
        { status: 400 },
      );
    }

    const category = body.category?.trim();
    if (!category) {
      return NextResponse.json(
        { ok: false, error: "La categoría es obligatoria." },
        { status: 400 },
      );
    }

    const { content, readingHint } = normalizeContentPayload(body.content);
    const excerpt =
      body.excerpt?.trim() ||
      readingHint.replace(/\s+/g, " ").trim().slice(0, 220) ||
      title;

    const slug = (body.slug?.trim() || slugify(title)).slice(0, 100);
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Slug no válido." },
        { status: 400 },
      );
    }

    const status = ["draft", "published", "archived"].includes(body.status ?? "")
      ? (body.status as string)
      : "draft";

    const readingTime = isArticleDocument(content)
      ? estimateBlocksReadingTime((content as ArticleDocument).blocks)
      : Math.max(1, Math.ceil(readingHint.split(/\s+/).filter(Boolean).length / 200));

    const client = createSupabaseServiceClient();
    const { data: article, error } = await client
      .from("articles")
      .insert({
        title,
        slug,
        excerpt,
        content,
        featured_image: body.featuredImage?.trim() || null,
        author: body.author?.trim() || "CazaOferta",
        category,
        status,
        seo_title: body.seoTitle?.trim() || null,
        seo_description: body.seoDescription?.trim() || null,
        reading_time: readingTime,
      })
      .select("id, slug, title")
      .single();

    if (error) throw new Error(error.message);

    const productIds = [...new Set((body.productIds ?? []).filter(Boolean))];
    if (productIds.length > 0) {
      const { error: linksError } = await client.from("article_products").insert(
        productIds.map((productId, index) => ({
          article_id: article.id,
          product_id: productId,
          position: index,
        })),
      );
      if (linksError) throw new Error(linksError.message);
    }

    return NextResponse.json({ ok: true, article });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
