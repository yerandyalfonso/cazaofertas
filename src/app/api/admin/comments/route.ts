import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { notifyReaderCommentReply } from "@/services/commentNotify";
import type { ArticleCommentStatus } from "@/types/article-comments";

export const runtime = "nodejs";

function mapComment(row: Record<string, unknown>) {
  const articleRaw = row.articles;
  const article = Array.isArray(articleRaw) ? articleRaw[0] : articleRaw;
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    authorName: String(row.author_name),
    authorEmail: row.author_email ? String(row.author_email) : null,
    body: String(row.body),
    adminReply: row.admin_reply ? String(row.admin_reply) : null,
    adminRepliedAt: row.admin_replied_at ? String(row.admin_replied_at) : null,
    status: String(row.status) as ArticleCommentStatus,
    notifyOnReply: Boolean(row.notify_on_reply),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    article: article
      ? {
          id: String((article as { id: string }).id),
          title: String((article as { title: string }).title),
          slug: String((article as { slug: string }).slug),
        }
      : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const status = request.nextUrl.searchParams.get("status")?.trim();
    const articleId = request.nextUrl.searchParams.get("articleId")?.trim();
    const q = request.nextUrl.searchParams.get("q")?.trim();

    const client = createSupabaseServiceClient();
    let query = client
      .from("article_comments")
      .select(
        "id, article_id, author_name, author_email, body, admin_reply, admin_replied_at, status, notify_on_reply, created_at, updated_at, articles(id, title, slug)",
      )
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }
    if (articleId) {
      query = query.eq("article_id", articleId);
    }
    if (q) {
      query = query.or(
        `author_name.ilike.%${q}%,body.ilike.%${q}%,author_email.ilike.%${q}%`,
      );
    }

    const { data, error } = await query.limit(300);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      comments: (data ?? []).map((row) => mapComment(row as Record<string, unknown>)),
    });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const body = (await request.json()) as {
      id?: string;
      status?: ArticleCommentStatus;
      adminReply?: string;
    };

    const id = body.id?.trim();
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Falta id del comentario." },
        { status: 400 },
      );
    }

    const client = createSupabaseServiceClient();
    const { data: existing, error: readError } = await client
      .from("article_comments")
      .select(
        "id, author_name, author_email, notify_on_reply, articles(title, slug)",
      )
      .eq("id", id)
      .maybeSingle();

    if (readError) throw new Error(readError.message);
    if (!existing) {
      return NextResponse.json(
        { ok: false, error: "Comentario no encontrado." },
        { status: 404 },
      );
    }

    const patch: {
      updated_at: string;
      status?: ArticleCommentStatus;
      admin_reply?: string | null;
      admin_replied_at?: string | null;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (
      body.status === "pending" ||
      body.status === "approved" ||
      body.status === "hidden"
    ) {
      patch.status = body.status;
    }

    if (typeof body.adminReply === "string") {
      const reply = body.adminReply.trim();
      patch.admin_reply = reply || null;
      patch.admin_replied_at = reply ? new Date().toISOString() : null;
      if (reply && body.status !== "hidden") {
        patch.status = "approved";
      }
    }

    const { data, error } = await client
      .from("article_comments")
      .update(patch)
      .eq("id", id)
      .select(
        "id, article_id, author_name, author_email, body, admin_reply, admin_replied_at, status, notify_on_reply, created_at, updated_at, articles(id, title, slug)",
      )
      .single();

    if (error) throw new Error(error.message);

    const articleRaw = existing.articles;
    const article = Array.isArray(articleRaw) ? articleRaw[0] : articleRaw;
    const replyText =
      typeof body.adminReply === "string" ? body.adminReply.trim() : "";
    if (
      replyText &&
      existing.notify_on_reply &&
      existing.author_email &&
      article
    ) {
      void notifyReaderCommentReply({
        email: existing.author_email,
        authorName: existing.author_name,
        articleTitle: String(article.title),
        articleSlug: String(article.slug),
        reply: replyText,
      });
    }

    return NextResponse.json({
      ok: true,
      comment: mapComment(data as Record<string, unknown>),
    });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      ids?: string[];
    };

    const ids = (body.ids ?? []).filter(Boolean);
    const id = body.id?.trim();

    const client = createSupabaseServiceClient();
    if (ids.length > 0) {
      const { error } = await client
        .from("article_comments")
        .delete()
        .in("id", ids);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Indica id del comentario." },
        { status: 400 },
      );
    }

    const { error } = await client.from("article_comments").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
