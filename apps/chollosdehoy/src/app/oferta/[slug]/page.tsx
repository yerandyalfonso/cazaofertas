import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BellRing,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Send,
  Zap,
} from "lucide-react";
import { cache, type ReactNode } from "react";
import type { Metadata } from "next";
import { FillImage } from "@/components/FillImage";
import { PrimeTag } from "@/components/PrimeTag";
import { ProductCard } from "@/components/ProductCard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  getAlternativeProducts,
  getCategoryNodes,
  getProductBySlug as fetchProductBySlug,
  getProductVariants,
} from "@/lib/catalog";
import { categoryHref, subcategoryHasPage } from "@/lib/links";
import { formatDiscount, formatEuro } from "@/lib/money";
import { retailerColor, retailerLabel } from "@/lib/retailers";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { TELEGRAM_GROUP_URL, telegramAlertForAsin } from "@/lib/telegram";
import { parseProductDescription, type DescriptionItem } from "@/lib/description";
import { flashDealLabel } from "@/lib/flash";
import type { MarketplaceProduct } from "@/lib/types";

// generateMetadata y la página comparten una sola consulta por petición.
const getProductBySlug = cache(fetchProductBySlug);

interface ProductPageProps {
  params: Promise<{ slug: string }>;
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
  const [alternatives, { items: variants, total: variantTotal }] = await Promise.all([
    unavailable ? getAlternativeProducts(product) : [],
    getProductVariants(product),
  ]);
  const jsonLd = productJsonLd(product, absoluteUrl(`/oferta/${product.slug}`));

  const savings =
    product.previousPrice && product.previousPrice > product.currentPrice
      ? product.previousPrice - product.currentPrice
      : null;
  const categoryPath = await productBreadcrumbs(product);

  // La opción actual siempre visible (primera), el resto por precio.
  const orderedVariants = [
    ...variants.filter((variant) => variant.id === product.id),
    ...variants.filter((variant) => variant.id !== product.id),
  ];
  const descriptionItems = parseProductDescription(product.description);
  const featured = descriptionItems.slice(0, 5);
  const rest = descriptionItems.slice(5);
  const flashLabel = unavailable ? null : flashDealLabel(product.expiresAt);
  const retailer = retailerLabel(product.retailer);
  const details: Array<{ label: string; value: ReactNode }> = [
    ...(product.brand ? [{ label: "Marca", value: product.brand }] : []),
    { label: "Tienda", value: retailer },
    ...(categoryPath.length > 0
      ? [
          {
            label: "Categoría",
            value: categoryPath.map((part, i) => (
              <span key={part.name}>
                {i > 0 && " › "}
                {part.href ? (
                  <Link href={part.href} className="tap-link underline-offset-2 hover:underline">
                    {part.name}
                  </Link>
                ) : (
                  part.name
                )}
              </span>
            )),
          },
        ]
      : []),
    {
      label: "Disponibilidad",
      value: !product.isActive
        ? "Retirado"
        : unavailable
          ? "Agotado o caducado"
          : "Disponible",
    },
    { label: "Referencia", value: product.asin },
  ];

  return (
    <div className="marketplace-shell bg-page">
      <SiteHeader />
      <script
        type="application/ld+json"
        // JSON escapado para que "</script>" en un título no rompa la página.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <nav
        aria-label="Migas de pan"
        className="mx-auto flex max-w-[1600px] items-center gap-1.5 px-4 pt-5 text-xs text-muted"
      >
        <Link href="/" className="tap-link hover:text-ink">
          Inicio
        </Link>
        {categoryPath.map((part) => (
          <span key={part.name} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-3 w-3 shrink-0" />
            {part.href ? (
              <Link href={part.href} className="tap-link truncate hover:text-ink">
                {part.name}
              </Link>
            ) : (
              <span className="truncate">{part.name}</span>
            )}
          </span>
        ))}
      </nav>

      <main id="contenido" className="mx-auto max-w-[1600px] px-4 pb-10 pt-4">
        <article className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-10 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
          {/* Imagen */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="relative aspect-square overflow-hidden rounded-card border border-line bg-white">
              <FillImage
                src={product.imageUrl}
                alt={product.title}
                sizes="(max-width: 768px) 92vw, 480px"
                padding="p-8"
                priority
              />
              {!unavailable && product.discountPercentage >= 1 && (
                <span className="badge badge-deal badge-lg absolute left-4 top-4 z-10 shadow-sm">
                  {formatDiscount(product.discountPercentage)}
                </span>
              )}
            </div>
          </div>

          {/* Compra */}
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span translate="no" className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: retailerColor(product.retailer) }}
                />
                {retailer}
              </span>
              {product.brand && product.brand.toLowerCase() !== retailer.toLowerCase() && (
                <span>Marca: {product.brand}</span>
              )}
            </p>
            <h1 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-ink md:text-[1.6rem]">
              {product.title}
            </h1>

            {flashLabel && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                {flashLabel && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-urgent-soft px-2.5 py-1 text-urgent-strong">
                    <Zap className="h-3.5 w-3.5" aria-hidden />
                    {flashLabel}
                  </span>
                )}
              </div>
            )}

            <div className="mt-6 border-y border-line py-5">
              {unavailable && (
                <p className="mb-1 text-xs font-medium text-muted">Último precio comprobado</p>
              )}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={`price text-[2.5rem] font-extrabold leading-none tracking-tight ${unavailable ? "text-muted" : "text-ink"}`}>
                  {formatEuro(product.currentPrice)}
                </span>
                {product.primeOnly && !unavailable && <PrimeTag className="self-center text-xs" />}
                {!unavailable &&
                  product.previousPrice &&
                  product.previousPrice > product.currentPrice && (
                    <span className="price text-base text-muted line-through">
                      {formatEuro(product.previousPrice)}
                    </span>
                  )}
              </div>
              {!unavailable && savings !== null && savings > 0 && (
                <p className="price mt-2 text-sm font-semibold text-primary">
                  Ahorras {formatEuro(savings)}
                </p>
              )}
              {!unavailable && product.primeOnly && (
                <p className="price mt-1.5 text-sm text-muted">
                  Precio de oferta para clientes Prime
                  {product.regularPrice ? ` · sin Prime: ${formatEuro(product.regularPrice)}` : ""}
                </p>
              )}
            </div>

            {unavailable ? (
              <>
                <p className="mt-6 flex items-start gap-2 text-sm text-muted">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {product.isActive
                    ? "Esta oferta está agotada o ha caducado. El precio mostrado es el último que comprobamos."
                    : "Esta oferta ya no está disponible. El precio mostrado es el último que comprobamos."}
                </p>
                {alternatives.length > 0 && (
                  <a href="#alternativas" className="btn btn-outline-gradient btn-lg mt-4 w-full">
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
                  className="btn btn-outline-gradient btn-lg mt-6 w-full"
                >
                  Ver en {retailer}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </>
            )}

            {variants.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-medium text-ink">
                  Opciones
                  <span className="ml-1.5 font-normal text-muted">
                    {variants.length < variantTotal
                      ? `${variants.length} de ${variantTotal}`
                      : variantTotal}
                  </span>
                </h2>
                <VariantList variants={orderedVariants.slice(0, VISIBLE_VARIANTS)} currentId={product.id} />
                {variants.length > VISIBLE_VARIANTS && (
                  <details className="group mt-2">
                    <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline">
                      <span className="group-open:hidden">Ver las {variants.length} opciones</span>
                      <span className="hidden group-open:inline">Ver menos</span>
                    </summary>
                    <VariantList variants={orderedVariants.slice(VISIBLE_VARIANTS)} currentId={product.id} />
                  </details>
                )}
              </div>
            )}

            <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
              <a
                href={telegramAlertForAsin(product.asin)}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-link inline-flex items-center gap-1.5 font-medium text-ink hover:underline"
              >
                <BellRing className="h-4 w-4" />
                Avísame si baja de precio
              </a>
              <a
                href={TELEGRAM_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-link inline-flex items-center gap-1.5 hover:text-ink hover:underline"
              >
                <Send className="h-4 w-4" />
                Grupo de Telegram
              </a>
            </p>
          </div>
        </article>

        {(descriptionItems.length > 0 || details.length > 0) && (
          <div className="mt-12 grid gap-10 border-t border-line pt-10 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {descriptionItems.length > 0 ? (
              <section>
                <h2 className="text-lg font-semibold text-ink">Descripción</h2>
                <DescriptionList items={featured} />
                {rest.length > 0 && (
                  <details className="group mt-4">
                    <summary className="cursor-pointer list-none text-sm font-medium text-primary hover:underline">
                      <span className="group-open:hidden">Ver descripción completa</span>
                      <span className="hidden group-open:inline">Ver menos</span>
                    </summary>
                    <DescriptionList items={rest} />
                  </details>
                )}
              </section>
            ) : (
              <div />
            )}

            <section>
              <h2 className="text-lg font-semibold text-ink">Detalles del producto</h2>
              <dl className="mt-4 divide-y divide-line border-y border-line text-sm">
                {details.map((row) => (
                  <div key={row.label} className="grid grid-cols-[7.5rem_1fr] gap-3 py-2.5">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className="min-w-0 break-words text-ink">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}

        {alternatives.length > 0 && (
          <section id="alternativas" className="mt-12 scroll-mt-4">
            <h2 className="mb-4 text-lg font-semibold text-ink">
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
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface px-4 py-3 md:hidden">
            <div className="mx-auto flex max-w-[1600px] items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="price text-xl font-extrabold leading-tight text-ink">
                  {formatEuro(product.currentPrice)}
                  {product.primeOnly && <PrimeTag className="ml-2 align-middle" />}
                  {product.previousPrice && product.previousPrice > product.currentPrice && (
                    <span className="ml-2 text-sm font-medium text-muted line-through">
                      {formatEuro(product.previousPrice)}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">en {retailer}</p>
              </div>
              <a
                href={product.affiliateUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="btn btn-outline-gradient shrink-0"
              >
                Ver oferta
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

const VISIBLE_VARIANTS = 8;

function VariantList({
  variants,
  currentId,
}: {
  variants: MarketplaceProduct[];
  currentId: string;
}) {
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {variants.map((variant) => {
        const current = variant.id === currentId;
        const label = variant.variantLabel ?? truncate(variant.title, 40);
        const className = `flex flex-col rounded-control border px-3 py-2 text-left text-sm transition ${
          current
            ? "border-ink bg-surface"
            : "border-line bg-surface hover:border-line-strong"
        }`;
        const body = (
          <>
            <span className="font-medium text-ink">{label}</span>
            <span className="text-xs text-muted">
              {formatEuro(variant.currentPrice)}
            </span>
          </>
        );
        return (
          <li key={variant.id}>
            {current ? (
              <span className={className} aria-current="true">
                {body}
              </span>
            ) : (
              <Link href={`/oferta/${variant.slug}`} className={className}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function DescriptionList({ items }: { items: DescriptionItem[] }) {
  return (
    <ul className="mt-4 space-y-3 text-[0.95rem] leading-relaxed text-ink">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
          <span className="max-w-[68ch]">
            {item.title && <strong className="font-semibold">{item.title}. </strong>}
            {item.text}
          </span>
        </li>
      ))}
    </ul>
  );
}
