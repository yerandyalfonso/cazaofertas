import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { CategoryHero } from "@/components/CategoryHero";
import { ProductGridProgressive } from "@/components/ProductGridProgressive";
import { getCategories, getCategoryProducts } from "@/lib/catalog";
import {
  categoryPublicPath,
  getBlogCategory,
  getSubcategoryByPath,
  productMatchesSubcategory,
  PRODUCT_SUBCATEGORIES,
} from "@/lib/site-categories";
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  itemListJsonLd,
} from "@/lib/seo";

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
    description: `Ofertas de ${sub.name.toLowerCase()} en ${parent.name.toLowerCase()}.`,
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
    getCategoryProducts(slug),
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

      <CategoryHero
        rootSlug={parent.slug}
        rootName={parent.name}
        title={sub.name}
        intro={`Ofertas de ${sub.name.toLowerCase()} dentro de ${parent.name.toLowerCase()}, ordenadas por descuento real.`}
        count={filtered.length}
        activeSub={sub.slug}
        crumbs={[
          { name: "Inicio", href: "/" },
          { name: "Categorías", href: "/categorias" },
          { name: parent.name, href: `/categorias/${parent.slug}` },
          { name: sub.name },
        ]}
        subcategories={PRODUCT_SUBCATEGORIES.filter(
          (item) => item.parentSlug === parent.slug,
        ).map((item) => ({
          name: item.name,
          slug: item.slug,
          href: categoryPublicPath(parent.slug, item.slug),
        }))}
      />

      <section className="mt-12">
        {filtered.length > 0 ? (
          <ProductGridProgressive products={filtered} />
        ) : (
          <p className="text-sm text-stone-600">
            Todavía no hay productos en esta subcategoría.{" "}
            <Link
              href={`/categorias/${parent.slug}`}
              className="text-ink underline underline-offset-4"
            >
              Ver todo {parent.name.toLowerCase()}
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
