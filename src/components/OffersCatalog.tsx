"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { CatalogProduct } from "@/lib/catalog";
import { retailerViewCtaLabel } from "@/lib/retailers";
import { DealLevel } from "@/types";

interface OffersCatalogProps {
  products: CatalogProduct[];
  categories: Array<{ slug: string; name: string }>;
}

const DISCOUNT_OPTIONS = [
  { value: 0, label: "Cualquier descuento" },
  { value: 10, label: "10 % o más" },
  { value: 20, label: "20 % o más" },
  { value: 30, label: "30 % o más" },
  { value: 50, label: "50 % o más" },
] as const;

const PAGE_SIZE = 24;

export function OffersCatalog({ products, categories }: OffersCatalogProps) {
  const [category, setCategory] = useState<string>("all");
  const [onlyHistorical, setOnlyHistorical] = useState(false);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          (category === "all" ||
            // Las pestañas son categorías raíz; el producto guarda su subcategoría.
            (product.category?.parentSlug ?? product.category?.slug) ===
              category) &&
          (!onlyHistorical ||
            product.dealLevel === DealLevel.HISTORICAL_LOW) &&
          (minDiscount === 0 || product.discountPercentage >= minDiscount),
      ),
    [products, category, onlyHistorical, minDiscount],
  );

  // Solo pestañas de categorías con alguna oferta en el listado.
  const rootSlugs = useMemo(
    () =>
      new Set(
        products.map(
          (product) => product.category?.parentSlug ?? product.category?.slug,
        ),
      ),
    [products],
  );
  const tabs = categories.filter((cat) => rootSlugs.has(cat.slug));

  const hasMore = visible < filtered.length;
  const hasActiveFilters =
    category !== "all" || onlyHistorical || minDiscount > 0;

  // Carga progresiva: 24 ofertas más al acercarse al final.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible((count) => count + PAGE_SIZE);
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visible]);

  // Al cambiar un filtro: volver a la primera página y al inicio del listado.
  function applyFilter(update: () => void) {
    update();
    setVisible(PAGE_SIZE);
    const top = topRef.current;
    if (top && top.getBoundingClientRect().top < 0) {
      top.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function clearFilters() {
    applyFilter(() => {
      setCategory("all");
      setOnlyHistorical(false);
      setMinDiscount(0);
    });
  }

  const tabClass = (on: boolean) =>
    `shrink-0 border-b-2 py-3 text-sm transition-colors ${
      on
        ? "border-ink font-semibold text-ink"
        : "border-transparent text-stone-600 hover:text-ink"
    }`;

  return (
    <div ref={topRef} className="mt-10 scroll-mt-28">
      {/* Barra de filtros fija bajo la cabecera */}
      <div className="sticky top-14 z-30 -mx-5 border-y border-stone-300/80 bg-paper/95 px-5 backdrop-blur md:top-20 md:-mx-8 md:px-8">
        <div
          role="tablist"
          aria-label="Filtrar por categoría"
          className="flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            role="tab"
            aria-selected={category === "all"}
            onClick={() => applyFilter(() => setCategory("all"))}
            className={tabClass(category === "all")}
          >
            Todas
          </button>
          {tabs.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              role="tab"
              aria-selected={category === cat.slug}
              onClick={() => applyFilter(() => setCategory(cat.slug))}
              className={tabClass(category === cat.slug)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-200 py-2.5">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <span className="sr-only">Descuento mínimo</span>
            <select
              id="offers-min-discount"
              value={minDiscount}
              onChange={(event) =>
                applyFilter(() => setMinDiscount(Number(event.target.value)))
              }
              className="h-9 cursor-pointer border border-stone-300 bg-white pl-3 pr-8 text-sm text-ink outline-none transition hover:border-ink focus-visible:border-ink"
            >
              {DISCOUNT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-600 hover:text-ink">
            <input
              id="offers-historical"
              type="checkbox"
              checked={onlyHistorical}
              onChange={(event) =>
                applyFilter(() => setOnlyHistorical(event.target.checked))
              }
              className="h-4 w-4 accent-ink"
            />
            Solo precios más bajos
          </label>

          <p className="ml-auto text-sm text-stone-500" aria-live="polite">
            <span className="font-medium tabular-nums text-ink">
              {filtered.length}
            </span>{" "}
            {filtered.length === 1 ? "oferta" : "ofertas"}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-stone-500 underline underline-offset-4 hover:text-ink"
            >
              Quitar filtros
            </button>
          ) : null}
        </div>
      </div>

      {filtered.length > 0 ? (
        <>
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {filtered.slice(0, visible).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                showBuyButton
                buyLabel={retailerViewCtaLabel(product.retailer)}
                clickSource="deal_card"
              />
            ))}
          </div>
          {hasMore ? (
            <div
              ref={sentinelRef}
              className="mt-14 flex flex-col items-center gap-3 border-t border-stone-300 pt-8"
            >
              <button
                type="button"
                onClick={() => setVisible((count) => count + PAGE_SIZE)}
                className="h-12 border border-ink px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
              >
                Cargar más ofertas
              </button>
              <p className="text-sm text-stone-500">
                Mostrando {visible} de {filtered.length}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-10 border border-dashed border-stone-300 bg-white/70 px-5 py-8 text-sm text-stone-600">
          No hay ofertas con esos filtros. Prueba otra categoría o baja el
          descuento mínimo.
        </p>
      )}
    </div>
  );
}
