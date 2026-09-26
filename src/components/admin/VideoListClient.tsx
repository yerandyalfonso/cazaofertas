"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminPageLoadingSkeleton } from "@/components/admin/AdminSkeleton";
import {
  formatVideoProjectDate,
  loadVideoProjects,
  removeVideoProject,
  syncVideoProjects,
  type VideoProject,
} from "@/lib/video-projects";

const iconBtnClass = "admin-icon-btn";

const TRANSITION_LABEL: Record<string, string> = {
  fade: "Fade",
  slide: "Slide",
  "slide-up": "Slide ↑",
  zoom: "Zoom",
  wipe: "Wipe",
  none: "Ninguna",
};

export function VideoListClient() {
  const router = useRouter();
  const toast = useAdminToast();
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await syncVideoProjects();
    setProjects(loadVideoProjects());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onDelete(project: VideoProject) {
    const ok = window.confirm(`¿Eliminar el vídeo «${project.name}»?`);
    if (!ok) return;
    setDeletingId(project.id);
    try {
      setProjects(removeVideoProject(project.id));
      toast.success("Vídeo eliminado.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <h2 className="font-display text-2xl text-ink">Videos guardados</h2>
          <p className="mt-1 text-sm text-stone-600">
            Configuraciones de timeline (productos o tarjetas) con estilo y
            transiciones. Se guardan en este navegador.
          </p>
        </div>
        <Link
          href="/admin/videos/new"
          className="admin-btn admin-btn-primary"
        >
          <Plus className="h-4 w-4" />
          Nuevo vídeo
        </Link>
      </div>

      {loading ? (
        <div className="mt-8">
          <AdminPageLoadingSkeleton variant="table" />
        </div>
      ) : projects.length === 0 ? (
        <AdminEmptyState
          className="mt-10"
          title="Aún no hay vídeos guardados"
          subtitle="Crea timelines con productos o tarjetas para redes."
          actionLabel="Crear el primero"
          actionHref="/admin/videos/new"
        />
      ) : (
        <div className="mt-6 overflow-x-auto border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-[0.08em] text-stone-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Fuente</th>
                <th className="px-4 py-3">Slides</th>
                <th className="px-4 py-3">Formato</th>
                <th className="px-4 py-3">Transición</th>
                <th className="px-4 py-3">Actualizado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const slides =
                  project.sourceMode === "cards"
                    ? project.cardProjectIds.length
                    : project.productIds.length;
                return (
                  <tr
                    key={project.id}
                    className="border-t border-stone-100 hover:bg-stone-50/80"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {project.name}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {project.sourceMode === "cards"
                        ? "Tarjetas"
                        : "Productos"}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{slides}</td>
                    <td className="px-4 py-3 text-stone-600">
                      {project.cardStyle.formatId}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {TRANSITION_LABEL[project.transition] ??
                        project.transition}
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {formatVideoProjectDate(project.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={iconBtnClass}
                          onClick={() =>
                            router.push(`/admin/videos/${project.id}`)
                          }
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className={iconBtnClass}
                          disabled={deletingId === project.id}
                          onClick={() => onDelete(project)}
                          aria-label="Eliminar"
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
