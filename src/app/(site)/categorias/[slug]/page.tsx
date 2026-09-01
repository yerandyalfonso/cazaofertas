import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { getCategories, getOfferListingProducts } from "@/lib/catalog";
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  categorySeoCopy,
  itemListJsonLd,
} from "@/lib/seo";
import {
  categoryPublicPath,
  PRODUCT_SUBCATEGORIES,
} from "@/lib/site-categories";
import { telegramAlertForCategorySlug } from "@/lib/telegram-links";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

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
  if (!category) {
    return {
      title: "Categoría no encontrada",
      robots: { index: false, follow: true },
    };
  }

  const copy = categorySeoCopy(category.slug, category.name);
  const description =
    category.description?.trim() ||
    copy.intro.slice(0, 160);

  return buildPageMetadata({
    title: `Ofertas de ${category.name} en Amazon`,
    description,
    path: `/categorias/${slug}`,
  });
}

export default async function CategoryDetailPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [categories, products] = await Promise.all([
    getCategories(),
    getOfferListingProducts(250),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const filtered = products
    .filter(
      (product) =>
        product.category?.parentSlug === slug || product.category?.slug === slug,
    )
    .sort((a, b) => b.dealScore - a.dealScore);
  const copy = categorySeoCopy(category.slug, category.name);
  const intro = category.description?.trim() || copy.intro;
  const subcategories = PRODUCT_SUBCATEGORIES.filter(
    (sub) => sub.parentSlug === slug,
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: "Categorías", path: "/categorias" },
            { name: category.name, path: `/categorias/${category.slug}` },
          ]),
          itemListJsonLd({
            name: `Ofertas de ${category.name}`,
            path: `/categorias/${category.slug}`,
            items: filtered.map((product) => ({
              name: product.title,
              path: `/producto/${product.slug}`,
            })),
          }),
        ]}
      />

      <nav className="mb-8 text-sm text-stone-500" aria-label="Migas de pan">
        <Link href="/categorias" className="hover:text-ink">
          Categorías
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{category.name}</span>
      </nav>

      <header className="max-w-3xl">
        <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
          Ofertas de {category.name}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">{intro}</p>
      </header>

      <section className="mt-8 max-w-3xl border-t border-stone-300 pt-8">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Cómo elegimos estas ofertas
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          {copy.howWePick}
        </p>
        <a
          href={telegramAlertForCategorySlug(category.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-10 items-center bg-ink px-4 text-xs font-semibold uppercase tracking-[0.12em] text-paper"
        >
          Alerta Telegram · {category.name}
        </a>
      </section>

      {subcategories.length > 0 ? (
        <nav
          className="mt-10 flex flex-wrap gap-2"
          aria-label="Subcategorías"
        >
          {subcategories.map((sub) => (
            <Link
              key={`${category.slug}-${sub.slug}`}
              href={categoryPublicPath(category.slug, sub.slug)}
              className="border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-ink hover:text-ink"
            >
              {sub.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {filtered.length > 0 ? (
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-sm text-stone-600">
          Todavía no hay productos activos en esta categoría. Vuelve pronto o
          crea una alerta para enterarte al momento.
        </p>
      )}
    </div>
  );
}
