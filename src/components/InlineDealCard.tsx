import { RemoteImage } from "@/components/RemoteImage";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Price } from "@/components/Price";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import type { CatalogProduct } from "@/lib/catalog";
import { formatEuro } from "@/lib/money";
import { retailerLabel, retailerViewCtaLabel } from "@/lib/retailers";

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
    buyLabel ??
    (variant === "sidebar"
      ? retailerViewCtaLabel(product.retailer)
      : "Ver oferta");
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
  const discount = Math.round(product.discountPercentage);
  const previousPrice =
    product.previousPrice && product.previousPrice > product.currentPrice
      ? formatEuro(product.previousPrice)
      : null;
  const currentPrice = formatEuro(product.currentPrice);

  return (
    <article className="group flex flex-col border border-stone-300 bg-white transition-colors hover:border-ink sm:grid sm:grid-cols-[200px_minmax(0,1fr)_196px]">
      <Link
        href={detailHref}
        className="relative aspect-[4/3] w-full border-b border-stone-200 bg-white sm:m-3 sm:aspect-square sm:w-auto sm:border-b-0"
      >
        {product.imageUrl ? (
          <RemoteImage
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 100vw, 200px"
            className="object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.04] sm:p-1.5"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-stone-400">
            Sin imagen
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-col gap-2 px-3.5 pt-3.5 sm:py-5 sm:pl-1.5 sm:pr-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">
          {[product.brand, product.category?.name]
            .filter(Boolean)
            .join(" · ") || "Producto"}
        </p>
        <Link href={detailHref}>
          <h3 className="line-clamp-3 font-display text-base leading-snug tracking-tight text-ink transition-colors group-hover:text-teal-900 sm:text-lg">
            {product.title}
          </h3>
        </Link>
        <p className="text-[13px] text-stone-500 sm:mt-auto">
          Vendido por{" "}
          <span className="font-semibold text-ink">
            {retailerLabel(product.retailer)}
          </span>
        </p>
      </div>

      <div className="mx-3.5 mt-3 flex flex-col gap-3.5 border-t border-stone-200 pb-3.5 pt-3 sm:m-0 sm:gap-1.5 sm:border-l sm:border-t-0 sm:px-[18px] sm:py-5">
        {/* Móvil: de → a, con % y ahorro a la derecha */}
        <div className="flex items-end justify-between gap-3 sm:hidden">
          <div className="grid gap-1">
            {previousPrice ? (
              <s className="text-sm tabular-nums text-stone-500">
                {previousPrice}
              </s>
            ) : null}
            <span className="font-display text-[30px] font-semibold leading-none tabular-nums">
              {currentPrice}
            </span>
          </div>
          {discount > 0 ? (
            <div className="grid justify-items-end gap-1.5">
              <span className="bg-teal-50 px-[7px] py-[5px] text-xs font-bold tabular-nums text-teal-800">
                −{discount}%
              </span>
              {savings > 0 ? (
                <span className="text-[12.5px] font-bold tabular-nums text-teal-800">
                  −{formatEuro(savings)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Escritorio: bloque de precio arriba */}
        <div className="hidden flex-col gap-1.5 sm:flex">
          {discount > 0 ? (
            <span className="self-start bg-teal-50 px-[7px] py-[5px] text-xs font-bold tabular-nums text-teal-800">
              −{discount}%
            </span>
          ) : null}
          <span className="font-display text-[30px] font-semibold leading-none tabular-nums">
            {currentPrice}
          </span>
          {previousPrice ? (
            <s className="text-sm tabular-nums text-stone-500">
              {previousPrice}
            </s>
          ) : null}
        </div>

        <a
          href={buyHref}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex h-11 w-full items-center justify-center gap-2 bg-ink text-xs font-bold uppercase tracking-[0.12em] text-paper transition hover:bg-teal-900 sm:mt-auto"
        >
          {resolvedBuyLabel}
          <span aria-hidden>→</span>
        </a>
      </div>
    </article>
  );
}
