import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Price } from "@/components/Price";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import type { CatalogProduct } from "@/lib/catalog";

interface ProductCardProps {
  product: CatalogProduct;
  href?: string;
  /** Compact layout for blog embeds and secondary grids. */
  variant?: "default" | "compact";
  /** Affiliate CTA anchored at the bottom of the card (compact only). */
  showBuyButton?: boolean;
  buyLabel?: string;
  articleId?: string | null;
  clickSource?: string;
}

export function ProductCard({
  product,
  href,
  variant = "default",
  showBuyButton = false,
  buyLabel = "Comprar",
  articleId,
  clickSource = "product_card",
}: ProductCardProps) {
  const link = href ?? `/producto/${product.slug}`;
  const compact = variant === "compact";
  const buyHref = buildTrackedAffiliatePath({
    productId: product.id,
    source: clickSource,
    articleId,
  });

  return (
    <article
      className={`group flex h-full flex-col ${
        compact
          ? "border border-stone-200 bg-white"
          : "border-b border-stone-300/80 pb-6 transition-colors duration-300 hover:border-ink"
      }`}
    >
      <Link
        href={link}
        className={`flex min-h-0 flex-1 flex-col ${compact ? "gap-3 p-3" : "gap-4"}`}
      >
        <div
          className={`relative overflow-hidden bg-stone-200 ${
            compact ? "aspect-[4/5] w-full" : "aspect-[4/5]"
          }`}
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes={
                compact
                  ? "(max-width: 640px) 45vw, 180px"
                  : "(max-width: 768px) 50vw, 25vw"
              }
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-stone-500">
              Sin imagen
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {product.category ? (
              <Badge variant="category">{product.category.name}</Badge>
            ) : null}
            {product.discountPercentage > 0 ? (
              <Badge variant="discount">
                −{Math.round(product.discountPercentage)}%
              </Badge>
            ) : null}
          </div>

          <h3
            className={`font-display leading-snug tracking-tight text-ink transition-colors group-hover:text-teal-900 ${
              compact
                ? "line-clamp-2 text-base md:text-[1.05rem]"
                : "text-xl md:text-[1.35rem]"
            }`}
          >
            {product.title}
          </h3>

          {product.brand && !compact ? (
            <p className="text-sm text-stone-500">{product.brand}</p>
          ) : null}

          <div className="mt-auto pt-2">
            <Price
              current={product.currentPrice}
              previous={product.previousPrice}
              discountPercentage={product.discountPercentage}
              size="sm"
            />
          </div>
        </div>
      </Link>

      {showBuyButton ? (
        <div className={`mt-auto ${compact ? "px-3 pb-3" : "pt-3"}`}>
          <a
            href={buyHref}
            rel="noopener noreferrer sponsored"
            className="inline-flex h-10 w-full items-center justify-center bg-ink text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
          >
            {buyLabel}
          </a>
        </div>
      ) : null}
    </article>
  );
}
