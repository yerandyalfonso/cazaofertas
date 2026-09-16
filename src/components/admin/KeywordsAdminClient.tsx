"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  AdminPageHeader,
  AdminSearchToolbar,
  AdminSortButton,
} from "@/components/admin/AdminListChrome";
import { AdminTableSkeleton } from "@/components/admin/AdminSkeleton";
import { AdminSidePanel } from "@/components/admin/AdminSidePanel";
import { useAdminToast } from "@/components/admin/AdminToast";
import { formatBreadcrumbPatternList } from "@/lib/breadcrumb-patterns";
import { formatKeywordList } from "@/lib/keyword-list";

type AdminKeywordGroup = {
  id: string;
  keywords: string[];
  breadcrumbPatterns: string[];
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  parentSlug: string | null;
  parentName: string | null;
  lookupSlug: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
};

type FormState = {
  id?: string;
  keywordsText: string;
  breadcrumbPatternsText: string;
  categoryId: string;
  isActive: boolean;
  notes: string;
};

type SortKey = "categoryName" | "lookupSlug" | "keywordCount" | "isActive";
type SortDir = "asc" | "desc";
type ActiveFilter = "all" | "active" | "inactive";

const EMPTY: FormState = {
  keywordsText: "",
  breadcrumbPatternsText: "",
  categoryId: "",
  isActive: true,
  notes: "",
};

/** Máx. chips visibles (~2 líneas); el resto siempre como +N fuera del clip. */
const CHIP_PREVIEW = 5;

function FieldHelp({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-1.5">
      <span>{label}</span>
      <button
        type="button"
        className="inline-flex text-[var(--text-muted)] transition hover:text-[var(--primary)]"
        aria-label={`Ayuda: ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span
          role="note"
          className="absolute left-0 top-full z-20 mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs font-normal normal-case tracking-normal text-[var(--text-muted)] shadow-lg"
        >
          {children}
          <button
            type="button"
            className="mt-2 text-[var(--primary)] underline"
            onClick={() => setOpen(false)}
          >
            Cerrar
          </button>
        </span>
      ) : null}
    </span>
  );
}

function KeywordChips({
  items,
  query,
  empty = "—",
}: {
  items: string[];
  query: string;
  empty?: string;
}) {
  const q = query.trim().toLowerCase();
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
  } | null>(null);

  if (items.length === 0) {
    return <span className="text-[var(--text-muted)]">{empty}</span>;
  }

  const matches = q
    ? items.filter((item) => item.toLowerCase().includes(q))
    : [];
  const rest = q
    ? items.filter((item) => !item.toLowerCase().includes(q))
    : items;
  const ordered = q && matches.length > 0 ? [...matches, ...rest] : items;
  const preview = ordered.slice(0, CHIP_PREVIEW);
  const hiddenItems = ordered.slice(CHIP_PREVIEW);
  const hidden = hiddenItems.length;

  function showTooltip(event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({
      x: Math.min(rect.left, window.innerWidth - 280),
      y: rect.bottom + 6,
    });
  }

  return (
    <div className="flex flex-wrap content-start items-center gap-1" style={{ maxHeight: "3.25rem" }}>
      {preview.map((item) => {
        const isMatch = Boolean(q) && item.toLowerCase().includes(q);
        return (
          <span
            key={item}
            className={`inline-flex max-w-[8.5rem] truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-4 ${
              isMatch
                ? "border-[var(--primary)]/40 bg-[var(--primary)]/10 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
            }`}
            title={item}
          >
            {item}
          </span>
        );
      })}
      {hidden > 0 ? (
        <>
          <span
            className="ml-0.5 inline whitespace-nowrap text-[11px] font-medium leading-4 text-[var(--primary)]"
            onMouseEnter={showTooltip}
            onMouseLeave={() => setTooltip(null)}
            onFocus={showTooltip}
            onBlur={() => setTooltip(null)}
            tabIndex={0}
          >
            +{hidden}
          </span>
          {tooltip ? (
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[80] w-max max-w-[min(22rem,70vw)] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-left text-[11px] font-normal leading-relaxed text-[var(--text)] shadow-lg"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {hiddenItems.join(", ")}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function KeywordsAdminClient() {
  const toast = useAdminToast();
  const [groups, setGroups] = useState<AdminKeywordGroup[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [childFilter, setChildFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("categoryName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [kwRes, catRes] = await Promise.all([
        fetch("/api/admin/keywords?all=1"),
        fetch("/api/admin/categories?all=1"),
      ]);
      const kwJson = (await kwRes.json()) as {
        ok?: boolean;
        error?: string;
        keywords?: AdminKeywordGroup[];
      };
      const catJson = (await catRes.json()) as {
        ok?: boolean;
        error?: string;
        categories?: CategoryOption[];
      };

      if (!kwRes.ok || !kwJson.ok) {
        toast.error(kwJson.error ?? "No se pudieron cargar keywords.");
        return;
      }
      if (!catRes.ok || !catJson.ok) {
        toast.error(catJson.error ?? "No se pudieron cargar categorías.");
        return;
      }

      setGroups(kwJson.keywords ?? []);
      setCategories(catJson.categories ?? []);
    } catch {
      toast.error("Error de red al cargar keywords.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const parents = useMemo(
    () =>
      categories
        .filter((c) => !c.parent_id && c.is_active)
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [categories],
  );

  const parentById = useMemo(() => {
    const map = new Map(parents.map((p) => [p.id, p] as const));
    return map;
  }, [parents]);

  const childrenOfParent = useMemo(() => {
    if (!parentFilter) return [];
    return categories
      .filter((c) => c.parent_id === parentFilter && c.is_active)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [categories, parentFilter]);

  const categoryOptions = useMemo(() => {
    const used = new Set(groups.map((g) => g.categoryId));
    const leaves = categories.filter((c) => c.parent_id);
    return (leaves.length > 0 ? leaves : categories)
      .filter((c) => c.is_active)
      .map((c) => {
        const parent = c.parent_id ? parentById.get(c.parent_id) : null;
        const label = parent ? `${parent.name} › ${c.name}` : c.name;
        return { id: c.id, label, used: used.has(c.id) };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [categories, groups, parentById]);

  const categoryById = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c] as const));
    return map;
  }, [categories]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = groups.filter((item) => {
      if (activeFilter === "active" && !item.isActive) return false;
      if (activeFilter === "inactive" && item.isActive) return false;

      const leaf = categoryById.get(item.categoryId);
      const parentId = leaf?.parent_id ?? null;

      if (parentFilter) {
        if (parentId !== parentFilter && item.categoryId !== parentFilter) {
          return false;
        }
      }
      if (childFilter && item.categoryId !== childFilter) return false;

      if (!q) return true;
      const hay = [
        item.categoryName,
        item.categorySlug,
        item.parentName ?? "",
        item.parentSlug ?? "",
        item.lookupSlug,
        item.notes ?? "",
        ...item.keywords,
        ...(item.breadcrumbPatterns ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    return [...filtered].sort((a, b) => {
      const av =
        sortKey === "keywordCount"
          ? a.keywords.length + (a.breadcrumbPatterns?.length ?? 0)
          : sortKey === "isActive"
            ? Number(a.isActive)
            : a[sortKey];
      const bv =
        sortKey === "keywordCount"
          ? b.keywords.length + (b.breadcrumbPatterns?.length ?? 0)
          : sortKey === "isActive"
            ? Number(b.isActive)
            : b[sortKey];
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [
    groups,
    query,
    activeFilter,
    parentFilter,
    childFilter,
    categoryById,
    sortKey,
    sortDir,
  ]);

  const totalKeywords = useMemo(
    () => groups.reduce((n, g) => n + g.keywords.length, 0),
    [groups],
  );
  const totalPatterns = useMemo(
    () => groups.reduce((n, g) => n + (g.breadcrumbPatterns?.length ?? 0), 0),
    [groups],
  );

  const hasFilters =
    Boolean(query.trim()) ||
    activeFilter !== "all" ||
    Boolean(parentFilter) ||
    Boolean(childFilter);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  function openCreate() {
    const scoped = parentFilter
      ? categoryOptions.filter((opt) => {
          const leaf = categoryById.get(opt.id);
          return leaf?.parent_id === parentFilter && !opt.used;
        })
      : categoryOptions.filter((c) => !c.used);
    const firstFree = scoped[0] ?? categoryOptions.find((c) => !c.used);
    setForm({
      ...EMPTY,
      categoryId: childFilter || firstFree?.id || categoryOptions[0]?.id || "",
    });
    setShowForm(true);
  }

  function openEdit(item: AdminKeywordGroup) {
    setForm({
      id: item.id,
      keywordsText: formatKeywordList(item.keywords),
      breadcrumbPatternsText: formatBreadcrumbPatternList(
        item.breadcrumbPatterns ?? [],
      ),
      categoryId: item.categoryId,
      isActive: item.isActive,
      notes: item.notes ?? "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(EMPTY);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.categoryId.trim()) {
      toast.error("La categoría es obligatoria.");
      return;
    }
    if (!form.keywordsText.trim() && !form.breadcrumbPatternsText.trim()) {
      toast.error("Añade keywords o patrones de breadcrumb.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: form.id,
        keywords: form.keywordsText,
        breadcrumbPatterns: form.breadcrumbPatternsText,
        categoryId: form.categoryId,
        isActive: form.isActive,
        notes: form.notes.trim() || null,
      };
      const res = await fetch("/api/admin/keywords", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo guardar");
      }
      toast.success(form.id ? "Grupo actualizado" : "Grupo creado");
      closeForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: AdminKeywordGroup) {
    const label = item.parentName
      ? `${item.parentName} › ${item.categoryName}`
      : item.categoryName;
    if (
      !confirm(
        `¿Eliminar el grupo de «${label}» (${item.keywords.length} keywords, ${item.breadcrumbPatterns?.length ?? 0} patrones)?`,
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/keywords?id=${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "No se pudo eliminar");
      }
      toast.success("Grupo eliminado");
      if (form.id === item.id) closeForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  }

  function categoryLabel(item: AdminKeywordGroup): string {
    if (item.parentName) return `${item.parentName} › ${item.categoryName}`;
    return item.categoryName;
  }

  const formCategoryOptions = useMemo(() => {
    if (!parentFilter) return categoryOptions;
    return categoryOptions.filter((opt) => {
      const leaf = categoryById.get(opt.id);
      return leaf?.parent_id === parentFilter;
    });
  }, [categoryOptions, parentFilter, categoryById]);

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col md:min-h-[calc(100dvh-5rem)]">
      <AdminPageHeader
        eyebrow="Clasificación"
        title="Keywords"
        description={
          loading
            ? "Cargando grupos…"
            : `${visible.length} de ${groups.length} grupos · ${totalKeywords} keywords · ${totalPatterns} breadcrumbs`
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
              Nuevo grupo
            </button>
          </>
        }
      />

      <AdminSearchToolbar
        value={query}
        onChange={setQuery}
        placeholder="Buscar keyword, patrón o nombre…"
      >
        <select
          value={parentFilter}
          onChange={(e) => {
            setParentFilter(e.target.value);
            setChildFilter("");
          }}
          className="admin-select min-w-[180px] w-auto"
          aria-label="Filtrar por categoría padre"
        >
          <option value="">Todas las categorías</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={childFilter}
          onChange={(e) => setChildFilter(e.target.value)}
          className="admin-select min-w-[180px] w-auto"
          aria-label="Filtrar por subcategoría"
          disabled={!parentFilter}
        >
          <option value="">
            {parentFilter ? "Todas las subcategorías" : "Elige categoría primero"}
          </option>
          {childrenOfParent.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          className="admin-select min-w-[120px] w-auto"
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
              setParentFilter("");
              setChildFilter("");
              setActiveFilter("all");
            }}
          >
            Limpiar filtros
          </button>
        ) : null}
      </AdminSearchToolbar>

      {parentFilter && childrenOfParent.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setChildFilter("")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              !childFilter
                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40"
            }`}
          >
            Todas ({childrenOfParent.length})
          </button>
          {childrenOfParent.map((c) => {
            const count = groups.filter((g) => g.categoryId === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChildFilter(c.id)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  childFilter === c.id
                    ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--text)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40"
                }`}
              >
                {c.name}
                {count > 0 ? ` · ${count}` : ""}
              </button>
            );
          })}
        </div>
      ) : null}

      <AdminSidePanel
        open={showForm}
        onClose={closeForm}
        eyebrow={form.id ? "Editar" : "Alta"}
        title={form.id ? "Editar grupo" : "Nuevo grupo"}
        size="lg"
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
              form="admin-keyword-form"
              disabled={saving}
              className="admin-btn admin-btn-primary"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {form.id ? "Guardar cambios" : "Crear grupo"}
            </button>
          </>
        }
      >
        <form id="admin-keyword-form" onSubmit={save} className="flex flex-col gap-8">
          <label className="admin-field-label block text-sm">
            <span className="mb-2 block">Subcategoría</span>
            <select
              required
              value={form.categoryId}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoryId: e.target.value }))
              }
              className="admin-select w-full"
              disabled={Boolean(form.id)}
            >
              <option value="" disabled>
                Selecciona una categoría
              </option>
              {(form.id ? categoryOptions : formCategoryOptions).map((opt) => (
                <option
                  key={opt.id}
                  value={opt.id}
                  disabled={!form.id && opt.used}
                >
                  {opt.label}
                  {!form.id && opt.used ? " (ya tiene grupo)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-field-label block text-sm">
            <span className="mb-2 block">
              <FieldHelp label="Keywords (título)">
                <p>
                  Palabras o frases que se buscan en el <strong>título</strong> y
                  en las migas. Cada coincidencia suma <strong>+5</strong>.
                </p>
                <p className="mt-2">
                  Sepáralas por <strong>comas</strong> o saltos de línea. Frases
                  con espacios (p. ej. <code>google pixel</code>) van entre
                  comas.
                </p>
              </FieldHelp>
            </span>
            <textarea
              value={form.keywordsText}
              onChange={(e) =>
                setForm((f) => ({ ...f, keywordsText: e.target.value }))
              }
              className="admin-input admin-input--lg resize-y"
              placeholder="iphone, smartphone, google pixel, samsung galaxy"
              autoFocus
              spellCheck={false}
            />
          </label>

          <label className="admin-field-label block text-sm">
            <span className="mb-2 block">
              <FieldHelp label="Patrones breadcrumb">
                <p>
                  Se evalúan solo sobre las <strong>migas de Amazon</strong>.
                  Cada match suma <strong>+6</strong>.
                </p>
                <p className="mt-2">Un patrón por línea (fuente regex, sin /…/).</p>
              </FieldHelp>
            </span>
            <textarea
              value={form.breadcrumbPatternsText}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  breadcrumbPatternsText: e.target.value,
                }))
              }
              className="admin-input admin-input--md resize-y"
              placeholder={"\\bbelleza\\b\n\\bmaquillaje\\b\n\\bcosmetica\\b"}
              spellCheck={false}
            />
          </label>

          <label className="admin-field-label block text-sm">
            <span className="mb-2 block">Notas (opcional)</span>
            <input
              type="text"
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="admin-input"
              placeholder="Nota corta…"
            />
          </label>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((f) => ({ ...f, isActive: e.target.checked }))
              }
            />
            Activo (usado en la inferencia automática)
          </label>
        </form>
      </AdminSidePanel>

      {!loading && groups.length === 0 && !hasFilters ? (
        <AdminEmptyState
          className="mt-6"
          title="Aún no hay grupos de clasificación"
          subtitle="Crea un grupo por subcategoría con keywords y/o patrones de breadcrumb."
          actionLabel="Crear el primero"
          onAction={openCreate}
        />
      ) : (
        <div className="admin-table-wrap mt-4">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-[var(--border)] text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              <tr>
                <th className="w-[22%] px-4 py-3">
                  <AdminSortButton
                    label="Categoría"
                    active={sortKey === "categoryName"}
                    direction={sortDir}
                    onClick={() => toggleSort("categoryName")}
                  />
                </th>
                <th className="px-4 py-3">Keywords</th>
                <th className="hidden px-4 py-3 xl:table-cell">Breadcrumbs</th>
                <th className="hidden w-[7rem] px-4 py-3 md:table-cell">
                  <AdminSortButton
                    label="Cantidad"
                    active={sortKey === "keywordCount"}
                    direction={sortDir}
                    onClick={() => toggleSort("keywordCount")}
                  />
                </th>
                <th className="w-[7rem] px-4 py-3">
                  <AdminSortButton
                    label="Estado"
                    active={sortKey === "isActive"}
                    direction={sortDir}
                    onClick={() => toggleSort("isActive")}
                  />
                </th>
                <th className="w-[6rem] px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AdminTableSkeleton rows={8} cols={6} />
              ) : visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[var(--text-muted)]"
                  >
                    Sin resultados con los filtros actuales.
                  </td>
                </tr>
              ) : (
                visible.map((item) => (
                  <tr
                    key={item.id}
                    className="border-t border-[var(--border)] align-middle"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium leading-snug text-[var(--text)]">
                        {categoryLabel(item)}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                        {item.lookupSlug}
                      </div>
                    </td>
                    <td className="overflow-visible px-4 py-2.5">
                      <KeywordChips items={item.keywords} query={query} />
                    </td>
                    <td className="hidden overflow-visible px-4 py-2.5 xl:table-cell">
                      <KeywordChips
                        items={item.breadcrumbPatterns ?? []}
                        query={query}
                      />
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-[var(--text-muted)] md:table-cell">
                      {item.keywords.length} kw ·{" "}
                      {item.breadcrumbPatterns?.length ?? 0} bc
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`admin-badge ${item.isActive ? "" : "admin-badge--muted"}`}
                      >
                        {item.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          className="admin-icon-btn"
                          title="Editar"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn hover:border-rose-600 hover:text-rose-700"
                          title="Eliminar"
                          onClick={() => void remove(item)}
                        >
                          <Trash2 className="h-4 w-4" />
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
