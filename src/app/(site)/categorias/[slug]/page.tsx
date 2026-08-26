import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/ProductCard";
import { getActiveProducts, getCategories } from "@/lib/catalog";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  return {
    title: category?.name ?? "Categoría",
    description: category?.description ?? undefined,
  };
}

export default async function CategoryDetailPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [categories, products] = await Promise.all([
    getCategories(),
    getActiveProducts(40),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const filtered = products.filter(
    (product) => product.category?.slug === slug,
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <nav className="mb-8 text-sm text-stone-500">
        <Link href="/categorias" className="hover:text-ink">
          Categorías
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <header className="max-w-2xl">
        <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
          {category.name}
        </h1>
        {category.description ? (
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            {category.description}
          </p>
        ) : null}
      </header>

      {filtered.length > 0 ? (
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-sm text-stone-600">
          No hay productos activos en esta categoría.
        </p>
      )}
    </div>
  );
}
