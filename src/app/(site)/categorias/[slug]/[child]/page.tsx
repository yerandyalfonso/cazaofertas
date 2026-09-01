import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { getCategories, getOfferListingProducts } from "@/lib/catalog";
import {
  categoryPublicPath,
  getBlogCategory,
  getSubcategoryByPath,
  productMatchesSubcategory,
} from "@/lib/site-categories";
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  itemListJsonLd,
} from "@/lib/seo";
import { telegramAlertForCategorySlug } from "@/lib/telegram-links";

interface SubcategoryPageProps {
  params: Promise<{ slug: string; child: string }>;
}

export const revalidate = 60;

export async function generateMetadata({
  params,
}: SubcategoryPageProps): Promise<Metadata> {
  const { slug, child } = await params;
  const sub = getSubcategoryByPath(slug, child);
  if (!sub) {
    return {
      title: "Categoría no encontrada",
      robots: { index: false, follow: true },
    };
  }
  const parent = getBlogCategory(slug);
  if (!sub || !parent) {
    return {
      title: "Categoría no encontrada",
      robots: { index: false, follow: true },
    };
  }

  const title = `Ofertas de ${sub.name} · ${parent.name}`;
  return buildPageMetadata({
    title,
    description: `Chollos y ofertas de ${sub.name.toLowerCase()} en ${parent.name.toLowerCase()}.`,
    path: categoryPublicPath(parent.slug, sub.slug),
  });
}

export default async function SubcategoryDetailPage({
  params,
}: SubcategoryPageProps) {
  const { slug, child } = await params;
  const sub = getSubcategoryByPath(slug, child);
  if (!sub) notFound();
  const parent = getBlogCategory(slug);
  if (!sub || !parent) notFound();

  const [categories, products] = await Promise.all([
    getCategories(),
    getOfferListingProducts(500),
  ]);
  const parentCategory = categories.find((item) => item.slug === slug);
  if (!parentCategory) notFound();

  const filtered = products
    .filter((product) =>
      productMatchesSubcategory(product.category, parent.slug, sub),
    )
    .sort((a, b) => b.dealScore - a.dealScore);

  const path = categoryPublicPath(parent.slug, sub.slug);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: "Categorías", path: "/categorias" },
            { name: parent.name, path: `/categorias/${parent.slug}` },
            { name: sub.name, path },
          ]),
          itemListJsonLd({
            name: `Ofertas de ${sub.name}`,
            path,
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
        <Link href={`/categorias/${parent.slug}`} className="hover:text-ink">
          {parent.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{sub.name}</span>
      </nav>

      <header className="max-w-3xl">
        <p className="text-sm font-medium text-stone-500">{parent.name}</p>
        <h1 className="mt-1 font-display text-4xl tracking-tight text-ink md:text-5xl">
          Ofertas de {sub.name}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          Productos clasificados en {sub.name.toLowerCase()} dentro de{" "}
          {parent.name.toLowerCase()}.
        </p>
        <a
          href={telegramAlertForCategorySlug(parent.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-10 items-center bg-ink px-4 text-xs font-semibold uppercase tracking-[0.12em] text-paper"
        >
          Alerta Telegram · {parent.name}
        </a>
      </header>

      {filtered.length > 0 ? (
        <div className="mt-12 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-sm text-stone-600">
          Todavía no hay productos en esta subcategoría.
        </p>
      )}
    </div>
  );
}
