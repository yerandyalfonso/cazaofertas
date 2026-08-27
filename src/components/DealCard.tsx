import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Price } from "@/components/Price";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import type { CatalogProduct } from "@/lib/catalog";
import { splitProductDescription } from "@/lib/product-description";

interface DealCardProps {
  product: CatalogProduct;
  featured?: boolean;
  compact?: boolean;
}

function ProductThumb({
  product,
  featured = false,
  compact = false,
  priority = false,
}: {
  product: CatalogProduct;
  featured?: boolean;
  compact?: boolean;
  priority?: boolean;
}) {
  if (!product.imageUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-transparent text-xs text-stone-400 ${
          compact ? "aspect-square" : "min-h-40"
        }`}
      >
        Sin imagen
      </div>
    );
  }

  if (compact) {
    return (
      <Image
        src={product.imageUrl}
        alt={product.title}
        width={176}
        height={176}
        sizes="88px"
        className="h-full w-full bg-transparent object-contain transition-transform duration-500 group-hover:scale-[1.03]"
      />
    );
  }

  return (
    <Image
      src={product.imageUrl}
      alt={product.title}
      width={900}
      height={900}
      priority={priority}
      sizes={
        featured
          ? "(max-width: 768px) 100vw, 50vw"
          : "(max-width: 768px) 50vw, 33vw"
      }
      className={`mx-auto h-auto w-full max-h-56 bg-transparent object-contain transition-transform duration-700 ease-out group-hover:scale-[1.02] ${
        featured ? "md:max-h-[380px]" : ""
      }`}
      style={{ width: "100%", height: "auto" }}
    />
  );
}

export function DealCard({
  product,
  featured = false,
  compact = false,
}: DealCardProps) {
  if (compact) {
    return (
      <article className="group grid grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-stone-200 pb-5 last:border-b-0 last:pb-0">
        <Link
          href={`/producto/${product.slug}`}
          className="relative aspect-square overflow-hidden bg-transparent"
        >
          <ProductThumb product={product} compact />
        </Link>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge dealLevel={product.dealLevel} />
          </div>
          <Link href={`/producto/${product.slug}`}>
            <h3 className="line-clamp-2 font-display text-base leading-snug tracking-tight text-ink transition group-hover:text-teal-900">
              {product.title}
            </h3>
          </Link>
          <Price
            current={product.currentPrice}
            previous={product.previousPrice}
            discountPercentage={product.discountPercentage}
            size="sm"
          />
          <div className="flex items-center gap-2 pt-0.5">
            <a
              href={buildTrackedAffiliatePath({
                productId: product.id,
                source: "deal_card_compact",
              })}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-900 underline-offset-2 hover:underline"
            >
              Amazon
            </a>
            <span className="text-stone-300">·</span>
            <Link
              href={`/producto/${product.slug}`}
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500 underline-offset-2 hover:text-ink hover:underline"
            >
              Detalle
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden bg-white shadow-[0_1px_0_0_rgba(28,25,23,0.08)] transition duration-500 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] ${
        featured ? "md:col-span-2 md:grid md:grid-cols-2" : ""
      }`}
    >
      <Link
        href={`/producto/${product.slug}`}
        className={`relative flex items-center justify-center bg-transparent px-5 pt-5 ${
          featured ? "md:h-full md:px-8 md:py-8" : ""
        }`}
      >
        <ProductThumb product={product} featured={featured} priority={featured} />
      </Link>

      <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge dealLevel={product.dealLevel} />
          {product.category ? (
            <Badge variant="category">{product.category.name}</Badge>
          ) : null}
        </div>

        <Link href={`/producto/${product.slug}`} className="space-y-2">
          <h3
            className={`font-display tracking-tight text-ink transition-colors group-hover:text-teal-900 ${
              featured
                ? "text-2xl leading-tight md:text-3xl"
                : "text-xl leading-snug"
            }`}
          >
            {product.title}
          </h3>
          {product.description && featured ? (
            <p className="line-clamp-3 text-sm leading-relaxed text-stone-600">
              {splitProductDescription(product.description).join(" ") ||
                product.description}
            </p>
          ) : null}
        </Link>

        <div className="mt-auto space-y-4">
          <Price
            current={product.currentPrice}
            previous={product.previousPrice}
            discountPercentage={product.discountPercentage}
            size={featured ? "md" : "sm"}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
              {Math.round(product.dealScore)}/100
            </p>
            <a
              href={buildTrackedAffiliatePath({
                productId: product.id,
                source: "deal_card",
              })}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex h-10 items-center justify-center bg-ink px-4 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
            >
              Ver en Amazon
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
