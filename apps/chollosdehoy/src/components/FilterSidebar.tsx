"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEFAULT_FILTERS,
  type MarketplaceFilters,
  countActiveFilters,
} from "@/lib/filters";
import { MARKETPLACE_RETAILERS, retailerLabel } from "@/lib/retailers";
import type { CategoryFilterNode } from "@/lib/types";

interface FilterSidebarProps {
  categories: CategoryFilterNode[];
  filters: MarketplaceFilters;
  onChange: (filters: MarketplaceFilters) => void;
  onClose?: () => void;
  mobile?: boolean;
}

const DISCOUNT_PRESETS = [0, 10, 20, 30, 40, 50];

export function FilterSidebar({
  categories,
  filters,
  onChange,
  onClose,
  mobile,
}: FilterSidebarProps) {
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const parents = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories],
  );

  const subsByParent = useMemo(() => {
    const map = new Map<string, CategoryFilterNode[]>();
    for (const cat of categories) {
      if (!cat.parentId) continue;
      const list = map.get(cat.parentId) ?? [];
      list.push(cat);
      map.set(cat.parentId, list);
    }
    return map;
  }, [categories]);

  function patch(partial: Partial<MarketplaceFilters>) {
    onChange({ ...filters, ...partial });
  }

  function toggleParent(slug: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function selectParent(slug: string) {
    patch({
      parentSlug: filters.parentSlug === slug ? null : slug,
      subcategorySlug: null,
    });
  }

  function selectSub(slug: string, parentSlug: string) {
    patch({
      parentSlug,
      subcategorySlug: filters.subcategorySlug === slug ? null : slug,
    });
  }

  function toggleRetailer(id: string) {
    const set = new Set(filters.retailers);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    patch({ retailers: [...set] });
  }

  const activeCount = countActiveFilters(filters);

  return (
    <aside
      className={`card flex h-full flex-col ${mobile ? "rounded-none border-0 shadow-none" : ""}`}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-[var(--primary)]" />
          Filtros
          {activeCount > 0 && (
            <span className="badge bg-[var(--primary-soft)] text-[var(--primary)]">
              {activeCount}
            </span>
          )}
        </div>
        {mobile && onClose && (
          <button type="button" onClick={onClose} className="btn btn-ghost p-2">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto p-4">
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Categorías
          </h3>
          <ul className="space-y-1">
            {parents.map((parent) => {
              const subs = subsByParent.get(parent.id) ?? [];
              const expanded =
                expandedParents.has(parent.slug) ||
                filters.parentSlug === parent.slug;
              const isActive = filters.parentSlug === parent.slug;

              return (
                <li key={parent.id}>
                  <div className="flex items-center gap-1">
                    {subs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleParent(parent.slug)}
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                        aria-label="Expandir subcategorías"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition ${expanded ? "rotate-0" : "-rotate-90"}`}
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => selectParent(parent.slug)}
                      className={`flex flex-1 items-center justify-between rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm transition ${
                        isActive
                          ? "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]"
                          : "hover:bg-[var(--surface-muted)]"
                      }`}
                    >
                      <span>{parent.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {parent.productCount}
                      </span>
                    </button>
                  </div>

                  {expanded && subs.length > 0 && (
                    <ul className="ml-6 mt-1 space-y-0.5 border-l border-[var(--border)] pl-2">
                      {subs.map((sub) => (
                        <li key={sub.id}>
                          <button
                            type="button"
                            onClick={() => selectSub(sub.slug, parent.slug)}
                            className={`flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-1 text-left text-sm transition ${
                              filters.subcategorySlug === sub.slug
                                ? "bg-[var(--primary-soft)] font-medium text-[var(--primary)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                            }`}
                          >
                            <span>{sub.name}</span>
                            <span className="text-xs">{sub.productCount}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Tienda
          </h3>
          <div className="flex flex-wrap gap-2">
            {MARKETPLACE_RETAILERS.map((id) => {
              const active = filters.retailers.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleRetailer(id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {retailerLabel(id)}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Descuento mínimo
          </h3>
          <div className="flex flex-wrap gap-2">
            {DISCOUNT_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => patch({ minDiscount: value })}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  filters.minDiscount === value
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                }`}
              >
                {value === 0 ? "Todos" : `≥ ${value}%`}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Precio (€)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              placeholder="Mín"
              className="input text-sm"
              value={filters.minPrice ?? ""}
              onChange={(e) =>
                patch({
                  minPrice: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <input
              type="number"
              min={0}
              placeholder="Máx"
              className="input text-sm"
              value={filters.maxPrice ?? ""}
              onChange={(e) =>
                patch({
                  maxPrice: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
        </section>

        <section className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.onlyTopDeals}
              onChange={(e) => patch({ onlyTopDeals: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Solo top chollos
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.onlyFeatured}
              onChange={(e) => patch({ onlyFeatured: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Destacados
          </label>
        </section>
      </div>

      {activeCount > 0 && (
        <div className="border-t border-[var(--border)] p-4">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="btn btn-ghost w-full text-sm"
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </aside>
  );
}
