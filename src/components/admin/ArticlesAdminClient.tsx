"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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

const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-stone-200 bg-white text-stone-600 transition hover:border-ink hover:text-ink disabled:opacity-40";

export function ArticlesAdminClient() {
  const router = useRouter();
  const toast = useAdminToast();
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [associateId, setAssociateId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
      setArticles(data.articles ?? []);
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
        const message = data.error ?? "No se pudo eliminar.";
        setError(message);
        toast.error(message);
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

  const associateArticle = useMemo(
    () => articles.find((item) => item.id === associateId) ?? null,
    [articles, associateId],
  );

  const visibleArticles = useMemo(
    () => sortArticles(articles, sortKey, sortDir),
    [articles, sortKey, sortDir],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "title" || key === "category" ? "asc" : "desc");
  }

  function SortButton({
    column,
    label,
  }: {
    column: SortKey;
    label: string;
  }) {
    const active = sortKey === column;
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-[0.12em] transition hover:text-ink ${
          active ? "text-ink" : "text-stone-500"
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

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            Editorial
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            Artículos
          </h1>
          <p className="mt-2 max-w-xl text-sm text-stone-600">
            Redacta guías y chollos, publícalos y vincúlalos a productos del
            catálogo.
          </p>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo artículo
        </Link>
      </header>

      {message ? (
        <p className="mt-4 border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {associateArticle ? (
        <section className="mt-6 border border-stone-300 bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                Productos vinculados
              </p>
              <h2 className="mt-1 font-display text-xl text-ink">
                {associateArticle.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setAssociateId(null)}
              className="text-sm text-stone-500 hover:text-ink"
            >
              Cerrar
            </button>
          </div>
          {associateArticle.products.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">
              Ningún producto asociado todavía.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {associateArticle.products.map((product) => (
                <li key={product.id} className="py-2 text-sm">
                  <span className="font-medium text-ink">{product.title}</span>
                  <span className="mt-0.5 block font-mono text-xs text-stone-500">
                    {product.asin} · {product.slug}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/admin/articles/${associateArticle.id}`}
            className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-teal-800 hover:underline"
          >
            Editar vínculos en el formulario →
          </Link>
        </section>
      ) : null}

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500">
            <tr>
              <th className="px-4 py-3">
                <SortButton column="title" label="Título" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="updatedAt" label="Fecha" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="status" label="Estado" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="category" label="Categoría" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="products" label="Productos" />
              </th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-stone-500">
                  Cargando…
                </td>
              </tr>
            ) : articles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-stone-500">
                  No hay artículos. Crea el primero o ejecuta el seed del blog.
                </td>
              </tr>
            ) : (
              visibleArticles.map((article) => (
                <tr
                  key={article.id}
                  className="border-t border-stone-100 align-middle"
                >
                  <td className="px-4 py-3">
                    <p className="max-w-sm font-medium text-ink">
                      {article.title}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-stone-500">
                      {article.slug}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {new Date(article.updatedAt).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${
                        article.status === "published"
                          ? "bg-teal-50 text-teal-900"
                          : article.status === "archived"
                            ? "bg-stone-100 text-stone-600"
                            : "bg-amber-50 text-amber-900"
                      }`}
                    >
                      {STATUS_LABEL[article.status] ?? article.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">{article.category}</td>
                  <td className="px-4 py-3 text-stone-600">
                    {article.products.length}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Asociar / ver productos"
                        aria-label="Asociar productos"
                        onClick={() => setAssociateId(article.id)}
                        className={iconBtnClass}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Editar artículo"
                        aria-label="Editar artículo"
                        onClick={() =>
                          router.push(`/admin/articles/${article.id}`)
                        }
                        className={iconBtnClass}
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
                          className={iconBtnClass}
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
                        className={`${iconBtnClass} hover:border-rose-600 hover:text-rose-700`}
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
    </div>
  );
}
