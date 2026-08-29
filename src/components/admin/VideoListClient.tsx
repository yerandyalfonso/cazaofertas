"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  formatVideoProjectDate,
  loadVideoProjects,
  removeVideoProject,
  type VideoProject,
} from "@/lib/video-projects";

const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-stone-200 bg-white text-stone-600 transition hover:border-ink hover:text-ink disabled:opacity-40";

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

  const load = useCallback(() => {
    setLoading(true);
    setProjects(loadVideoProjects());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
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
          className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper hover:bg-teal-900"
        >
          <Plus className="h-4 w-4" />
          Nuevo vídeo
        </Link>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center justify-center text-stone-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Cargando…
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-10 border border-dashed border-stone-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-stone-600">Aún no hay vídeos guardados.</p>
          <Link
            href="/admin/videos/new"
            className="mt-4 inline-flex text-sm font-medium text-teal-800 underline"
          >
            Crear el primero
          </Link>
        </div>
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
