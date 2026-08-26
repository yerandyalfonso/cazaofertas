import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Price } from "@/components/Price";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import type { CatalogProduct } from "@/lib/catalog";

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
  buyLabel = "Ver en Amazon",
  variant = "horizontal",
  articleId,
  clickSource = "blog_inline",
}: InlineDealCardProps) {
  const detailHref = href ?? `/producto/${product.slug}`;
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
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes="(max-width: 1024px) 100vw, 320px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
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
            <h3 className="line-clamp-3 font-display text-[0.95rem] leading-snug tracking-tight text-ink transition-colors group-hover:text-teal-900">
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
              rel="noopener noreferrer sponsored"
              className="inline-flex h-10 w-full items-center justify-center bg-ink text-[11px] font-semibold uppercase tracking-[0.12em] text-paper transition hover:bg-teal-900"
            >
              {buyLabel}
            </a>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group overflow-hidden border border-stone-300 bg-white">
      <div className="grid min-h-[148px] grid-cols-[112px_minmax(0,1fr)] sm:grid-cols-[148px_minmax(0,1fr)]">
        <Link href={detailHref} className="relative min-h-full bg-stone-100">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes="(max-width: 640px) 112px, 148px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full min-h-[148px] items-center justify-center text-xs text-stone-400">
              Sin imagen
            </div>
          )}
        </Link>

        <div className="flex min-h-[148px] min-w-0 flex-col justify-between gap-4 px-4 py-4 sm:px-5 sm:py-4">
          <div className="min-w-0 space-y-2">
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

            <div>
              <Link href={detailHref}>
                <h3 className="line-clamp-2 font-display text-base leading-snug tracking-tight text-ink transition-colors group-hover:text-teal-900 sm:text-lg">
                  {product.title}
                </h3>
              </Link>
              {product.description ? (
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-stone-500">
                  {product.description}
                </p>
              ) : product.brand ? (
                <p className="mt-1.5 text-sm text-stone-500">{product.brand}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-baseline justify-between gap-4 border-t border-stone-100 pt-3">
            <Price
              current={product.currentPrice}
              previous={product.previousPrice}
              discountPercentage={product.discountPercentage}
              showDiscountLabel={false}
              size="sm"
              className="min-w-0"
            />
            <a
              href={buyHref}
              rel="noopener noreferrer sponsored"
              className="inline-flex h-9 shrink-0 items-center self-end bg-ink px-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper transition hover:bg-teal-900 sm:h-10 sm:px-4"
            >
              {buyLabel}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
