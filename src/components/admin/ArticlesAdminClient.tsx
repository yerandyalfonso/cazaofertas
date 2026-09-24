"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Eye,
  Loader2,
  Package,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  AdminPageHeader,
  AdminSearchField,
} from "@/components/admin/AdminListChrome";
import { AdminTableSkeleton } from "@/components/admin/AdminSkeleton";
import { useAdminToast } from "@/components/admin/AdminToast";

interface LinkedProduct {
  id: string;
  title: string;
  asin: string;
  slug: string;
  position?: number;
}

interface AdminArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  status: string;
  featuredImage: string | null;
  author: string;
  readingTime: number;
  createdAt: string;
  updatedAt: string;
  products: LinkedProduct[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  archived: "Archivado",
};

type SortKey = "title" | "updatedAt" | "status" | "category" | "products";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "draft" | "published" | "archived";

function sortArticles(
  items: AdminArticle[],
  key: SortKey,
  dir: SortDir,
): AdminArticle[] {
  const sorted = [...items].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    switch (key) {
      case "title":
        av = a.title.toLocaleLowerCase("es");
        bv = b.title.toLocaleLowerCase("es");
        break;
      case "updatedAt":
        av = new Date(a.updatedAt).getTime();
        bv = new Date(b.updatedAt).getTime();
        break;
      case "status":
        av = a.status;
        bv = b.status;
        break;
      case "category":
        av = a.category.toLocaleLowerCase("es");
        bv = b.category.toLocaleLowerCase("es");
        break;
      case "products":
        av = a.products.length;
        bv = b.products.length;
        break;
    }
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  return dir === "asc" ? sorted : sorted.reverse();
}

function SortButton({
  column,
  label,
  sortKey,
  sortDir,
  onToggle,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onToggle: (key: SortKey) => void;
}) {
  const active = sortKey === column;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-[0.12em] transition hover:text-[var(--text)] ${
        active ? "text-[var(--text)]" : "text-[var(--text-muted)]"
      }`}
    >
      {label}
      {active ? (
        sortDir === "asc" ? (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
      )}
    </button>
  );
}

export function ArticlesAdminClient({
  initialStatus = "all",
}: {
  initialStatus?: StatusFilter;
} = {}) {
  const router = useRouter();
  const toast = useAdminToast();
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [associateId, setAssociateId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/articles");
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        articles?: AdminArticle[];
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "No se pudieron cargar artículos.");
        toast.error(data.error ?? "No se pudieron cargar artículos.");
        return;
      }
      const next = data.articles ?? [];
      setArticles(next);
      setSelectedIds((prev) => {
        const valid = new Set(next.map((a) => a.id));
        const kept = new Set<string>();
        for (const id of prev) {
          if (valid.has(id)) kept.add(id);
        }
        return kept;
      });
    } catch {
      setError("Error de red al cargar artículos.");
      toast.error("Error de red al cargar artículos.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const article of articles) {
      if (article.category.trim()) set.add(article.category.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [articles]);

  const visibleArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = articles.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (categoryFilter && a.category !== categoryFilter) return false;
      if (!q) return true;
      return [a.title, a.slug, a.category, a.status, a.excerpt, a.author]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    return sortArticles(filtered, sortKey, sortDir);
  }, [articles, sortKey, sortDir, query, statusFilter, categoryFilter]);

  const hasActiveFilters =
    query.trim() !== "" || statusFilter !== "all" || categoryFilter !== "";

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setCategoryFilter("");
  }

  const sortProps = { sortKey, sortDir, onToggle: toggleSort };

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "title" || key === "category" ? "asc" : "desc");
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const ids = visibleArticles.map((a) => a.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  async function onPublish(article: AdminArticle) {
    setPublishingId(article.id);
    try {
      const res = await fetch(`/api/admin/articles/${article.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "No se pudo publicar.");
        return;
      }
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, status: "published" } : a)),
      );
      setMessage(`Publicado: ${article.title}`);
    } catch {
      toast.error("Error de red al publicar.");
    } finally {
      setPublishingId(null);
    }
  }

  async function onDelete(article: AdminArticle) {
    const ok = window.confirm(
      `¿Eliminar «${article.title}»? Se borrarán también los vínculos con productos.`,
    );
    if (!ok) return;

    setDeletingId(article.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/articles/${article.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        const msg = data.error ?? "No se pudo eliminar.";
        setError(msg);
        toast.error(msg);
        return;
      }
      setMessage(`Eliminado: ${article.slug}`);
      toast.success(`Artículo eliminado: ${article.slug}`);
      await load();
    } catch {
      setError("Error de red al eliminar.");
      toast.error("Error de red al eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  async function onBatchDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = window.confirm(
      `¿Eliminar ${ids.length} artículo${ids.length === 1 ? "" : "s"}?`,
    );
    if (!ok) return;

    setBatchDeleting(true);
    setError(null);
    setMessage(null);
    let deleted = 0;
    const failures: string[] = [];
    try {
      for (const id of ids) {
        const response = await fetch(`/api/admin/articles/${id}`, {
          method: "DELETE",
        });
        const data = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !data.ok) {
          failures.push(data.error ?? id);
          continue;
        }
        deleted += 1;
      }
      if (deleted > 0) {
        setMessage(`Eliminados: ${deleted}`);
        toast.success(`Eliminados ${deleted} artículos`);
      }
      if (failures.length > 0) {
        const msg = `Fallaron ${failures.length} eliminaciones`;
        setError(msg);
        toast.error(msg);
      }
      setSelectedIds(new Set());
      await load();
    } catch {
      setError("Error de red al eliminar en lote.");
      toast.error("Error de red al eliminar en lote.");
    } finally {
      setBatchDeleting(false);
    }
  }

  const associateArticle = useMemo(
    () => articles.find((item) => item.id === associateId) ?? null,
    [articles, associateId],
  );

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col md:min-h-[calc(100dvh-5rem)]">
      <AdminPageHeader
        eyebrow="Editorial"
        title="Artículos"
        description={
          loading
            ? "Cargando artículos…"
            : `${visibleArticles.length} de ${articles.length} artículos`
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="admin-btn admin-btn-ghost"
            >
              Recargar
            </button>
            <Link
              href="/admin/articles/new"
              className="admin-btn admin-btn-primary"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo artículo
            </Link>
          </>
        }
      />

      <div className="admin-toolbar">
        <AdminSearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar por título, slug, categoría…"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="admin-select"
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="archived">Archivado</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="admin-select"
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="admin-btn admin-btn-ghost"
          >
            Limpiar filtros
          </button>
        ) : null}
        {selectedIds.size > 0 ? (
          <button
            type="button"
            disabled={batchDeleting}
            onClick={() => void onBatchDelete()}
            className="admin-btn admin-btn-danger"
          >
            {batchDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Eliminar ({selectedIds.size})
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {associateArticle ? (
        <section className="admin-card mt-6 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Productos vinculados
              </p>
              <h2 className="mt-1 text-xl font-bold text-[var(--text)]">
                {associateArticle.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAssociateId(null)}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              Cerrar
            </button>
          </div>
          {associateArticle.products.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Ningún producto asociado todavía.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {associateArticle.products.map((product) => (
                <li key={product.id} className="py-2 text-sm">
                  <span className="font-medium text-[var(--text)]">
                    {product.title}
                  </span>
                  <span className="mt-0.5 block font-mono text-xs text-[var(--text-muted)]">
                    {product.asin} · {product.slug}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/admin/articles/${associateArticle.id}`}
            className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-[var(--primary)] hover:underline"
          >
            Editar vínculos en el formulario →
          </Link>
        </section>
      ) : null}

      {!loading && articles.length === 0 ? (
        <AdminEmptyState
          className="mt-6"
          title="Aún no hay artículos"
          subtitle="Publica la primera entrada del blog con productos vinculados."
          actionLabel="Crear el primero"
          actionHref="/admin/articles/new"
        />
      ) : (
      <div className="admin-table-wrap admin-table-wrap--fill mt-6">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-muted)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={
                    visibleArticles.length > 0 &&
                    visibleArticles.every((a) => selectedIds.has(a.id))
                  }
                  onChange={toggleSelectAllVisible}
                  disabled={loading || visibleArticles.length === 0}
                  aria-label="Seleccionar todos los artículos visibles"
                  className="h-4 w-4 accent-[var(--primary)]"
                />
              </th>
              <th className="px-4 py-3">
                <SortButton {...sortProps} column="title" label="Título" />
              </th>
              <th className="px-4 py-3">
                <SortButton {...sortProps} column="updatedAt" label="Fecha" />
              </th>
              <th className="px-4 py-3">
                <SortButton {...sortProps} column="status" label="Estado" />
              </th>
              <th className="px-4 py-3">
                <SortButton {...sortProps} column="category" label="Categoría" />
              </th>
              <th className="px-4 py-3">
                <SortButton {...sortProps} column="products" label="Productos" />
              </th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={14} cols={7} />
            ) : articles.length === 0 ? null : visibleArticles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-[var(--text-muted)]">
                  Ningún artículo coincide con los filtros.{" "}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-medium text-[var(--primary)] underline"
                  >
                    Limpiar filtros
                  </button>
                </td>
              </tr>
            ) : (
              visibleArticles.map((article) => (
                <tr
                  key={article.id}
                  className="border-t border-[var(--border)] align-middle"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(article.id)}
                      onChange={() => toggleOne(article.id)}
                      aria-label={`Seleccionar ${article.title}`}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-sm font-medium text-[var(--text)]">
                      {article.title}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                      {article.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {new Date(article.updatedAt).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`admin-badge ${
                        article.status === "published"
                          ? ""
                          : "admin-badge--muted"
                      }`}
                    >
                      {STATUS_LABEL[article.status] ?? article.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {article.category}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {article.products.length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {article.status === "draft" ? (
                        <button
                          type="button"
                          title="Publicar ahora"
                          aria-label="Publicar ahora"
                          disabled={publishingId === article.id}
                          onClick={() => void onPublish(article)}
                          className="admin-btn admin-btn-primary inline-flex h-8 items-center gap-1 px-2.5 text-xs"
                        >
                          {publishingId === article.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Publicar
                        </button>
                      ) : null}
                      <Link
                        href={`/admin/articles/${article.id}/preview`}
                        title="Vista previa"
                        aria-label="Vista previa"
                        className="admin-icon-btn"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        title="Productos del artículo"
                        aria-label="Productos del artículo"
                        onClick={() => setAssociateId(article.id)}
                        className="admin-icon-btn"
                      >
                        <Package className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Editar artículo"
                        aria-label="Editar artículo"
                        onClick={() =>
                          router.push(`/admin/articles/${article.id}`)
                        }
                        className="admin-icon-btn"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {article.status === "published" ? (
                        <a
                          href={`/blog/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver en el blog"
                          aria-label="Ver en el blog"
                          className="admin-icon-btn"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        title="Eliminar"
                        aria-label="Eliminar"
                        disabled={deletingId === article.id}
                        onClick={() => void onDelete(article)}
                        className="admin-icon-btn hover:border-rose-600 hover:text-rose-700"
                      >
                        {deletingId === article.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
