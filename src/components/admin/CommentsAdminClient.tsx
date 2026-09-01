"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  EyeOff,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminSearchField,
} from "@/components/admin/AdminListChrome";
import { AdminSidePanel } from "@/components/admin/AdminSidePanel";
import { AdminTableSkeleton } from "@/components/admin/AdminSkeleton";
import { useAdminToast } from "@/components/admin/AdminToast";
import type { ArticleCommentStatus } from "@/types/article-comments";

interface AdminComment {
  id: string;
  articleId: string;
  authorName: string;
  authorEmail: string | null;
  body: string;
  adminReply: string | null;
  adminRepliedAt: string | null;
  status: ArticleCommentStatus;
  notifyOnReply: boolean;
  createdAt: string;
  updatedAt: string;
  article: { id: string; title: string; slug: string } | null;
}

type StatusFilter = "all" | ArticleCommentStatus;

function statusBadge(status: ArticleCommentStatus) {
  switch (status) {
    case "approved":
      return "border-teal-200 bg-teal-50 text-teal-900";
    case "hidden":
      return "border-stone-300 bg-stone-100 text-stone-600";
    default:
      return "border-amber-200 bg-amber-50 text-amber-900";
  }
}

function statusLabel(status: ArticleCommentStatus) {
  switch (status) {
    case "approved":
      return "Publicado";
    case "hidden":
      return "Oculto";
    default:
      return "Pendiente";
  }
}

export default function CommentsAdminClient() {
  const toast = useAdminToast();
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<AdminComment | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/admin/comments?${params}`);
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        comments?: AdminComment[];
      };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudieron cargar comentarios.");
      }
      setComments(data.comments ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar comentarios.",
      );
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => comments.filter((comment) => comment.status === "pending").length,
    [comments],
  );

  function openComment(comment: AdminComment) {
    setSelected(comment);
    setReplyDraft(comment.adminReply ?? "");
  }

  async function patchComment(
    id: string,
    patch: { status?: ArticleCommentStatus; adminReply?: string },
  ) {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        comment?: AdminComment;
      };
      if (!response.ok || !data.ok || !data.comment) {
        throw new Error(data.error ?? "No se pudo actualizar.");
      }
      setComments((prev) =>
        prev.map((item) => (item.id === id ? data.comment! : item)),
      );
      setSelected(data.comment);
      toast.success("Comentario actualizado.");
      return data.comment;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(comment: AdminComment) {
    const ok = window.confirm("¿Eliminar este comentario?");
    if (!ok) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/comments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "No se pudo eliminar.");
      }
      setComments((prev) => prev.filter((item) => item.id !== comment.id));
      if (selected?.id === comment.id) setSelected(null);
      toast.success("Comentario eliminado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al eliminar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col md:min-h-[calc(100dvh-5rem)]">
      <AdminPageHeader
        eyebrow="Comunidad"
        title="Comentarios"
        description={
          loading
            ? "Cargando comentarios…"
            : `${comments.length} en listado${
                pendingCount > 0 ? ` · ${pendingCount} pendientes` : ""
              }`
        }
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="admin-btn admin-btn-ghost"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden
            />
            Recargar
          </button>
        }
      />

      <div className="admin-toolbar">
        <AdminSearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar autor, email o texto…"
        />
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StatusFilter)
          }
          className="admin-select w-auto min-w-[160px]"
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Publicados</option>
          <option value="hidden">Ocultos</option>
        </select>
      </div>

      <div className="admin-table-wrap admin-table-wrap--fill mt-4 min-h-0 flex-1">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500">
            <tr>
              <th className="px-4 py-3">Autor</th>
              <th className="px-4 py-3">Artículo</th>
              <th className="px-4 py-3">Comentario</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={10} cols={6} />
            ) : comments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-stone-500">
                  No hay comentarios con estos filtros.
                </td>
              </tr>
            ) : (
              comments.map((comment) => (
                <tr
                  key={comment.id}
                  className="border-t border-stone-100 align-top hover:bg-stone-50/80"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{comment.authorName}</p>
                    {comment.authorEmail ? (
                      <p className="mt-1 text-xs text-stone-500">
                        {comment.authorEmail}
                        {comment.notifyOnReply ? " · aviso activo" : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 text-stone-700">
                      {comment.article?.title ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-3 text-stone-700">{comment.body}</p>
                    {comment.adminReply ? (
                      <p className="mt-2 line-clamp-2 text-xs text-teal-800">
                        Respuesta: {comment.adminReply}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-sm border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${statusBadge(comment.status)}`}
                    >
                      {statusLabel(comment.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-stone-500">
                    {new Date(comment.createdAt).toLocaleString("es-ES")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => openComment(comment)}
                        className="admin-btn admin-btn-ghost h-8 px-2 text-[10px]"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Responder
                      </button>
                      {comment.status !== "approved" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void patchComment(comment.id, { status: "approved" })
                          }
                          className="admin-btn admin-btn-ghost h-8 px-2 text-[10px]"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Aprobar
                        </button>
                      ) : null}
                      {comment.status !== "hidden" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void patchComment(comment.id, { status: "hidden" })
                          }
                          className="admin-btn admin-btn-ghost h-8 px-2 text-[10px]"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          Ocultar
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void onDelete(comment)}
                        className="admin-btn admin-btn-ghost h-8 px-2 text-[10px] hover:border-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminSidePanel
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        eyebrow="Moderación"
        title={selected?.authorName ?? "Comentario"}
        size="lg"
        footer={
          selected ? (
            <>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="admin-btn admin-btn-ghost"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void patchComment(selected.id, {
                    adminReply: replyDraft,
                    status: "approved",
                  })
                }
                className="admin-btn admin-btn-primary"
              >
                {saving ? "Guardando…" : "Publicar respuesta"}
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="admin-detail-section">
              <h3>Comentario</h3>
              <p className="text-sm leading-relaxed text-stone-700">
                {selected.body}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {new Date(selected.createdAt).toLocaleString("es-ES")}
                {selected.authorEmail ? ` · ${selected.authorEmail}` : ""}
              </p>
            </div>

            {selected.article ? (
              <div className="admin-detail-section">
                <h3>Artículo</h3>
                <p className="font-medium text-ink">{selected.article.title}</p>
                <a
                  href={`/blog/${selected.article.slug}#comentarios`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn admin-btn-ghost mt-3 h-9 px-3 text-[10px]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver en web
                </a>
              </div>
            ) : null}

            <div className="admin-detail-section">
              <h3>Respuesta del admin</h3>
              <textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Escribe la respuesta que verá el lector…"
                className="mt-2 w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-ink"
              />
              <p className="mt-2 text-xs text-stone-500">
                Al publicar, el comentario queda aprobado y la respuesta aparece
                en el artículo.
                {selected.notifyOnReply && selected.authorEmail
                  ? " Se registrará aviso por email al lector."
                  : ""}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void patchComment(selected.id, { status: "approved" })
                }
                className="admin-btn admin-btn-ghost"
              >
                Solo aprobar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void patchComment(selected.id, { status: "hidden" })
                }
                className="admin-btn admin-btn-ghost"
              >
                Ocultar
              </button>
            </div>
          </div>
        ) : null}
      </AdminSidePanel>
    </div>
  );
}
