"use client";

import { useMemo, useState } from "react";
import { DealCard } from "@/components/DealCard";
import type { CatalogProduct } from "@/lib/catalog";
import { DealLevel } from "@/types";

interface OffersCatalogProps {
  products: CatalogProduct[];
  categories: Array<{ slug: string; name: string }>;
}

const DISCOUNT_OPTIONS = [
  { value: 0, label: "Cualquier %" },
  { value: 10, label: "≥ 10%" },
  { value: 20, label: "≥ 20%" },
  { value: 30, label: "≥ 30%" },
] as const;

export function OffersCatalog({ products, categories }: OffersCatalogProps) {
  const [category, setCategory] = useState<string>("all");
  const [onlyHistorical, setOnlyHistorical] = useState(false);
  const [minDiscount, setMinDiscount] = useState<number>(0);

  const filtered = useMemo(() => {
    return products.filter((product) => {
      if (category !== "all" && product.category?.slug !== category) {
        return false;
      }
      if (
        onlyHistorical &&
        product.dealLevel !== DealLevel.HISTORICAL_LOW
      ) {
        return false;
      }
      if (minDiscount > 0 && product.discountPercentage < minDiscount) {
        return false;
      }
      return true;
    });
  }, [products, category, onlyHistorical, minDiscount]);

  const hasActiveFilters =
    category !== "all" || onlyHistorical || minDiscount > 0;

  function clearFilters() {
    setCategory("all");
    setOnlyHistorical(false);
    setMinDiscount(0);
  }

  return (
    <div>
      <div className="mt-10 space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Categoría
          </p>
          <div
            role="tablist"
            aria-label="Filtrar por categoría"
            className="-mx-1 mt-2.5 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
          >
            <CategoryTab
              active={category === "all"}
              onClick={() => setCategory("all")}
              label="Todas"
            />
            {categories.map((cat) => (
              <CategoryTab
                key={cat.slug}
                active={category === cat.slug}
                onClick={() => setCategory(cat.slug)}
                label={cat.name}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-stone-200/90 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Filtros
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <FilterToggle
                active={onlyHistorical}
                onClick={() => setOnlyHistorical((v) => !v)}
                label="Mínimo histórico"
                ariaPressed={onlyHistorical}
              />
              <div
                role="group"
                aria-label="Descuento mínimo"
                className="inline-flex flex-wrap items-stretch border border-stone-300 bg-white"
              >
                {DISCOUNT_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMinDiscount(option.value)}
                    aria-pressed={minDiscount === option.value}
                    className={`h-9 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
                      index > 0 ? "border-l border-stone-300" : ""
                    } ${
                      minDiscount === option.value
                        ? "bg-ink text-paper"
                        : "bg-white text-stone-600 hover:bg-stone-50 hover:text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <p className="text-sm text-stone-500">
              <span className="font-medium text-ink">{filtered.length}</span>{" "}
              oferta{filtered.length === 1 ? "" : "s"}
              {hasActiveFilters ? " con filtros" : ""}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 border border-stone-300 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-600 transition hover:border-ink hover:text-ink"
              >
                Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product, index) => (
            <DealCard
              key={product.id}
              product={product}
              featured={index === 0 && category === "all" && !onlyHistorical}
            />
          ))}
        </div>
      ) : (
        <p className="mt-8 border border-dashed border-stone-300 bg-white/70 px-5 py-8 text-sm text-stone-600">
          No hay ofertas con esos filtros. Prueba otra categoría o baja el
          descuento mínimo.
        </p>
      )}
    </div>
  );
}

function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`h-10 shrink-0 px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
        active
          ? "bg-ink text-paper shadow-[0_8px_20px_-12px_rgba(18,22,28,0.55)]"
          : "bg-white text-stone-600 ring-1 ring-inset ring-stone-300 hover:text-ink hover:ring-ink"
      }`}
    >
      {label}
    </button>
  );
}

function FilterToggle({
  label,
  active,
  onClick,
  ariaPressed,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  ariaPressed: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={ariaPressed}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2 border px-3 text-[11px] font-semibold uppercase tracking-[0.1em] transition ${
        active
          ? "border-teal-800 bg-teal-900 text-paper"
          : "border-stone-300 bg-white text-stone-600 hover:border-ink hover:text-ink"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block size-1.5 ${
          active ? "bg-amber-300" : "bg-stone-300"
        }`}
      />
      {label}
    </button>
  );
}
