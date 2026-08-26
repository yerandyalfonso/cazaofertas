import type { Metadata } from "next";
import { DealCard } from "@/components/DealCard";
import { getActiveProducts, getTopDealProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Ofertas",
  description: "Chollos de Amazon España ordenados por deal score.",
};

export const revalidate = 300;

export default async function OffersPage() {
  const [topDeals, products] = await Promise.all([
    getTopDealProducts(12),
    getActiveProducts(24),
  ]);
  const list = topDeals.length > 0 ? topDeals : products;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
          Ofertas
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
          Chollos con mejor puntuación
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          Ordenados por deal score: descuento, cercanía al mínimo histórico y
          estabilidad de precio.
        </p>
      </header>

      {list.length > 0 ? (
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((product, index) => (
            <DealCard
              key={product.id}
              product={product}
              featured={index === 0}
            />
          ))}
        </div>
      ) : (
        <p className="mt-12 border border-dashed border-stone-300 bg-white/70 px-5 py-8 text-sm text-stone-600">
          No hay ofertas todavía. Ejecuta el seed para poblar el catálogo.
        </p>
      )}
    </div>
  );
}
