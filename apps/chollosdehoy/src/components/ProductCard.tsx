"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Zap } from "lucide-react";
import { FillImage } from "@/components/FillImage";
import { PrimeTag } from "@/components/PrimeTag";
import { flashDealLabel } from "@/lib/flash";
import { formatDiscount, formatEuro } from "@/lib/money";
import { retailerColor, retailerLabel } from "@/lib/retailers";
import { DealLevel, type MarketplaceProduct } from "@/lib/types";

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

interface ProductCardProps {
  product: MarketplaceProduct;
  view: "grid" | "list";
  /**
   * Forma de la tarjeta en la rejilla: vertical; horizontal (foto a la
   * izquierda); o «responsive», horizontal en móvil (una por fila) y vertical
   * desde sm.
   */
  layout?: "vertical" | "horizontal" | "responsive";
}

const imageWrapClass =
  "relative overflow-hidden bg-white";

export function ProductCard({ product, view, layout = "vertical" }: ProductCardProps) {
  const retailerTint = retailerColor(product.retailer);
  const flashLabel = flashDealLabel(product.expiresAt);

  if (view === "list") {
    return (
      <article className="card group flex gap-4 p-3 transition hover:border-line-strong hover:shadow-raised md:p-4">
        <Link
          href={`/oferta/${product.slug}`}
          className={`${imageWrapClass} h-24 w-24 shrink-0 rounded-control border border-line md:h-28 md:w-28`}
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              className="object-contain p-2.5"
              sizes="112px"
            />
          ) : null}
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <RetailerTag retailer={product.retailer} color={retailerTint} />
          </div>

          <Link href={`/oferta/${product.slug}`} className="tap-link w-full">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:text-primary md:text-base">
              {product.title}
            </h3>
          </Link>

          {product.category && (
            <p className="text-xs text-muted">
              {product.category.parentName ?? product.category.name}
              {product.variantCount > 1 && (
                <span className="font-medium text-primary">
                  {" · "}
                  {product.variantCount} opciones
                </span>
              )}
            </p>
          )}

          {flashLabel && (
            <p className="flex items-center gap-1 text-xs font-semibold text-urgent">
              <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {flashLabel}
            </p>
          )}

          <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="price text-xl font-semibold text-ink">
                  {formatEuro(product.currentPrice)}
                </span>
                {product.primeOnly && <PrimeTag className="self-center" />}
                {product.previousPrice &&
                  product.previousPrice > product.currentPrice && (
                    <span className="text-sm text-muted line-through price">
                      {formatEuro(product.previousPrice)}
                    </span>
                  )}
              </div>
              {product.discountPercentage > 0 && (
                <span
                  className={`mt-0.5 inline-block text-xs font-bold ${dealBadgeClass(product.dealLevel)} badge`}
                >
                  {formatDiscount(product.discountPercentage)}
                </span>
              )}
            </div>
            <a
              href={product.affiliateUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="btn btn-outline-gradient text-sm"
            >
              Ver oferta
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
      </article>
    );
  }

  const L = LAYOUTS[layout];
  const hasPrevious =
    product.previousPrice !== null && product.previousPrice > product.currentPrice;

  return (
    <article className={`card group flex h-full overflow-hidden transition hover:border-line-strong hover:shadow-raised ${L.article}`}>
      <Link
        href={`/oferta/${product.slug}`}
        className={`relative block shrink-0 overflow-hidden bg-white border-line ${L.image}`}
      >
        <FillImage src={product.imageUrl} alt={product.title} sizes={L.sizes} />
        {product.discountPercentage > 0 && (
          <span
            className={`badge absolute left-3 top-3 z-10 text-sm shadow-sm ${dealBadgeClass(product.dealLevel)}`}
          >
            {formatDiscount(product.discountPercentage)}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
        <RetailerTag retailer={product.retailer} color={retailerTint} />

        <Link href={`/oferta/${product.slug}`} className="tap-link w-full">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-ink group-hover:text-primary">
            {product.title}
          </h3>
        </Link>

        {product.category && (
          <p className="text-xs text-muted">
            {product.category.parentName ?? product.category.name}
            {product.variantCount > 1 && (
              <span className="font-medium text-primary">
                {" · "}
                {product.variantCount} opciones
              </span>
            )}
          </p>
        )}

        {flashLabel && (
          <p className="flex items-center gap-1 text-xs font-semibold text-urgent">
            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {flashLabel}
          </p>
        )}

        {/* Precio con grow enorme y botón con grow 1: si caben en una fila el
            botón mantiene su tamaño; si baja solo a otra, ocupa todo el ancho. */}
        <div className="mt-auto flex flex-wrap items-end gap-2 pt-2">
          <div className="min-w-0 grow-[9999]">
            <span className="flex items-center gap-1.5">
              <span className="price text-2xl font-extrabold leading-none tracking-tight text-ink">
                {formatEuro(product.currentPrice)}
              </span>
              {product.primeOnly && <PrimeTag />}
            </span>
            {hasPrevious && (
              <span className="price mt-1 block text-sm font-medium text-muted line-through">
                {formatEuro(product.previousPrice!)}
              </span>
            )}
          </div>
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="btn btn-outline-gradient grow text-sm"
          >
            Ver
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}

const LAYOUTS = {
  vertical: {
    article: "flex-col",
    image: "aspect-square border-b",
    sizes: "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
  },
  horizontal: {
    article: "flex-row",
    image: "w-2/5 border-r",
    sizes: "(max-width: 640px) 40vw, 20vw",
  },
  responsive: {
    article: "flex-row sm:flex-col",
    image: "w-2/5 border-r sm:aspect-square sm:w-auto sm:border-r-0 sm:border-b",
    sizes: "(max-width: 640px) 40vw, (max-width: 1024px) 33vw, 25vw",
  },
} as const;

/** Tienda en texto discreto con un punto de su color (sin píldora). */
function RetailerTag({ retailer, color }: { retailer: string; color: string }) {
  return (
    <span translate="no" className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {retailerLabel(retailer)}
    </span>
  );
}
