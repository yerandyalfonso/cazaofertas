"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { useAdminToast } from "@/components/admin/AdminToast";
import { AdminPageLoadingSkeleton } from "@/components/admin/AdminSkeleton";
import {
  CAROUSEL_FORMATS,
  CAROUSEL_PALETTES,
  CAROUSEL_TEMPLATES,
} from "@/lib/carousel-slides";
import {
  formatProjectDate,
  loadCarouselProjects,
  removeCarouselProject,
  type CarouselProject,
} from "@/lib/carousel-projects";

const iconBtnClass = "admin-icon-btn";

function templateLabel(id: string): string {
  return CAROUSEL_TEMPLATES.find((item) => item.id === id)?.label ?? id;
}

function formatLabel(id: string): string {
  return CAROUSEL_FORMATS.find((item) => item.id === id)?.ratio ?? id;
}

function paletteLabel(id: string): string {
  return CAROUSEL_PALETTES.find((item) => item.id === id)?.label ?? id;
}

export function CarouselListClient() {
  const router = useRouter();
  const toast = useAdminToast();
  const [projects, setProjects] = useState<CarouselProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setProjects(loadCarouselProjects());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onDelete(project: CarouselProject) {
    const ok = window.confirm(`¿Eliminar el carrusel «${project.name}»?`);
    if (!ok) return;

    setDeletingId(project.id);
    try {
      setProjects(removeCarouselProject(project.id));
      toast.success(`Carrusel eliminado: ${project.name}`);
    } catch {
      toast.error("No se pudo eliminar el carrusel.");
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
            Carruseles
          </h1>
          <p className="mt-2 max-w-xl text-sm text-stone-600">
            Crea y gestiona carruseles para Instagram y TikTok. Se guardan en este
            navegador — no modifican artículos ni la base de datos.
          </p>
        </div>
        <Link
          href="/admin/carousels/new"
          className="admin-btn admin-btn-primary"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo carrusel
        </Link>
      </header>

      {loading ? (
        <div className="mt-8">
          <AdminPageLoadingSkeleton variant="table" />
        </div>
      ) : projects.length === 0 ? (
        <AdminEmptyState
          className="mt-10"
          title="Aún no hay carruseles guardados"
          subtitle="Crea carruseles para Instagram y TikTok. Se guardan en este navegador."
          actionLabel="Crear el primero"
          actionHref="/admin/carousels/new"
        />
      ) : (
        <div className="mt-6 overflow-x-auto border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Artículo</th>
              <th className="px-4 py-3 font-semibold">Slides</th>
              <th className="px-4 py-3 font-semibold">Plantilla</th>
              <th className="px-4 py-3 font-semibold">Formato</th>
              <th className="px-4 py-3 font-semibold">Paleta</th>
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
                    <p className="max-w-xs font-medium text-ink">
                      {project.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-stone-400">
                      {project.id}
                    </p>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-stone-600">
                    {project.articleTitle ?? (
                      <span className="text-stone-400">Sin artículo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {project.slides.length}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {templateLabel(project.templateId)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {formatLabel(project.formatId)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {paletteLabel(project.paletteId)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {formatProjectDate(project.updatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Editar carrusel"
                        aria-label="Editar carrusel"
                        onClick={() =>
                          router.push(`/admin/carousels/${project.id}`)
                        }
                        className={iconBtnClass}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Eliminar carrusel"
                        aria-label="Eliminar carrusel"
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
