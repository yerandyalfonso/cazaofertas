"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminPageLoadingSkeleton } from "@/components/admin/AdminSkeleton";
import {
  formatSocialProjectDate,
  loadSocialCardProjects,
  removeSocialCardProject,
  type SocialCardProject,
} from "@/lib/social-card-projects";

const iconBtnClass = "admin-icon-btn";

const FORMAT_LABEL: Record<string, string> = {
  square: "1:1",
  story: "9:16",
  landscape: "16:9",
  classic: "4:3",
};

const LAYOUT_LABEL: Record<string, string> = {
  minimal: "Minimal",
  float: "Flotante",
  banner: "Banner",
  seal: "Sello",
  split: "Flotante",
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
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h2 className="font-display text-2xl text-ink">Tarjetas guardadas</h2>
          <p className="mt-1 max-w-xl text-sm text-stone-600">
            Diseños para Instagram, Telegram y más. Se guardan en este navegador.
          </p>
        </div>
        <Link
          href="/admin/social/new"
          className="admin-btn admin-btn-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva tarjeta
        </Link>
      </div>

      {loading ? (
        <div className="mt-8">
          <AdminPageLoadingSkeleton variant="table" />
        </div>
      ) : projects.length === 0 ? (
        <AdminEmptyState
          className="mt-10"
          title="Aún no hay tarjetas guardadas"
          subtitle="Diseños para Instagram, Telegram y más. Se guardan en este navegador."
          actionLabel="Crear la primera"
          actionHref="/admin/social/new"
        />
      ) : (
        <div className="mt-6 overflow-x-auto border border-stone-200 bg-white">
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
            {projects.map((project) => (
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
              ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
