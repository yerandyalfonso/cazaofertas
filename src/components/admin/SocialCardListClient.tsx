"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  formatSocialProjectDate,
  loadSocialCardProjects,
  removeSocialCardProject,
  type SocialCardProject,
} from "@/lib/social-card-projects";

const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-stone-200 bg-white text-stone-600 transition hover:border-ink hover:text-ink disabled:opacity-40";

const FORMAT_LABEL: Record<string, string> = {
  square: "1:1",
  story: "9:16",
  landscape: "16:9",
  classic: "4:3",
};

const LAYOUT_LABEL: Record<string, string> = {
  minimal: "Minimal",
  split: "Split",
  banner: "Banner",
  seal: "Sello",
};

export function SocialCardListClient() {
  const router = useRouter();
  const toast = useAdminToast();
  const [projects, setProjects] = useState<SocialCardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setProjects(loadSocialCardProjects());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onDelete(project: SocialCardProject) {
    const ok = window.confirm(`¿Eliminar la tarjeta «${project.name}»?`);
    if (!ok) return;

    setDeletingId(project.id);
    try {
      setProjects(removeSocialCardProject(project.id));
      toast.success(`Tarjeta eliminada: ${project.name}`);
    } catch {
      toast.error("No se pudo eliminar la tarjeta.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            Redes sociales
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            Tarjetas de oferta
          </h1>
          <p className="mt-2 max-w-xl text-sm text-stone-600">
            Crea y gestiona diseños de tarjetas para Instagram, Telegram y más.
            Se guardan en este navegador.
          </p>
        </div>
        <Link
          href="/admin/social/new"
          className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva tarjeta
        </Link>
      </header>

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Layout</th>
              <th className="px-4 py-3 font-semibold">Formato</th>
              <th className="px-4 py-3 font-semibold">Actualizado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-stone-500">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Cargando…
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-stone-500">
                  No hay tarjetas guardadas.{" "}
                  <Link
                    href="/admin/social/new"
                    className="font-medium text-teal-800 hover:underline"
                  >
                    Crea la primera
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-t border-stone-100 align-middle"
                >
                  <td className="px-4 py-3">
                    <p className="max-w-xs font-medium text-ink">{project.name}</p>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-stone-600">
                    {project.productTitle ?? (
                      <span className="text-stone-400">Sin producto</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {LAYOUT_LABEL[project.layoutId] ?? project.layoutId}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {FORMAT_LABEL[project.formatId] ?? project.formatId}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {formatSocialProjectDate(project.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Editar tarjeta"
                        aria-label="Editar tarjeta"
                        onClick={() => router.push(`/admin/social/${project.id}`)}
                        className={iconBtnClass}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Eliminar tarjeta"
                        aria-label="Eliminar tarjeta"
                        disabled={deletingId === project.id}
                        onClick={() => onDelete(project)}
                        className={iconBtnClass}
                      >
                        {deletingId === project.id ? (
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
