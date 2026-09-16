"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  EyeOff,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminSearchToolbar,
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

function statusBadgeClass(status: ArticleCommentStatus) {
  switch (status) {
    case "approved":
      return "";
    case "hidden":
      return "admin-badge--muted";
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

function formatShortDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

      <AdminSearchToolbar
        value={query}
        onChange={setQuery}
        placeholder="Buscar autor, email o texto…"
      >
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
      </AdminSearchToolbar>

      <div className="admin-table-wrap mt-4">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <tr>
              <th className="w-[16%] px-4 py-3">Autor</th>
              <th className="w-[22%] px-4 py-3">Artículo</th>
              <th className="px-4 py-3">Comentario</th>
              <th className="w-[7.5rem] px-4 py-3">Estado</th>
              <th className="w-[9rem] px-4 py-3">Fecha</th>
              <th className="w-[7.5rem] px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={10} cols={6} />
            ) : comments.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-[var(--text-muted)]"
                >
                  No hay comentarios con estos filtros.
                </td>
              </tr>
            ) : (
              comments.map((comment) => (
                <tr
                  key={comment.id}
                  className="border-t border-[var(--border)] align-middle hover:bg-[var(--surface-muted)]/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium leading-snug text-[var(--text)]">
                      {comment.authorName}
                    </p>
                    {comment.authorEmail ? (
                      <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                        {comment.authorEmail}
                      </p>
                    ) : null}
                    {comment.notifyOnReply ? (
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                        Aviso activo
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 leading-snug text-[var(--text)]">
                      {comment.article?.title ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 leading-snug text-[var(--text-muted)]">
                      {comment.body}
                    </p>
                    {comment.adminReply ? (
                      <p className="mt-1 line-clamp-1 text-xs text-teal-800">
                        Respuesta: {comment.adminReply}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`admin-badge ${statusBadgeClass(comment.status)}`}
                    >
                      {statusLabel(comment.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-muted)]">
                    {formatShortDate(comment.createdAt)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openComment(comment)}
                        className="admin-icon-btn"
                        title="Responder"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      {comment.status !== "approved" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void patchComment(comment.id, {
                              status: "approved",
                            })
                          }
                          className="admin-icon-btn"
                          title="Aprobar"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      ) : null}
                      {comment.status !== "hidden" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void patchComment(comment.id, { status: "hidden" })
                          }
                          className="admin-icon-btn"
                          title="Ocultar"
                        >
                          <EyeOff className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void onDelete(comment)}
                        className="admin-icon-btn hover:border-rose-600 hover:text-rose-700"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
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
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Comentario
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
                {selected.body}
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                {formatShortDate(selected.createdAt)}
                {selected.authorEmail ? ` · ${selected.authorEmail}` : ""}
              </p>
            </div>

            {selected.article ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Artículo
                </p>
                <p className="mt-2 font-medium text-[var(--text)]">
                  {selected.article.title}
                </p>
                <a
                  href={`/blog/${selected.article.slug}#comentarios`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-btn admin-btn-ghost mt-3"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver en web
                </a>
              </div>
            ) : null}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Respuesta del admin
              </p>
              <textarea
                value={replyDraft}
                onChange={(event) => setReplyDraft(event.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Escribe la respuesta que verá el lector…"
                className="admin-input mt-2 min-h-[8rem] resize-y"
              />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
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
