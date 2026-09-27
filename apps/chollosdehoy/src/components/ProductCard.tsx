"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink, Zap } from "lucide-react";
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
}

const imageWrapClass =
  "relative overflow-hidden bg-white";

export function ProductCard({ product, view }: ProductCardProps) {
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

          <Link href={`/oferta/${product.slug}`}>
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
              className="btn btn-primary text-sm"
            >
              Comprar
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="card group flex h-full flex-col overflow-hidden transition hover:border-line-strong hover:shadow-raised">
      <Link
        href={`/oferta/${product.slug}`}
        className={`${imageWrapClass} relative block aspect-square border-b border-line`}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-contain p-4 transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Sin imagen
          </div>
        )}
        {product.discountPercentage > 0 && (
          <span
            className={`badge absolute left-3 top-3 z-10 shadow-sm ${dealBadgeClass(product.dealLevel)}`}
          >
            {formatDiscount(product.discountPercentage)}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <RetailerTag retailer={product.retailer} color={retailerTint} />

        <Link href={`/oferta/${product.slug}`}>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-ink group-hover:text-primary">
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

        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <div className="price text-lg font-semibold text-ink">
              {formatEuro(product.currentPrice)}
            </div>
            {product.previousPrice &&
              product.previousPrice > product.currentPrice && (
                <div className="text-xs text-muted line-through price">
                  {formatEuro(product.previousPrice)}
                </div>
              )}
          </div>
          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="btn btn-ghost text-xs"
          >
            Ver
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
        </div>
      </div>
    </article>
  );
}

/** Tienda en texto discreto con un punto de su color (sin píldora). */
function RetailerTag({ retailer, color }: { retailer: string; color: string }) {
  return (
    <span translate="no" className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {retailerLabel(retailer)}
    </span>
  );
}
