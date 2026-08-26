import type { Metadata } from "next";
import Link from "next/link";
import { getCategories } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Categorías",
  description: "Explora ofertas de Amazon por categoría.",
};

export const revalidate = 300;

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
          Categorías
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
          Secciones de la revista
        </h1>
      </header>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/categorias/${category.slug}`}
            className="border border-stone-300 bg-white/80 p-6 transition hover:border-ink"
          >
            <h2 className="font-display text-2xl tracking-tight text-ink">
              {category.name}
            </h2>
            {category.description ? (
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                {category.description}
              </p>
            ) : null}
          </Link>
        ))}
      </div>

      {categories.length === 0 ? (
        <p className="mt-10 text-sm text-stone-600">
          No hay categorías todavía. Ejecuta el seed para crearlas.
        </p>
      ) : null}
    </div>
  );
}
