import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Price } from "@/components/Price";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import {
  getActiveProducts,
  getPriceHistory,
  getProductBySlug,
} from "@/lib/catalog";
import { formatEuro } from "@/lib/money";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getActiveProducts(40);
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado" };

  return {
    title: product.title,
    description:
      product.description ??
      `${product.title} · precio actual ${formatEuro(product.currentPrice)}`,
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const history = await getPriceHistory(product.id);
  const savings =
    product.previousPrice !== null
      ? product.previousPrice - product.currentPrice
      : 0;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <nav className="mb-8 text-sm text-stone-500">
        <Link href="/" className="hover:text-ink">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <Link href="/ofertas" className="hover:text-ink">
          Catálogo
        </Link>
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

          <Price
            current={product.currentPrice}
            previous={product.previousPrice}
            discountPercentage={product.discountPercentage}
            size="lg"
          />

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
          </dl>

          {product.description ? (
            <p className="text-base leading-relaxed text-stone-700">
              {product.description}
            </p>
          ) : null}

          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex h-12 items-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-teal-900"
          >
            Ir a Amazon
          </a>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="font-display text-2xl tracking-tight text-ink md:text-3xl">
          Evolución del precio
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Mínimo, máximo y actual, con la curva de chequeos automáticos.
        </p>
        <div className="mt-6">
          <PriceHistoryChart
            points={history}
            currentPrice={product.currentPrice}
          />
        </div>
      </section>
    </div>
  );
}
