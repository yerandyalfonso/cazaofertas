import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Price } from "@/components/Price";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import type { CatalogProduct } from "@/lib/catalog";

interface DealCardProps {
  product: CatalogProduct;
  featured?: boolean;
  compact?: boolean;
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
          className="relative aspect-square overflow-hidden bg-stone-200"
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.title}
              fill
              sizes="88px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : null}
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
        className={`relative block overflow-hidden bg-stone-200 ${
          featured
            ? "aspect-[16/11] md:aspect-auto md:min-h-full"
            : "aspect-[5/4]"
        }`}
      >
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            sizes={
              featured
                ? "(max-width: 768px) 100vw, 50vw"
                : "(max-width: 768px) 50vw, 25vw"
            }
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            priority={featured}
          />
        ) : null}
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
            <p className="line-clamp-2 text-sm leading-relaxed text-stone-600">
              {product.description}
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
              Score {Math.round(product.dealScore)}
            </p>
            <p className="sr-only">
              El score combina descuento, mínimo histórico y estabilidad.
            </p>
            <a
              href={buildTrackedAffiliatePath({
                productId: product.id,
                source: "deal_card",
              })}
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
