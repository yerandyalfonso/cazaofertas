"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CategoryHero } from "@/components/CategoryHero";
import { FilterSidebar } from "@/components/FilterSidebar";
import { MarketplaceHeader } from "@/components/MarketplaceHeader";
import { PaginationBar } from "@/components/PaginationBar";
import { ProductCard } from "@/components/ProductCard";
import { TopDealsPanel } from "@/components/TopDealsPanel";
import { filtersToSearchParams } from "@/lib/api-params";
import { MARKETPLACE_PAGE_SIZE } from "@/lib/coupons";
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  type MarketplaceFilters,
} from "@/lib/filters";
import type { MarketplaceBootstrap } from "@/lib/marketplace-types";
import type { PaginatedProducts } from "@/lib/marketplace-types";
import type { ViewMode } from "@/lib/types";

interface MarketplaceAppProps {
  bootstrap: MarketplaceBootstrap;
}

export function MarketplaceApp({ bootstrap }: MarketplaceAppProps) {
  const [filters, setFilters] = useState<MarketplaceFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<PaginatedProducts>(
    bootstrap.initialPage,
  );
  const [loading, setLoading] = useState(false);
  const skipInitialFetch = useRef(true);

  const fetchPage = useCallback(
    async (nextFilters: MarketplaceFilters, nextPage: number) => {
      setLoading(true);
      try {
        const params = filtersToSearchParams(
          nextFilters,
          nextPage,
          MARKETPLACE_PAGE_SIZE,
        );
        const res = await fetch(`/api/ofertas?${params.toString()}`);
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as PaginatedProducts;
        setCatalog(data);
      } catch {
        /* keep previous page on error */
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const activeFilterCount = countActiveFilters(filters);

  useEffect(() => {
    if (skipInitialFetch.current && page === 1 && activeFilterCount === 0) {
      skipInitialFetch.current = false;
      return;
    }
    skipInitialFetch.current = false;

    const timer = setTimeout(() => {
      void fetchPage(filters, page);
    }, filters.query.trim() ? 350 : 0);
    return () => clearTimeout(timer);
  }, [filters, page, fetchPage, activeFilterCount]);

  function updateFilters(next: MarketplaceFilters) {
    setFilters(next);
    setPage(1);
  }

  function selectCategory(parentSlug: string) {
    updateFilters({
      ...filters,
      parentSlug: parentSlug || null,
      subcategorySlug: null,
    });
  }

  function goToPage(nextPage: number) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const showHero = !filters.parentSlug && !filters.query.trim() && page === 1;

  return (
    <div className="marketplace-shell">
      <MarketplaceHeader
        filters={filters}
        onFiltersChange={updateFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        resultCount={catalog.total}
        totalCount={bootstrap.stats.totalProducts}
        onOpenFilters={() => setMobileFiltersOpen(true)}
        activeFilterCount={activeFilterCount}
      />

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="hidden lg:block">
          <div className="sticky top-[148px]">
            <FilterSidebar
              categories={bootstrap.categories}
              filters={filters}
              onChange={updateFilters}
            />
          </div>
        </div>

        <main className="min-w-0 space-y-5">
          {showHero && (
            <CategoryHero
              categories={bootstrap.categories}
              filters={filters}
              onSelectCategory={selectCategory}
            />
          )}

          {loading && (
            <div className="text-center text-sm text-[var(--text-muted)]">
              Cargando ofertas…
            </div>
          )}

          {catalog.items.length === 0 && !loading ? (
            <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <p className="text-lg font-semibold">No hay ofertas con estos filtros</p>
              <p className="max-w-md text-sm text-[var(--text-muted)]">
                Prueba a ampliar la búsqueda, bajar el descuento mínimo o quitar alguna
                categoría.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => updateFilters(DEFAULT_FILTERS)}
              >
                Ver todas las ofertas
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div
              className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${
                loading ? "opacity-60" : ""
              }`}
            >
              {catalog.items.map((product) => (
                <ProductCard key={product.id} product={product} view="grid" />
              ))}
            </div>
          ) : (
            <div className={`space-y-3 ${loading ? "opacity-60" : ""}`}>
              {catalog.items.map((product) => (
                <ProductCard key={product.id} product={product} view="list" />
              ))}
            </div>
          )}

          <PaginationBar
            page={catalog.page}
            totalPages={catalog.totalPages}
            total={catalog.total}
            pageSize={catalog.pageSize}
            onPageChange={goToPage}
            loading={loading}
          />
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-[148px]">
            <TopDealsPanel
              topDeals={bootstrap.spotlight.topDeals}
              trending={bootstrap.spotlight.trending}
              latest={bootstrap.spotlight.latest}
            />
          </div>
        </aside>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileFiltersOpen(false)}
            aria-label="Cerrar filtros"
          />
          <div className="absolute inset-y-0 left-0 w-[min(100%,320px)] bg-[var(--surface)] shadow-2xl">
            <FilterSidebar
              categories={bootstrap.categories}
              filters={filters}
              onChange={(next) => {
                updateFilters(next);
                setMobileFiltersOpen(false);
              }}
              onClose={() => setMobileFiltersOpen(false)}
              mobile
            />
          </div>
        </div>
      )}

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-8">
        <div className="mx-auto max-w-[1600px] px-4 text-center text-sm text-[var(--text-muted)]">
          <p className="font-semibold text-[var(--text)]">Chollos de Hoy</p>
          <p className="mt-1">
            Marketplace de ofertas · Actualizado en tiempo real
          </p>
        </div>
      </footer>
    </div>
  );
}
