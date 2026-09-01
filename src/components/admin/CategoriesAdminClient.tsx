"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  AdminPageHeader,
  AdminSearchToolbar,
  AdminSortButton,
} from "@/components/admin/AdminListChrome";
import { AdminTableSkeleton } from "@/components/admin/AdminSkeleton";
import { AdminSidePanel } from "@/components/admin/AdminSidePanel";
import { useAdminToast } from "@/components/admin/AdminToast";

interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  parent_id: string | null;
  show_in_blog: boolean;
  created_at: string;
  productCount: number;
}

type SortKey = "name" | "slug" | "productCount" | "is_active";
type SortDir = "asc" | "desc";
type ActiveFilter = "all" | "active" | "inactive";

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  image_url: "",
  show_in_blog: false,
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
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchWorking, setBatchWorking] = useState(false);

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
      setSelectedIds(new Set());
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
      show_in_blog: category.show_in_blog,
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
            show_in_blog: form.show_in_blog,
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
            show_in_blog: form.show_in_blog,
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

  async function onBatchDelete() {
    const selected = categories.filter((c) => selectedIds.has(c.id));
    if (selected.length === 0) return;
    if (
      !window.confirm(
        `¿Eliminar/desactivar ${selected.length} categorías seleccionadas?`,
      )
    ) {
      return;
    }
    setBatchWorking(true);
    let ok = 0;
    let fail = 0;
    for (const category of selected) {
      try {
        const response = await fetch(`/api/admin/categories/${category.id}`, {
          method: "DELETE",
        });
        const data = (await response.json()) as { ok?: boolean };
        if (!response.ok || !data.ok) fail += 1;
        else ok += 1;
      } catch {
        fail += 1;
      }
    }
    setBatchWorking(false);
    if (ok) toast.success(`Procesadas: ${ok}`);
    if (fail) toast.error(`Fallaron: ${fail}`);
    await load();
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = categories.filter((c) => {
      if (activeFilter === "active" && !c.is_active) return false;
      if (activeFilter === "inactive" && c.is_active) return false;
      if (!q) return true;
      return [c.name, c.slug, c.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    return [...filtered].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "name":
          av = a.name.toLocaleLowerCase("es");
          bv = b.name.toLocaleLowerCase("es");
          break;
        case "slug":
          av = a.slug;
          bv = b.slug;
          break;
        case "productCount":
          av = a.productCount;
          bv = b.productCount;
          break;
        case "is_active":
          av = a.is_active ? 1 : 0;
          bv = b.is_active ? 1 : 0;
          break;
      }
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [categories, query, activeFilter, sortKey, sortDir]);

  const hasFilters = Boolean(query.trim()) || activeFilter !== "all";

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "productCount" ? "desc" : "asc");
  }

  function toggleSelectAllVisible() {
    const ids = visible.map((c) => c.id);
    const all = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (all) for (const id of ids) next.delete(id);
      else for (const id of ids) next.add(id);
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const editingCategory = editingId
    ? categories.find((c) => c.id === editingId)
    : null;
  const canToggleBlog =
    !editingCategory || editingCategory.parent_id === null;

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col md:min-h-[calc(100dvh-5rem)]">
      <AdminPageHeader
        eyebrow="Catálogo"
        title="Categorías"
        description={
          loading
            ? "Cargando categorías…"
            : `${visible.length} de ${categories.length} categorías`
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="admin-btn admin-btn-ghost"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Recargar
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="admin-btn admin-btn-primary"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nueva categoría
            </button>
          </>
        }
      />

      <AdminSearchToolbar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por nombre o slug…"
      >
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          className="admin-select min-w-[140px] w-auto"
          aria-label="Filtrar por estado"
        >
          <option value="all">Todas</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
        </select>
        {hasFilters ? (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setQuery("");
              setActiveFilter("all");
            }}
          >
            Limpiar filtros
          </button>
        ) : null}
        {selectedIds.size > 0 ? (
          <button
            type="button"
            disabled={batchWorking}
            onClick={() => void onBatchDelete()}
            className="admin-btn admin-btn-danger"
          >
            {batchWorking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Eliminar ({selectedIds.size})
          </button>
        ) : null}
      </AdminSearchToolbar>

      <AdminSidePanel
        open={showForm}
        onClose={closeForm}
        eyebrow={editingId ? "Editar" : "Alta"}
        title={editingId ? "Editar categoría" : "Nueva categoría"}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={closeForm}
              className="admin-btn admin-btn-ghost"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="admin-category-form"
              disabled={saving}
              className="admin-btn admin-btn-primary"
            >
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear"}
            </button>
          </>
        }
      >
        <form
            id="admin-category-form"
            onSubmit={(event) => void onSave(event)}
            className="grid gap-4 md:grid-cols-2"
          >
            <label className="admin-field-label">
              Nombre
              <input
                required
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="admin-input mt-2"
              />
            </label>
            <label className="admin-field-label">
              Slug (opcional)
              <input
                value={form.slug}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, slug: event.target.value }))
                }
                placeholder="se-genera-del-nombre"
                className="admin-input mt-2"
              />
            </label>
            <label className="admin-field-label md:col-span-2">
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
                className="admin-input mt-2"
              />
            </label>
            <label className="admin-field-label md:col-span-2">
              URL imagen (opcional)
              <input
                value={form.image_url}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, image_url: event.target.value }))
                }
                placeholder="https://..."
                className="admin-input mt-2"
              />
            </label>
            {canToggleBlog ? (
              <label className="md:col-span-2 flex items-center gap-2 text-sm text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={form.show_in_blog}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      show_in_blog: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Mostrar en el blog (categoría padre visible en el catálogo público)
              </label>
            ) : null}
          </form>
      </AdminSidePanel>

      {!loading && categories.length === 0 ? (
        <AdminEmptyState
          className="mt-6"
          title="Aún no hay categorías"
          subtitle="Crea la primera categoría para organizar el catálogo y el blog."
          actionLabel="Crear la primera"
          onAction={openCreate}
        />
      ) : (
      <div className="admin-table-wrap admin-table-wrap--fill mt-6">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={
                    visible.length > 0 &&
                    visible.every((c) => selectedIds.has(c.id))
                  }
                  onChange={toggleSelectAllVisible}
                  disabled={loading || visible.length === 0}
                  aria-label="Seleccionar todas"
                  className="h-4 w-4 accent-[var(--primary)]"
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Nombre"
                  active={sortKey === "name"}
                  direction={sortDir}
                  onClick={() => toggleSort("name")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Slug"
                  active={sortKey === "slug"}
                  direction={sortDir}
                  onClick={() => toggleSort("slug")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Productos"
                  active={sortKey === "productCount"}
                  direction={sortDir}
                  onClick={() => toggleSort("productCount")}
                />
              </th>
              <th className="px-4 py-3">Blog</th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Estado"
                  active={sortKey === "is_active"}
                  direction={sortDir}
                  onClick={() => toggleSort("is_active")}
                />
              </th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <AdminTableSkeleton rows={14} cols={7} />
            ) : categories.length === 0 ? null : visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Ninguna categoría coincide con los filtros.
                </td>
              </tr>
            ) : (
              visible.map((category) => (
                <tr
                  key={category.id}
                  className={`border-t border-[var(--border)] align-middle ${
                    !category.is_active ? "bg-[var(--surface-muted)]/80" : ""
                  }`}
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(category.id)}
                      onChange={() => toggleOne(category.id)}
                      aria-label={`Seleccionar ${category.name}`}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text)]">
                    {category.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {category.productCount}
                  </td>
                  <td className="px-4 py-3">
                    {category.parent_id === null ? (
                      <span
                        className={`admin-badge ${
                          category.show_in_blog ? "" : "admin-badge--muted"
                        }`}
                      >
                        {category.show_in_blog ? "Blog" : "Oculta"}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`admin-badge ${
                        category.is_active ? "" : "admin-badge--muted"
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
                        className="admin-icon-btn"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!category.is_active ? (
                        <button
                          type="button"
                          onClick={() => void onReactivate(category)}
                          disabled={saving}
                          className="admin-btn admin-btn-ghost h-8 px-2 text-[10px]"
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
                          className="admin-icon-btn hover:border-rose-600 hover:text-rose-700"
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
      )}
    </div>
  );
}
