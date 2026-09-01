import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  TrendingDown,
} from "lucide-react";
import { getProductBySlug } from "@/lib/catalog";
import { formatDiscount, formatEuro } from "@/lib/money";
import { RETAILER_COLORS, retailerLabel } from "@/lib/retailers";
import { DealLevel } from "@/lib/types";

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

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Oferta no encontrada" };
  return {
    title: product.title,
    description:
      product.description ?? `Oferta en ${retailerLabel(product.retailer)}`,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const retailerColor = RETAILER_COLORS[product.retailer] ?? "#4f7f6a";
  const savings =
    product.previousPrice && product.previousPrice > product.currentPrice
      ? product.previousPrice - product.currentPrice
      : null;
  const categoryPath = product.category
    ? [
        product.category.parentName ?? product.category.name,
        product.category.parentName ? product.category.name : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="marketplace-shell bg-[var(--bg)]">
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
                <span key={part} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{part}</span>
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
      </main>

      {/* CTA fijo en móvil */}
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
    </div>
  );
}
