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

interface OfferPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateStaticParams() {
  const products = await getActiveProducts(40);
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: OfferPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Oferta no encontrada" };

  return {
    title: product.title,
    description:
      product.description ??
      `Oferta de ${product.title}. ${Math.round(product.discountPercentage)}% de descuento.`,
  };
}

export default async function OfferDetailPage({ params }: OfferPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const history = await getPriceHistory(product.id);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <nav className="mb-8 text-sm text-stone-500">
        <Link href="/ofertas" className="hover:text-ink">
          Ofertas
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative aspect-[5/4] overflow-hidden bg-stone-200 lg:aspect-square">
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

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            <Badge dealLevel={product.dealLevel} />
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
            {product.lowestPrice !== null
              ? ` · Mínimo histórico ${product.lowestPrice.toFixed(2)} €`
              : null}
          </p>

          {product.description ? (
            <p className="max-w-xl text-base leading-relaxed text-stone-700">
              {product.description}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={product.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex h-12 items-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.16em] text-paper transition hover:bg-teal-900"
            >
              Comprar en Amazon
            </a>
            <Link
              href={`/producto/${product.slug}`}
              className="inline-flex h-12 items-center border border-stone-400 px-6 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition hover:border-ink"
            >
              Ficha de producto
            </Link>
          </div>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="font-display text-2xl tracking-tight text-ink md:text-3xl">
          Histórico de precio
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Evolución reciente según nuestros chequeos automáticos. Pasa el ratón
          por los puntos para ver el precio exacto.
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
