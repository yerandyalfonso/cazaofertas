import { RemoteImage } from "@/components/RemoteImage";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Price } from "@/components/Price";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import type { CatalogProduct } from "@/lib/catalog";
import { formatEuro } from "@/lib/money";
import { retailerViewCtaLabel } from "@/lib/retailers";

interface InlineDealCardProps {
  product: CatalogProduct;
  href?: string;
  buyLabel?: string;
  /** Vertical stack for article sidebars (narrow columns). */
  variant?: "horizontal" | "sidebar";
  articleId?: string | null;
  clickSource?: string;
}

export function InlineDealCard({
  product,
  href,
  buyLabel,
  variant = "horizontal",
  articleId,
  clickSource = "blog_inline",
}: InlineDealCardProps) {
  const detailHref = href ?? `/producto/${product.slug}`;
  const resolvedBuyLabel =
    buyLabel ?? retailerViewCtaLabel(product.retailer);
  const buyHref = buildTrackedAffiliatePath({
    productId: product.id,
    source: clickSource,
    articleId,
  });

  if (variant === "sidebar") {
    return (
      <article className="group flex h-full flex-col overflow-hidden border border-stone-300 bg-white">
        <Link
          href={detailHref}
          className="relative aspect-[4/3] w-full shrink-0 bg-stone-100"
        >
          {product.imageUrl ? (
            <RemoteImage
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-stone-400">
              Sin imagen
            </div>
          )}
        </Link>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3.5">
          <div className="flex flex-wrap gap-1.5">
            {product.discountPercentage > 0 ? (
              <Badge variant="discount">
                −{Math.round(product.discountPercentage)}%
              </Badge>
            ) : null}
            {product.category ? (
              <Badge variant="category">{product.category.name}</Badge>
            ) : null}
          </div>

          <Link href={detailHref} className="min-w-0">
            <h3 className="line-clamp-3 font-display text-base leading-snug tracking-tight text-ink transition-colors group-hover:text-teal-900">
              {product.title}
            </h3>
          </Link>

          {product.brand ? (
            <p className="truncate text-xs text-stone-500">{product.brand}</p>
          ) : null}

          <div className="mt-auto space-y-3 border-t border-stone-100 pt-3">
            <Price
              current={product.currentPrice}
              previous={product.previousPrice}
              discountPercentage={product.discountPercentage}
              showDiscountLabel={false}
              size="sm"
            />
            <a
              href={buyHref}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex h-10 w-full items-center justify-center bg-ink text-xs font-semibold uppercase tracking-[0.12em] text-paper transition hover:bg-teal-900"
            >
              {resolvedBuyLabel}
            </a>
          </div>
        </div>
      </article>
    );
  }

  const savings =
    product.previousPrice && product.previousPrice > product.currentPrice
      ? product.previousPrice - product.currentPrice
      : 0;

  return (
    <article className="group relative grid grid-cols-[104px_minmax(0,1fr)] gap-4 border border-stone-300 bg-white p-3 transition-colors hover:border-ink sm:grid-cols-[168px_minmax(0,1fr)] sm:gap-6 sm:p-4">
      <Link
        href={detailHref}
        className="relative aspect-square w-full self-start bg-paper"
      >
        {product.imageUrl ? (
          <RemoteImage
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 104px, 168px"
            className="object-contain p-2 mix-blend-multiply transition-transform duration-500 ease-out group-hover:scale-[1.04] sm:p-3"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-stone-400">
            Sin imagen
          </span>
        )}
        {product.discountPercentage > 0 ? (
          <span className="absolute left-0 top-0 bg-ink px-2 py-1 text-xs font-semibold tabular-nums text-paper">
            −{Math.round(product.discountPercentage)}%
          </span>
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-col py-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
          {[product.brand, product.category?.name].filter(Boolean).join(" · ") ||
            "Producto"}
        </p>
        <Link href={detailHref} className="mt-2">
          <h3 className="line-clamp-2 font-display text-lg leading-snug tracking-tight text-ink transition-colors group-hover:text-teal-900">
            {product.title}
          </h3>
        </Link>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-4">
          <div className="min-w-0">
            <Price
              current={product.currentPrice}
              previous={product.previousPrice}
              discountPercentage={product.discountPercentage}
              showDiscountLabel={false}
              size="md"
              className="[&>span:nth-child(2)]:text-sm"
            />
            {savings > 0 ? (
              <p className="mt-1 text-xs text-teal-800">
                Ahorras {formatEuro(savings)}
              </p>
            ) : null}
          </div>
          <a
            href={buyHref}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex h-11 shrink-0 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900 max-sm:w-full max-sm:justify-center"
          >
            {resolvedBuyLabel}
            <span aria-hidden>→</span>
          </a>
        </div>
      </div>
    </article>
  );
}
