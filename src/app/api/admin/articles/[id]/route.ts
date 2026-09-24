import { NextRequest, NextResponse } from "next/server";
import {
  estimateBlocksReadingTime,
  isArticleDocument,
  type ArticleDocument,
} from "@/lib/admin-article-editor";
import { requireAdminApi } from "@/lib/admin-auth";
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
        if (block.type === "list") {
          return block.items.join(" ");
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

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const { id } = await context.params;
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("articles")
      .select(
        `
        *,
        article_products (
          position,
          product_id,
          products ( id, title, asin, slug )
        )
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Artículo no encontrado." },
        { status: 404 },
      );
    }

    const links = [...(data.article_products ?? [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    const parsed = parseContent(data.content);

    return NextResponse.json({
      ok: true,
      article: {
        id: data.id,
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt,
        featuredImage: data.featured_image,
        author: data.author,
        category: data.category,
        status: data.status,
        seoTitle: data.seo_title,
        seoDescription: data.seo_description,
        readingTime: data.reading_time,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        template: parsed.template ?? "deep-guide",
        blocks: parsed.body,
        pullQuote: parsed.pullQuote ?? "",
        pros: parsed.pros ?? [],
        cons: parsed.cons ?? [],
        html: parsed.html ?? null,
        productIds: links.map((link) => link.product_id as string),
        products: links
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
            };
          })
          .filter(Boolean),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const { id } = await context.params;
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
    const status = ["draft", "published", "archived"].includes(body.status ?? "")
      ? (body.status as string)
      : "draft";

    const readingTime = isArticleDocument(content)
      ? estimateBlocksReadingTime((content as ArticleDocument).blocks)
      : Math.max(1, Math.ceil(readingHint.split(/\s+/).filter(Boolean).length / 200));

    const client = createSupabaseServiceClient();
    const { data: article, error } = await client
      .from("articles")
      .update({
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, slug, title")
      .single();

    if (error) throw new Error(error.message);

    if (Array.isArray(body.productIds)) {
      const { error: deleteError } = await client
        .from("article_products")
        .delete()
        .eq("article_id", id);
      if (deleteError) throw new Error(deleteError.message);

      const productIds = [...new Set(body.productIds.filter(Boolean))];
      if (productIds.length > 0) {
        const { error: linksError } = await client
          .from("article_products")
          .insert(
            productIds.map((productId, index) => ({
              article_id: id,
              product_id: productId,
              position: index,
            })),
          );
        if (linksError) throw new Error(linksError.message);
      }
    }

    return NextResponse.json({ ok: true, article });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

/** Cambio rápido de estado desde la lista (publicar/archivar) sin reenviar el artículo. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const { id } = await context.params;
    const body = (await request.json()) as { status?: string };
    if (!["draft", "published", "archived"].includes(body.status ?? "")) {
      return NextResponse.json(
        { ok: false, error: "Estado no válido." },
        { status: 400 },
      );
    }
    const client = createSupabaseServiceClient();
    const { data: article, error } = await client
      .from("articles")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, slug, status")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, article });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const { id } = await context.params;
    const client = createSupabaseServiceClient();
    const { error } = await client.from("articles").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
