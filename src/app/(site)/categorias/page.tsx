import type { Metadata } from "next";
import { CategoryShowcaseGrid } from "@/components/CategoryShowcaseGrid";
import { getCategories, getCategoryShowcases } from "@/lib/catalog";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Categorías de ofertas Amazon",
    description:
      "Explora ofertas por categoría: tecnología, hogar, moda, bebé, belleza y más.",
    path: "/categorias",
  }),
};

export const revalidate = 300;

export default async function CategoriesPage() {
  const [categories, showcases] = await Promise.all([
    getCategories(),
    getCategoryShowcases(),
  ]);
  const total = [...showcases.values()].reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
          Categorías
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
          Compra por categoría
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          {total > 0
            ? `${total} ofertas activas repartidas en ${categories.length} secciones. Elige una para ver sus ofertas y los artículos del blog relacionados.`
            : "Elige una sección para ver sus ofertas y los artículos del blog relacionados."}
        </p>
      </header>

      {categories.length > 0 ? (
        <div className="mt-12">
          <CategoryShowcaseGrid categories={categories} showcases={showcases} />
        </div>
      ) : (
        <p className="mt-10 text-sm text-stone-600">
          No hay categorías todavía. Vuelve pronto o revisa las ofertas
          activas.
        </p>
      )}
    </div>
  );
}
