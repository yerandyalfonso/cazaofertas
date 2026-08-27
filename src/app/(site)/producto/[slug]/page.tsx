import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { Badge } from "@/components/Badge";
import { JsonLd } from "@/components/JsonLd";
import { Price } from "@/components/Price";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { ProductStickyBuyBar } from "@/components/ProductStickyBuyBar";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import {
  getActiveProducts,
  getPriceHistory,
  getProductBySlug,
} from "@/lib/catalog";
import { formatEuro } from "@/lib/money";
import {
  breadcrumbJsonLd,
  buildPageMetadata,
  productJsonLd,
} from "@/lib/seo";
import { telegramAlertForAsin } from "@/lib/telegram-links";
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
    `${product.title} · precio actual ${formatEuro(product.currentPrice)} en Amazon España. Historial y deal score en CazaOferta.`;

  return buildPageMetadata({
    title,
    description,
    path: `/producto/${slug}`,
    image: product.imageUrl,
  });
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const history = await getPriceHistory(product.id, { days: 90, maxPoints: 120 });
  const averagePrice30d =
    product.averagePrice30d ?? history.averagePrice30d;
  const averagePrice90d =
    product.averagePrice90d ?? history.averagePrice90d;
  const savings =
    product.previousPrice !== null
      ? product.previousPrice - product.currentPrice
      : 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <JsonLd
        data={[
          productJsonLd(product),
          breadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: "Ofertas", path: "/ofertas" },
            ...(product.category
              ? [
                  {
                    name: product.category.name,
                    path: `/categorias/${product.category.slug}`,
                  },
                ]
              : []),
            { name: product.title, path: `/producto/${product.slug}` },
          ]),
        ]}
      />
      <nav className="mb-8 text-sm text-stone-500" aria-label="Migas de pan">
        <Link href="/" className="hover:text-ink">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <Link href="/ofertas" className="hover:text-ink">
          Catálogo
        </Link>
        {product.category ? (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/categorias/${product.category.slug}`}
              className="hover:text-ink"
            >
              {product.category.name}
            </Link>
          </>
        ) : null}
        <span className="mx-2">/</span>
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden bg-stone-200">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
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
          ) : null}

          <Price
            current={product.currentPrice}
            previous={product.previousPrice}
            discountPercentage={product.discountPercentage}
            size="lg"
          />

          <p className="text-sm text-stone-600">
            Deal score{" "}
            <strong className="text-ink">{Math.round(product.dealScore)}</strong>
            {product.dealLabel ? ` · ${product.dealLabel}` : null}
          </p>
          <p className="text-xs leading-relaxed text-stone-500">
            El score combina descuento, cercanía al mínimo histórico y
            estabilidad del precio.
          </p>

          <AffiliateDisclosure />

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
              <dt className="text-stone-500">Media 30 días</dt>
              <dd className="mt-1 font-medium text-ink">
                {averagePrice30d !== null ? formatEuro(averagePrice30d) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Media 90 días</dt>
              <dd className="mt-1 font-medium text-ink">
                {averagePrice90d !== null ? formatEuro(averagePrice90d) : "—"}
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

          {product.description ? (
            <p className="text-base leading-relaxed text-stone-700">
              {product.description}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pb-20 md:pb-0">
            <a
              href={buildTrackedAffiliatePath({
                productId: product.id,
                source: "product_page",
              })}
              rel="noopener noreferrer sponsored"
              className="inline-flex h-12 items-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-teal-900"
            >
              Ir a Amazon
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

      <section className="mt-16">
        <h2 className="font-display text-2xl tracking-tight text-ink md:text-3xl">
          Evolución del precio
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Mínimo, media móvil, máximo y actual. La línea discontinua marca la
          media del periodo seleccionado.
        </p>
        <div className="mt-6">
          <PriceHistoryChart
            points={history.points}
            currentPrice={product.currentPrice}
            averagePrice30d={averagePrice30d}
            averagePrice90d={averagePrice90d}
            allTimeLowest={product.lowestPrice}
          />
        </div>
      </section>

      <ProductStickyBuyBar
        productId={product.id}
        asin={product.asin}
        currentPrice={product.currentPrice}
        previousPrice={product.previousPrice}
      />
    </div>
  );
}
