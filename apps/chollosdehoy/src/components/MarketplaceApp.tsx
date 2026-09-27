"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CategoryHero } from "@/components/CategoryHero";
import { FilterSidebar } from "@/components/FilterSidebar";
import { MarketplaceHeader } from "@/components/MarketplaceHeader";
import { PaginationBar } from "@/components/PaginationBar";
import { ProductCard } from "@/components/ProductCard";
import { TopDealsPanel } from "@/components/TopDealsPanel";
import { filtersToSearchParams, searchParamsToFilters } from "@/lib/api-params";
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
  /** Pie renderizado en servidor (SiteFooter). */
  footer: ReactNode;
}

export function MarketplaceApp({ bootstrap, footer }: MarketplaceAppProps) {
  const [filters, setFilters] = useState<MarketplaceFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<PaginatedProducts>(
    bootstrap.initialPage,
  );
  const [loading, setLoading] = useState(false);
  const skipInitialFetch = useRef(true);
  // Solo cuenta la respuesta de la última petición (las lentas no pisan a las nuevas).
  const latestRequest = useRef(0);

  const fetchPage = useCallback(
    async (nextFilters: MarketplaceFilters, nextPage: number) => {
      const requestId = ++latestRequest.current;
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
        if (requestId === latestRequest.current) setCatalog(data);
      } catch {
        /* keep previous page on error */
      } finally {
        if (requestId === latestRequest.current) setLoading(false);
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

  // Filtros y página en la URL (?q=…&parent=…&page=2): se pueden compartir y
  // «atrás» los conserva. La portada es estática, así que se leen al montar.
  useEffect(() => {
    const applyFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      if ([...params.keys()].length === 0) return;
      const parsed = searchParamsToFilters(params);
      setFilters(parsed.filters);
      setPage(parsed.page);
    };
    applyFromUrl();
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
  }, []);

  useEffect(() => {
    const params = filtersToSearchParams(filters, page, MARKETPLACE_PAGE_SIZE);
    params.delete("pageSize");
    if (page === 1) params.delete("page");
    const query = params.toString();
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [filters, page]);

  // Escape cierra el panel de filtros del móvil.
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileFiltersOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileFiltersOpen]);

  function updateFilters(next: MarketplaceFilters) {
    setFilters(next);
    setPage(1);
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

        <main id="contenido" className="min-w-0 space-y-5">
          {!showHero && <h1 className="sr-only">Chollos de hoy</h1>}
          {showHero && (
            <CategoryHero
              categories={bootstrap.categories}
              totalProducts={bootstrap.stats.totalProducts}
            />
          )}

          <p aria-live="polite" className="text-center text-sm text-muted empty:hidden">
            {loading ? "Cargando ofertas…" : ""}
          </p>

          {catalog.items.length === 0 && !loading ? (
            <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <p className="text-lg font-semibold">No hay ofertas con estos filtros</p>
              <p className="max-w-md text-sm text-muted">
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
            <div className={`space-y-3 sm:space-y-4 ${loading ? "opacity-60" : ""}`}>
              {/* Página 1: las dos mejores en horizontal, lado a lado; luego la rejilla. */}
              {catalog.page === 1 && catalog.items.length > 2 && (
                <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                  {catalog.items.slice(0, 2).map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      view="grid"
                      layout="horizontal"
                    />
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
                {(catalog.page === 1 && catalog.items.length > 2
                  ? catalog.items.slice(2)
                  : catalog.items
                ).map((product) => (
                  <ProductCard key={product.id} product={product} view="grid" />
                ))}
              </div>
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
        <div
          className="fixed inset-0 z-50 overscroll-contain lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filtros"
        >
          <button
            type="button"
            className="absolute inset-0 bg-overlay"
            onClick={() => setMobileFiltersOpen(false)}
            aria-label="Cerrar filtros"
          />
          <div className="absolute inset-y-0 left-0 w-[min(100%,320px)] overscroll-contain bg-surface shadow-2xl">
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

      {footer}
    </div>
  );
}
