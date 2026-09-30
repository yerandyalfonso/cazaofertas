import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { CategoryHero } from "@/components/CategoryHero";
import { ProductGridProgressive } from "@/components/ProductGridProgressive";
import { RelatedArticles } from "@/components/blog/RelatedArticles";
import {
  CATEGORY_FIRST_PAGE,
  getCategories,
  getCategoryProducts,
  getCategoryShowcases,
} from "@/lib/catalog";
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
import { getArticlesForProducts } from "@/services/blog";

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
  const [categories, products, showcases] = await Promise.all([
    getCategories(),
    getCategoryProducts(slug),
    getCategoryShowcases(),
  ]);
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const filtered = products;
  const firstPage = filtered.slice(0, CATEGORY_FIRST_PAGE);
  const copy = categorySeoCopy(category.slug, category.name);
  const intro = category.description?.trim() || copy.intro;
  const subcategories = PRODUCT_SUBCATEGORIES.filter(
    (sub) => sub.parentSlug === slug,
  );
  const articles = await getArticlesForProducts(
    filtered.map((product) => product.slug),
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
            items: firstPage.map((product) => ({
              name: product.title,
              path: `/producto/${product.slug}`,
            })),
          }),
        ]}
      />

      <CategoryHero
        rootSlug={category.slug}
        rootName={category.name}
        title={category.name}
        intro={intro}
        count={Math.max(showcases.get(slug)?.count ?? 0, filtered.length)}
        activeSub={null}
        crumbs={[
          { name: "Inicio", href: "/" },
          { name: "Categorías", href: "/categorias" },
          { name: category.name },
        ]}
        subcategories={subcategories.map((sub) => ({
          name: sub.name,
          slug: sub.slug,
          href: categoryPublicPath(category.slug, sub.slug),
        }))}
      />

      {articles.length > 0 ? (
        <section className="mt-12">
          <RelatedArticles
            posts={articles}
            title={`Del blog sobre ${category.name.toLowerCase()}`}
          />
        </section>
      ) : null}

      <section className={articles.length > 0 ? "mt-16 border-t border-stone-300 pt-12" : "mt-12"}>
        {filtered.length > 0 ? (
          <ProductGridProgressive
            products={firstPage}
            total={filtered.length}
            categorySlug={category.slug}
          />
        ) : (
          <p className="text-sm text-stone-600">
            Todavía no hay productos activos en esta categoría. Vuelve pronto o
            crea una alerta para enterarte al momento.
          </p>
        )}
      </section>

      <section className="mt-20 max-w-3xl border-t border-stone-300 pt-8">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Cómo elegimos estas ofertas
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          {copy.howWePick}
        </p>
      </section>
    </div>
  );
}
