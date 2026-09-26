import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { cache } from "react";
import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { SiteFooter } from "@/components/SiteFooter";
import {
  getAlternativeProducts,
  getCategoryNodes,
  getProductBySlug as fetchProductBySlug,
} from "@/lib/catalog";
import { categoryHref, subcategoryHasPage } from "@/lib/links";
import { formatDiscount, formatEuro } from "@/lib/money";
import { RETAILER_COLORS, retailerLabel } from "@/lib/retailers";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { DealLevel, type MarketplaceProduct } from "@/lib/types";

// generateMetadata y la página comparten una sola consulta por petición.
const getProductBySlug = cache(fetchProductBySlug);

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

function dealBadgeClass(level: DealLevel): string {
  switch (level) {
    case DealLevel.HISTORICAL_LOW:
      return "badge-historic";
    case DealLevel.GREAT_DEAL:
      return "badge-great";
    default:
      return "badge-deal";
  }
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function productSeoTitle(product: MarketplaceProduct): string {
  const discount =
    product.discountPercentage >= 1
      ? ` −${Math.round(product.discountPercentage)}%`
      : "";
  return `${truncate(product.title, 60)}${discount} a ${formatEuro(product.currentPrice)} en ${retailerLabel(product.retailer)}`;
}

function productSeoDescription(product: MarketplaceProduct): string {
  const before =
    product.previousPrice && product.previousPrice > product.currentPrice
      ? ` (antes ${formatEuro(product.previousPrice)})`
      : "";
  const base = `Chollo: ${truncate(product.title, 80)} por ${formatEuro(product.currentPrice)}${before} en ${retailerLabel(product.retailer)}.`;
  return truncate(`${base} Precio comprobado y enlace directo a la oferta.`, 160);
}

function isUnavailable(product: MarketplaceProduct): boolean {
  if (!product.isActive || product.availability === "OUT_OF_STOCK") return true;
  return Boolean(
    product.expiresAt && new Date(product.expiresAt).getTime() <= Date.now(),
  );
}

function productJsonLd(product: MarketplaceProduct, url: string) {
  const categoryPath = [product.category?.parentName, product.category?.name]
    .filter((part, i, all): part is string => Boolean(part) && all.indexOf(part) === i);
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    url,
    price: product.currentPrice.toFixed(2),
    priceCurrency: "EUR",
    availability: !product.isActive
      ? "https://schema.org/Discontinued"
      : isUnavailable(product)
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@type": "Organization", name: retailerLabel(product.retailer) },
  };
  if (product.expiresAt) offer.priceValidUntil = product.expiresAt.slice(0, 10);

  return [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.title,
      ...(product.imageUrl ? { image: [product.imageUrl] } : {}),
      ...(product.description ? { description: truncate(product.description, 500) } : {}),
      ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
      ...(categoryPath.length ? { category: categoryPath.join(" > ") } : {}),
      offers: offer,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: SITE_NAME, url: absoluteUrl("/") },
        ...categoryPath.map((name) => ({ name })),
        { name: truncate(product.title, 80), url },
      ].map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        ...("url" in item && item.url ? { item: item.url } : {}),
      })),
    },
  ];
}

/** Migas de la ficha: categoría y subcategoría, enlazadas si tienen página. */
async function productBreadcrumbs(
  product: MarketplaceProduct,
): Promise<Array<{ name: string; href: string | null }>> {
  const category = product.category;
  if (!category) return [];
  if (!category.parentSlug || category.parentSlug === category.slug) {
    return [{ name: category.name, href: categoryHref(category.slug) }];
  }

  const parentSlug = category.parentSlug;
  const node = (await getCategoryNodes()).find((n) => n.id === category.id);
  return [
    { name: category.parentName ?? category.name, href: categoryHref(parentSlug) },
    {
      name: category.name,
      href:
        node && subcategoryHasPage(node, parentSlug)
          ? categoryHref(parentSlug, category.slug)
          : null,
    },
  ].filter((item, i, all) => all.findIndex((x) => x.name === item.name) === i);
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Oferta no encontrada", robots: { index: false } };

  const url = absoluteUrl(`/oferta/${product.slug}`);
  const title = productSeoTitle(product);
  const description = productSeoDescription(product);
  const images = product.imageUrl ? [{ url: product.imageUrl, alt: product.title }] : [];
  return {
    title,
    description,
    alternates: { canonical: url },
    // Retirada: fuera del índice, pero Google sigue los enlaces a alternativas.
    ...(product.isActive ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      locale: "es_ES",
      title,
      description,
      images,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const unavailable = isUnavailable(product);
  const alternatives = unavailable ? await getAlternativeProducts(product) : [];
  const jsonLd = productJsonLd(product, absoluteUrl(`/oferta/${product.slug}`));

  const retailerColor = RETAILER_COLORS[product.retailer] ?? "#4f7f6a";
  const savings =
    product.previousPrice && product.previousPrice > product.currentPrice
      ? product.previousPrice - product.currentPrice
      : null;
  const categoryPath = await productBreadcrumbs(product);

  return (
    <div className="marketplace-shell bg-[var(--bg)]">
      <script
        type="application/ld+json"
        // JSON escapado para que "</script>" en un título no rompa la página.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="btn btn-ghost text-sm">
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          {categoryPath.length > 0 && (
            <nav
              className="flex min-w-0 flex-1 items-center gap-1 text-xs text-[var(--text-muted)]"
              aria-label="Categoría"
            >
              {categoryPath.map((part, i) => (
                <span key={part.name} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                  {part.href ? (
                    <Link href={part.href} className="truncate hover:text-[var(--text)]">
                      {part.name}
                    </Link>
                  ) : (
                    <span className="truncate">{part.name}</span>
                  )}
                </span>
              ))}
            </nav>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6 md:py-8">
        <article className="card overflow-hidden">
          <div className="grid md:grid-cols-[minmax(0,340px)_1fr] md:divide-x md:divide-[var(--border)]">
            {/* Imagen */}
            <div className="relative border-b border-[var(--border)] bg-white p-6 md:border-b-0">
              <div className="relative mx-auto aspect-square max-w-[300px]">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.title}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 80vw, 300px"
                    priority
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
                    Sin imagen
                  </div>
                )}
                {product.discountPercentage > 0 && (
                  <span
                    className={`badge absolute left-0 top-0 shadow-sm ${dealBadgeClass(product.dealLevel)}`}
                  >
                    {formatDiscount(product.discountPercentage)}
                  </span>
                )}
              </div>
            </div>

            {/* Info + compra */}
            <div className="flex flex-col p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="badge text-white"
                  style={{ backgroundColor: retailerColor }}
                >
                  {retailerLabel(product.retailer)}
                </span>
                <span className={`badge ${dealBadgeClass(product.dealLevel)}`}>
                  {product.dealLabel}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {product.dealScore} pts
                </span>
              </div>

              <h1 className="mt-4 text-xl font-bold leading-snug text-[var(--text)] md:text-2xl">
                {product.title}
              </h1>

              {product.brand && (
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Marca: {product.brand}
                </p>
              )}

              <div className="mt-6 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                  <span className="text-3xl font-bold text-[var(--primary)]">
                    {formatEuro(product.currentPrice)}
                  </span>
                  {product.previousPrice &&
                    product.previousPrice > product.currentPrice && (
                      <span className="text-base text-[var(--text-muted)] line-through">
                        {formatEuro(product.previousPrice)}
                      </span>
                    )}
                </div>

                {savings !== null && savings > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[var(--primary)]">
                    <TrendingDown className="h-4 w-4" />
                    Ahorras {formatEuro(savings)}
                  </p>
                )}

                {product.lowestPrice && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--primary)]" />
                    Mínimo registrado: {formatEuro(product.lowestPrice)}
                    {product.currentPrice <= product.lowestPrice * 1.02 &&
                      " — precio histórico"}
                  </p>
                )}
              </div>

              {unavailable ? (
                <>
                  <p className="mt-6 flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text)]">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                    {product.isActive
                      ? "Esta oferta está agotada o ha caducado. El precio mostrado es el último que comprobamos."
                      : "Esta oferta ya no está disponible. El precio mostrado es el último que comprobamos."}
                  </p>
                  {alternatives.length > 0 && (
                    <a
                      href="#alternativas"
                      className="btn btn-primary mt-4 w-full py-3.5 text-base"
                    >
                      Ver ofertas similares
                    </a>
                  )}
                </>
              ) : (
                <>
                  <a
                    href={product.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="btn btn-primary mt-6 w-full py-3.5 text-base"
                  >
                    Ver oferta en {retailerLabel(product.retailer)}
                    <ExternalLink className="h-4 w-4" />
                  </a>

                  <p className="mt-3 text-center text-[11px] text-[var(--text-muted)]">
                    Enlace de afiliado · El precio puede variar en la tienda
                  </p>
                </>
              )}
            </div>
          </div>

          {product.description && (
            <div className="border-t border-[var(--border)] px-6 py-6 md:px-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Sobre este producto
              </h2>
              <div className="product-description text-sm leading-relaxed text-[var(--text)]">
                {product.description}
              </div>
            </div>
          )}
        </article>

        {alternatives.length > 0 && (
          <section id="alternativas" className="mt-8 scroll-mt-4">
            <h2 className="mb-4 text-lg font-bold text-[var(--text)]">
              Ofertas similares disponibles
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {alternatives.map((alternative) => (
                <ProductCard key={alternative.id} product={alternative} view="grid" />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />

      {/* CTA fijo en móvil */}
      {!unavailable && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:hidden">
            <div className="mx-auto flex max-w-4xl items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {retailerLabel(product.retailer)}
                </p>
                <p className="text-lg font-bold text-[var(--primary)]">
                  {formatEuro(product.currentPrice)}
                  {product.discountPercentage > 0 && (
                    <span className="ml-2 text-xs font-semibold text-[var(--text-muted)]">
                      {formatDiscount(product.discountPercentage)}
                    </span>
                  )}
                </p>
              </div>
              <a
                href={product.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="btn btn-primary shrink-0"
              >
                Comprar
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="h-20 md:hidden" aria-hidden />
        </>
      )}
    </div>
  );
}
