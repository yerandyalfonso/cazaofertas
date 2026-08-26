"use client";

import { useMemo, useState } from "react";
import { DealCard } from "@/components/DealCard";
import type { CatalogProduct } from "@/lib/catalog";
import { DealLevel } from "@/types";

interface OffersCatalogProps {
  products: CatalogProduct[];
  categories: Array<{ slug: string; name: string }>;
}

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

  return (
    <div>
      <div className="mt-8 flex flex-col gap-4 border border-stone-300 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={category === "all"}
            onClick={() => setCategory("all")}
            label="Todas"
          />
          {categories.map((cat) => (
            <FilterChip
              key={cat.slug}
              active={category === cat.slug}
              onClick={() => setCategory(cat.slug)}
              label={cat.name}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <FilterChip
            active={onlyHistorical}
            onClick={() => setOnlyHistorical((v) => !v)}
            label="Mínimo histórico"
          />
          <select
            value={minDiscount}
            onChange={(event) =>
              setMinDiscount(Number.parseInt(event.target.value, 10) || 0)
            }
            className="h-9 border border-stone-300 bg-white px-2 text-xs font-semibold uppercase tracking-[0.1em] text-stone-700"
            aria-label="Descuento mínimo"
          >
            <option value={0}>Cualquier %</option>
            <option value={10}>≥ 10%</option>
            <option value={20}>≥ 20%</option>
            <option value={30}>≥ 30%</option>
          </select>
        </div>
      </div>

      <p className="mt-4 text-sm text-stone-500">
        {filtered.length} oferta{filtered.length === 1 ? "" : "s"}
      </p>

      {filtered.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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

function FilterChip({
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
      onClick={onClick}
      className={`h-9 px-3 text-xs font-semibold uppercase tracking-[0.1em] transition ${
        active
          ? "bg-ink text-paper"
          : "border border-stone-300 bg-white text-stone-600 hover:border-ink hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
