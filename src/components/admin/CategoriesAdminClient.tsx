"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";

interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  productCount: number;
}

const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-stone-200 bg-white text-stone-600 transition hover:border-ink hover:text-ink disabled:opacity-40";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  image_url: "",
};

export function CategoriesAdminClient() {
  const toast = useAdminToast();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/categories?all=1");
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        categories?: AdminCategory[];
      };
      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "No se pudieron cargar categorías.");
        return;
      }
      setCategories(data.categories ?? []);
    } catch {
      toast.error("Error de red al cargar categorías.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(category: AdminCategory) {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      image_url: category.image_url ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const response = await fetch(`/api/admin/categories/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            slug: form.slug.trim() || undefined,
            description: form.description.trim() || null,
            image_url: form.image_url.trim() || null,
          }),
        });
        const data = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !data.ok) {
          toast.error(data.error ?? "No se pudo actualizar.");
          return;
        }
        toast.success("Categoría actualizada.");
      } else {
        const response = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            slug: form.slug.trim() || undefined,
            description: form.description.trim() || undefined,
            image_url: form.image_url.trim() || undefined,
          }),
        });
        const data = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !data.ok) {
          toast.error(data.error ?? "No se pudo crear.");
          return;
        }
        toast.success("Categoría creada.");
      }
      closeForm();
      await load();
    } catch {
      toast.error("Error de red al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(category: AdminCategory) {
    const message =
      category.productCount > 0
        ? `«${category.name}» tiene ${category.productCount} productos. Se desactivará (no se borrará). ¿Continuar?`
        : `¿Eliminar la categoría «${category.name}»?`;
    if (!window.confirm(message)) return;

    setDeletingId(category.id);
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        softDeleted?: boolean;
      };
      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success(
        data.softDeleted
          ? `Categoría desactivada: ${category.name}`
          : `Categoría eliminada: ${category.name}`,
      );
      await load();
    } catch {
      toast.error("Error de red al eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  async function onReactivate(category: AdminCategory) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "No se pudo reactivar.");
        return;
      }
      toast.success(`Categoría reactivada: ${category.name}`);
      await load();
    } catch {
      toast.error("Error de red.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            Catálogo
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            Categorías
          </h1>
          <p className="mt-2 max-w-xl text-sm text-stone-600">
            Gestiona las secciones del sitio y la auto-categorización de productos.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva categoría
        </button>
      </header>

      {showForm ? (
        <section className="mt-6 border border-stone-300 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-xl text-ink">
              {editingId ? "Editar categoría" : "Nueva categoría"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className={iconBtnClass}
              aria-label="Cerrar formulario"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <form
            onSubmit={(event) => void onSave(event)}
            className="mt-4 grid gap-4 md:grid-cols-2"
          >
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Nombre
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Slug (opcional)
              <input
                value={form.slug}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, slug: event.target.value }))
                }
                placeholder="se-genera-del-nombre"
                className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Descripción
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={2}
                className="mt-2 w-full border border-stone-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              URL imagen (opcional)
              <input
                value={form.image_url}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, image_url: event.target.value }))
                }
                placeholder="https://..."
                className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
              />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper disabled:opacity-50"
              >
                {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-11 items-center border border-stone-300 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Productos</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-stone-500">
                  Cargando…
                </td>
              </tr>
            ) : categories.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-stone-500">
                  No hay categorías.
                </td>
              </tr>
            ) : (
              categories.map((category) => (
                <tr
                  key={category.id}
                  className={`border-t border-stone-100 align-middle ${
                    !category.is_active ? "bg-stone-50/80" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {category.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {category.productCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] ${
                        category.is_active
                          ? "bg-teal-50 text-teal-900"
                          : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {category.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Editar"
                        aria-label="Editar categoría"
                        onClick={() => openEdit(category)}
                        className={iconBtnClass}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!category.is_active ? (
                        <button
                          type="button"
                          onClick={() => void onReactivate(category)}
                          disabled={saving}
                          className="inline-flex h-8 items-center rounded-sm border border-teal-800 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-900"
                        >
                          Activar
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Eliminar o desactivar"
                          aria-label="Eliminar categoría"
                          disabled={deletingId === category.id}
                          onClick={() => void onDelete(category)}
                          className={`${iconBtnClass} hover:border-rose-600 hover:text-rose-700`}
                        >
                          {deletingId === category.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
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
