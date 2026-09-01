"use client";

import Link from "next/link";
import {
  Grid3x3,
  LayoutList,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { DEFAULT_FILTERS, type MarketplaceFilters } from "@/lib/filters";
import type { SortOption, ViewMode } from "@/lib/types";

interface MarketplaceHeaderProps {
  filters: MarketplaceFilters;
  onFiltersChange: (filters: MarketplaceFilters) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  resultCount: number;
  totalCount: number;
  onOpenFilters: () => void;
  activeFilterCount: number;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "score", label: "Mejor chollo" },
  { value: "discount", label: "Mayor descuento" },
  { value: "newest", label: "Más recientes" },
  { value: "price-asc", label: "Precio ↑" },
  { value: "price-desc", label: "Precio ↓" },
];

export function MarketplaceHeader({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  resultCount,
  totalCount,
  onOpenFilters,
  activeFilterCount,
}: MarketplaceHeaderProps) {
  const isFiltered = activeFilterCount > 0 || resultCount !== totalCount;

  return (
    <header className="hero-header sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur-md">
      <div className="mx-auto max-w-[1600px] px-4 py-3 md:py-4">
        {/* Marca + acciones secundarias */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold tracking-tight text-[var(--text)] md:text-xl">
                Chollos de Hoy
              </span>
              <span className="block truncate text-xs text-[var(--text-muted)]">
                {isFiltered ? (
                  <>
                    <span className="font-semibold text-[var(--primary)]">
                      {resultCount}
                    </span>
                    {" de "}
                    {totalCount} ofertas
                  </>
                ) : (
                  <>{totalCount} ofertas activas</>
                )}
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  en vivo
                </span>
              </span>
            </span>
          </Link>

          <Link
            href="/cupones"
            className="btn btn-ghost shrink-0 text-sm shadow-[var(--shadow-sm)]"
          >
            <Ticket className="h-4 w-4 text-[var(--primary)]" />
            <span className="hidden sm:inline">Cupones</span>
          </Link>
        </div>

        {/* Barra de búsqueda + acciones unificada */}
        <div className="hero-toolbar">
          <label className="hero-toolbar-search">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
            <input
              type="search"
              placeholder="Buscar productos, marcas, categorías…"
              value={filters.query}
              onChange={(e) =>
                onFiltersChange({ ...filters, query: e.target.value })
              }
              aria-label="Buscar ofertas"
            />
            {filters.query && (
              <button
                type="button"
                className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
                onClick={() => onFiltersChange({ ...filters, query: "" })}
                aria-label="Borrar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          <div className="hero-toolbar-actions">
            <button
              type="button"
              onClick={onOpenFilters}
              className="hero-toolbar-btn lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span>Filtros</span>
              {activeFilterCount > 0 && (
                <span className="hero-toolbar-badge">{activeFilterCount}</span>
              )}
            </button>

            <div className="hero-toolbar-select-wrap">
              <select
                className="hero-toolbar-select"
                value={filters.sort}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    sort: e.target.value as SortOption,
                  })
                }
                aria-label="Ordenar ofertas"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="hero-toolbar-view" role="group" aria-label="Vista">
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                className={viewMode === "grid" ? "is-active" : ""}
                aria-label="Vista cuadrícula"
                aria-pressed={viewMode === "grid"}
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("list")}
                className={viewMode === "list" ? "is-active" : ""}
                aria-label="Vista lista"
                aria-pressed={viewMode === "list"}
              >
                <LayoutList className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Chips de filtros activos */}
        {activeFilterCount > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Filtros activos:
            </span>
            {filters.parentSlug && (
              <span className="hero-filter-chip">{filters.parentSlug}</span>
            )}
            {filters.subcategorySlug && (
              <span className="hero-filter-chip">{filters.subcategorySlug}</span>
            )}
            {filters.retailers.map((r) => (
              <span key={r} className="hero-filter-chip">
                {r}
              </span>
            ))}
            {filters.minDiscount > 0 && (
              <span className="hero-filter-chip">≥{filters.minDiscount}%</span>
            )}
            <button
              type="button"
              className="text-xs font-semibold text-[var(--primary)] hover:underline"
              onClick={() => onFiltersChange(DEFAULT_FILTERS)}
            >
              Limpiar todo
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
