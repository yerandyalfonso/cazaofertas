import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { notifyAdminNewComment } from "@/services/commentNotify";

export const runtime = "nodejs";

function mapPublicComment(row: {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
  admin_reply: string | null;
  admin_replied_at: string | null;
}) {
  return {
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    adminReply: row.admin_reply,
    adminRepliedAt: row.admin_replied_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const articleId = request.nextUrl.searchParams.get("articleId")?.trim();
    if (!articleId) {
      return NextResponse.json(
        { ok: false, error: "Falta articleId." },
        { status: 400 },
      );
    }

    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("article_comments")
      .select(
        "id, author_name, body, created_at, admin_reply, admin_replied_at",
      )
      .eq("article_id", articleId)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      comments: (data ?? []).map(mapPublicComment),
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
      articleId?: string;
      articleSlug?: string;
      authorName?: string;
      authorEmail?: string;
      body?: string;
      notifyOnReply?: boolean;
      website?: string;
    };

    if (body.website?.trim()) {
      return NextResponse.json({ ok: true, message: "Gracias." });
    }

    const articleId = body.articleId?.trim();
    const authorName = body.authorName?.trim();
    const commentBody = body.body?.trim();
    const authorEmail = body.authorEmail?.trim() || null;

    if (!articleId || !authorName || !commentBody) {
      return NextResponse.json(
        { ok: false, error: "Nombre y comentario son obligatorios." },
        { status: 400 },
      );
    }

    if (authorName.length > 80 || commentBody.length > 2000) {
      return NextResponse.json(
        { ok: false, error: "Comentario demasiado largo." },
        { status: 400 },
      );
    }

    if (authorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authorEmail)) {
      return NextResponse.json(
        { ok: false, error: "Email no válido." },
        { status: 400 },
      );
    }

    const client = createSupabaseServiceClient();

    const { data: article, error: articleError } = await client
      .from("articles")
      .select("id, title, slug, status")
      .eq("id", articleId)
      .maybeSingle();

    if (articleError) throw new Error(articleError.message);
    if (!article || article.status !== "published") {
      return NextResponse.json(
        { ok: false, error: "Artículo no disponible para comentarios." },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();
    const { data: inserted, error: insertError } = await client
      .from("article_comments")
      .insert({
        article_id: articleId,
        author_name: authorName,
        author_email: authorEmail,
        body: commentBody,
        status: "pending",
        notify_on_reply: Boolean(body.notifyOnReply && authorEmail),
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);

    void notifyAdminNewComment({
      authorName,
      articleTitle: article.title,
      articleSlug: article.slug,
      excerpt: commentBody,
      commentId: inserted.id,
    });

    return NextResponse.json({
      ok: true,
      message:
        "Comentario recibido. Lo revisaremos y lo publicaremos en breve.",
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
