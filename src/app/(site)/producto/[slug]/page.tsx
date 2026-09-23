import type { Metadata } from "next";
import { RemoteImage } from "@/components/RemoteImage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { JsonLd } from "@/components/JsonLd";
import { Price } from "@/components/Price";
import { ProductStickyBuyBar } from "@/components/ProductStickyBuyBar";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import { getActiveProducts, getProductBySlug } from "@/lib/catalog";
import { formatEuro } from "@/lib/money";
import { splitProductDescription } from "@/lib/product-description";
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  productJsonLd,
} from "@/lib/seo";
import { marketplaceAbsoluteUrl } from "@/lib/site";
import { telegramAlertForAsin } from "@/lib/telegram-links";
import { retailerBuyCtaLabel, retailerLabel } from "@/lib/retailers";
import { ProductAvailability } from "@/types";

function availabilityLabel(value: ProductAvailability): string {
  switch (value) {
    case ProductAvailability.IN_STOCK:
      return "En stock";
    case ProductAvailability.OUT_OF_STOCK:
      return "Agotado";
    case ProductAvailability.PREORDER:
      return "Preventa";
    default:
      return "Sin dato";
  }
}

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateStaticParams() {
  // Pocas rutas en build; el resto se genera on-demand (ISR).
  const products = await getActiveProducts(12);
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return {
      title: "Producto no encontrado",
      robots: { index: false, follow: true },
    };
  }

  const title = product.title;
  const description =
    product.description ??
    `${product.title} · precio actual ${formatEuro(product.currentPrice)} en Amazon España. Ofertas y alertas en CazaOferta.`;

  return buildPageMetadata({
    title,
    description,
    // La ficha canónica vive en el marketplace (mismo slug): evita que Google
    // reparta autoridad entre dos URLs con el mismo contenido.
    path: marketplaceAbsoluteUrl(`/oferta/${slug}`),
    image: product.imageUrl,
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const savings =
    product.previousPrice !== null
      ? product.previousPrice - product.currentPrice
      : 0;
  const descriptionParts = splitProductDescription(product.description);
  const category = product.category;
  const breadcrumbItems = [
    { name: "Inicio", path: "/" },
    { name: "Ofertas", path: "/ofertas" },
    ...(category?.parentSlug && category.parentName
      ? [
          {
            name: category.parentName,
            path: `/categorias/${category.parentSlug}`,
          },
        ]
      : []),
    ...(category?.parentSlug && category.childSlug && category.name
      ? [
          {
            name: category.name,
            path: category.path,
          },
        ]
      : category
        ? [{ name: category.name, path: category.path }]
        : []),
    { name: product.title, path: `/producto/${product.slug}` },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <JsonLd
        data={[productJsonLd(product), breadcrumbJsonLd(breadcrumbItems)]}
      />
      <nav className="mb-8 text-sm text-stone-500" aria-label="Migas de pan">
        <Link href="/" className="hover:text-ink">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <Link href="/ofertas" className="hover:text-ink">
          Catálogo
        </Link>
        {category?.parentSlug && category.parentName ? (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/categorias/${category.parentSlug}`}
              className="hover:text-ink"
            >
              {category.parentName}
            </Link>
          </>
        ) : null}
        {category?.parentSlug && category.childSlug && category.name ? (
          <>
            <span className="mx-2">/</span>
            <Link href={category.path} className="hover:text-ink">
              {category.name}
            </Link>
          </>
        ) : category ? (
          <>
            <span className="mx-2">/</span>
            <Link href={category.path} className="hover:text-ink">
              {category.name}
            </Link>
          </>
        ) : null}
        <span className="mx-2">/</span>
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative w-full bg-transparent">
          {product.imageUrl ? (
            <RemoteImage
              src={product.imageUrl}
              alt={product.title}
              width={1200}
              height={1200}
              priority
              className="h-auto w-full bg-transparent"
              sizes="(max-width: 1024px) 100vw, 50vw"
              style={{ width: "100%", height: "auto" }}
            />
          ) : null}
        </div>

        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge dealLevel={product.dealLevel} />
            {product.discountPercentage > 0 ? (
              <Badge variant="discount">
                −{Math.round(product.discountPercentage)}%
              </Badge>
            ) : null}
            {product.category ? (
              <Badge variant="category">{product.category.name}</Badge>
            ) : null}
          </div>

          <h1 className="font-display text-4xl leading-tight tracking-tight text-ink md:text-5xl">
            {product.title}
          </h1>

          {product.brand ? (
            <p className="text-sm uppercase tracking-[0.16em] text-stone-500">
              {product.brand}
            </p>
          ) : (
            <p className="text-sm uppercase tracking-[0.16em] text-stone-500">
              {retailerLabel(product.retailer)}
            </p>
          )}

          <Price
            current={product.currentPrice}
            previous={product.previousPrice}
            discountPercentage={product.discountPercentage}
            size="lg"
          />

          {descriptionParts.length > 0 ? (
            <div className="space-y-3 border-y border-stone-200 py-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
                Descripción
              </h2>
              {descriptionParts.length === 1 ? (
                <p className="text-base leading-relaxed text-stone-700">
                  {descriptionParts[0]}
                </p>
              ) : (
                <ul className="space-y-2.5 text-base leading-relaxed text-stone-700">
                  {descriptionParts.map((part, index) => (
                    <li key={`${index}-${part.slice(0, 32)}`} className="flex gap-2.5">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-800/70"
                        aria-hidden
                      />
                      <span>{part}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-4 border-y border-stone-300 py-5 text-sm">
            <div>
              <dt className="text-stone-500">Precio actual</dt>
              <dd className="mt-1 font-medium text-ink">
                {formatEuro(product.currentPrice)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Precio anterior</dt>
              <dd className="mt-1 font-medium text-ink">
                {product.previousPrice !== null
                  ? formatEuro(product.previousPrice)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Ahorro</dt>
              <dd className="mt-1 font-medium text-ink">
                {savings > 0 ? formatEuro(savings) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Mínimo histórico</dt>
              <dd className="mt-1 font-medium text-ink">
                {product.lowestPrice !== null
                  ? formatEuro(product.lowestPrice)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Disponibilidad</dt>
              <dd className="mt-1 font-medium text-ink">
                {availabilityLabel(product.availability)}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Última comprobación</dt>
              <dd className="mt-1 font-medium text-ink">
                {product.lastCheckedAt
                  ? new Date(product.lastCheckedAt).toLocaleString("es-ES")
                  : "—"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3 pb-20 md:pb-0">
            <a
              href={buildTrackedAffiliatePath({
                productId: product.id,
                source: "product_page",
              })}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex h-12 items-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-teal-900"
            >
              {retailerBuyCtaLabel(product.retailer)}
            </a>
            <a
              href={telegramAlertForAsin(product.asin)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center border border-stone-400 px-6 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition hover:border-ink"
            >
              Crear alerta en Telegram
            </a>
          </div>
        </div>
      </div>

      <ProductStickyBuyBar
        productId={product.id}
        asin={product.asin}
        retailer={product.retailer}
        currentPrice={product.currentPrice}
        previousPrice={product.previousPrice}
      />
    </div>
  );
}
