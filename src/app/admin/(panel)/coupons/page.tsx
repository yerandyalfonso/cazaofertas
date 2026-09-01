"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  AdminPageHeader,
  AdminRetailerBadge,
  AdminSearchToolbar,
  AdminSortButton,
} from "@/components/admin/AdminListChrome";
import { AdminTableSkeleton } from "@/components/admin/AdminSkeleton";
import { AdminSidePanel } from "@/components/admin/AdminSidePanel";
import { useAdminToast } from "@/components/admin/AdminToast";
import { retailerLabel } from "@/lib/retailers";

type AdminCoupon = {
  id: string;
  retailer: string;
  title: string;
  code: string;
  description: string;
  terms: string;
  url: string;
  starts_at: string | null;
  expires_at: string | null;
  highlight: boolean;
  is_active: boolean;
  source: string;
};

type FormState = {
  id?: string;
  retailer: string;
  title: string;
  code: string;
  description: string;
  terms: string;
  url: string;
  startsAt: string;
  expiresAt: string;
  highlight: boolean;
  isActive: boolean;
};

type SortKey = "title" | "retailer" | "code" | "expires_at" | "is_active";
type SortDir = "asc" | "desc";
type ActiveFilter = "all" | "active" | "inactive";

const EMPTY: FormState = {
  retailer: "amazon",
  title: "",
  code: "",
  description: "",
  terms: "",
  url: "",
  startsAt: "",
  expiresAt: "",
  highlight: false,
  isActive: true,
};

function isInternalCode(code: string): boolean {
  return /^(PROMO-|CUPONES-|CLUB-|MV-|AWIN-|CLIP-)/i.test(code);
}

export default function AdminCouponsPage() {
  const toast = useAdminToast();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [retailerFilter, setRetailerFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      const json = (await res.json()) as {
        ok: boolean;
        coupons?: AdminCoupon[];
        error?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.error || "Error al cargar");
      setCoupons(json.coupons ?? []);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const retailers = useMemo(() => {
    const set = new Set(coupons.map((c) => c.retailer));
    return [...set].sort((a, b) =>
      retailerLabel(a).localeCompare(retailerLabel(b), "es"),
    );
  }, [coupons]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = coupons.filter((c) => {
      if (retailerFilter && c.retailer !== retailerFilter) return false;
      if (activeFilter === "active" && !c.is_active) return false;
      if (activeFilter === "inactive" && c.is_active) return false;
      if (!q) return true;
      return [c.title, c.code, c.retailer, c.description, c.terms, c.url]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      switch (sortKey) {
        case "title":
          av = a.title.toLocaleLowerCase("es");
          bv = b.title.toLocaleLowerCase("es");
          break;
        case "retailer":
          av = retailerLabel(a.retailer).toLocaleLowerCase("es");
          bv = retailerLabel(b.retailer).toLocaleLowerCase("es");
          break;
        case "code":
          av = a.code;
          bv = b.code;
          break;
        case "expires_at":
          av = a.expires_at ?? "";
          bv = b.expires_at ?? "";
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
    return sorted;
  }, [coupons, query, retailerFilter, activeFilter, sortKey, sortDir]);

  const hasFilters =
    Boolean(query.trim()) || Boolean(retailerFilter) || activeFilter !== "all";

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "expires_at" ? "desc" : "asc");
  }

  function toggleSelectAllVisible() {
    const ids = visible.map((c) => c.id);
    const all = ids.length > 0 && ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (all) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
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

  function openCreate() {
    setForm(EMPTY);
    setShowForm(true);
  }

  function edit(c: AdminCoupon) {
    setForm({
      id: c.id,
      retailer: c.retailer,
      title: c.title,
      code: c.code,
      description: c.description ?? "",
      terms: c.terms ?? "",
      url: c.url,
      startsAt: c.starts_at ?? "",
      expiresAt: c.expires_at ?? "",
      highlight: c.highlight,
      isActive: c.is_active,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(EMPTY);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        id: form.id,
        retailer: form.retailer,
        title: form.title,
        code: form.code,
        description: form.description,
        terms: form.terms,
        url: form.url,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
        highlight: form.highlight,
        isActive: form.isActive,
        source: "manual",
      };
      const res = await fetch("/api/admin/coupons", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo guardar");
      toast.success(form.id ? "Cupón actualizado" : "Cupón creado");
      closeForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este cupón?")) return;
    try {
      const res = await fetch(`/api/admin/coupons?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo borrar");
      toast.success("Cupón eliminado");
      if (form.id === id) closeForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  }

  async function onBatchDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} cupones seleccionados?`)) return;
    setBatchDeleting(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo borrar");
      toast.success(`Eliminados: ${ids.length}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setBatchDeleting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col md:min-h-[calc(100dvh-5rem)]">
      <AdminPageHeader
        eyebrow="Marketplace"
        title="Cupones"
        description={
          loading
            ? "Cargando cupones…"
            : `${visible.length} de ${coupons.length} cupones`
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
            <button type="button" onClick={openCreate} className="admin-btn admin-btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo cupón
            </button>
          </>
        }
      />

      <AdminSearchToolbar
        value={query}
        onChange={setQuery}
        placeholder="Buscar por título, código, tienda…"
      >
        <select
          value={retailerFilter}
          onChange={(e) => setRetailerFilter(e.target.value)}
          className="admin-select min-w-[150px] w-auto"
          aria-label="Filtrar por tienda"
        >
          <option value="">Todas las tiendas</option>
          {retailers.map((r) => (
            <option key={r} value={r}>
              {retailerLabel(r)}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          className="admin-select min-w-[140px] w-auto"
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        {hasFilters ? (
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => {
              setQuery("");
              setRetailerFilter("");
              setActiveFilter("all");
            }}
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
        eyebrow={form.id ? "Editar" : "Alta"}
        title={form.id ? "Editar cupón" : "Nuevo cupón"}
        size="lg"
        footer={
          <>
            <button type="button" onClick={closeForm} className="admin-btn admin-btn-ghost">
              Cancelar
            </button>
            <button
              type="submit"
              form="admin-coupon-form"
              disabled={saving}
              className="admin-btn admin-btn-primary"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {form.id ? "Guardar cambios" : "Crear cupón"}
            </button>
          </>
        }
      >
        <form id="admin-coupon-form" onSubmit={save} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">

            <label className="admin-field-label block text-sm">
              <span>Tienda (slug)</span>
              <input
                required
                value={form.retailer}
                onChange={(e) => setForm((f) => ({ ...f, retailer: e.target.value }))}
                className="admin-input"
                placeholder="amazon"
              />
            </label>
            <label className="admin-field-label block text-sm">
              <span>Código</span>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                className="admin-input font-mono"
                placeholder="MODA15"
              />
            </label>
            <label className="admin-field-label block text-sm md:col-span-2">
              <span>Título</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="admin-input"
              />
            </label>
            <label className="admin-field-label block text-sm md:col-span-2">
              <span>Descripción</span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="admin-input"
              />
            </label>
            <label className="admin-field-label block text-sm md:col-span-2">
              <span>Condiciones</span>
              <textarea
                value={form.terms}
                onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                className="admin-input"
              />
            </label>
            <label className="admin-field-label block text-sm md:col-span-2">
              <span>URL</span>
              <input
                required
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="admin-input"
              />
            </label>
            <label className="admin-field-label block text-sm">
              <span>Inicio</span>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="admin-input"
              />
            </label>
            <label className="admin-field-label block text-sm">
              <span>Caduca</span>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiresAt: e.target.value }))
                }
                className="admin-input"
              />
            </label>
          
          </div>

          <div className="flex flex-wrap gap-4 text-sm">

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.highlight}
                onChange={(e) =>
                  setForm((f) => ({ ...f, highlight: e.target.checked }))
                }
              />
              Destacado
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />
              Activo
            </label>
          
          </div>
        </form>
      </AdminSidePanel>

      {!loading && coupons.length === 0 ? (
        <AdminEmptyState
          className="mt-6"
          title="Aún no hay cupones"
          subtitle="Añade códigos de descuento manualmente o deja que el cron los descubra."
          actionLabel="Crear el primero"
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
                  aria-label="Seleccionar todos"
                  className="h-4 w-4 accent-[var(--primary)]"
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Título"
                  active={sortKey === "title"}
                  direction={sortDir}
                  onClick={() => toggleSort("title")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Tienda"
                  active={sortKey === "retailer"}
                  direction={sortDir}
                  onClick={() => toggleSort("retailer")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Código"
                  active={sortKey === "code"}
                  direction={sortDir}
                  onClick={() => toggleSort("code")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Caduca"
                  active={sortKey === "expires_at"}
                  direction={sortDir}
                  onClick={() => toggleSort("expires_at")}
                />
              </th>
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
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Ningún cupón coincide con los filtros.
                </td>
              </tr>
            ) : (
              visible.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-[var(--border)] align-middle"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                      aria-label={`Seleccionar ${c.title}`}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-md font-medium text-[var(--text)]">
                      {c.title}
                    </p>
                    {c.terms ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                        {c.terms}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <AdminRetailerBadge retailer={c.retailer} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">
                    {isInternalCode(c.code) ? "—" : c.code}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">
                    {c.expires_at ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`admin-badge ${c.is_active ? "" : "admin-badge--muted"}`}
                    >
                      {c.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir URL del cupón"
                          aria-label="Abrir URL del cupón"
                          className="admin-icon-btn"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => edit(c)}
                        className="admin-icon-btn"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Eliminar"
                        aria-label="Eliminar"
                        onClick={() => void remove(c.id)}
                        className="admin-icon-btn hover:border-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
