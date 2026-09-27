"use client";

import Image from "next/image";
import Link from "next/link";
import { formatDiscount, formatEuro } from "@/lib/money";
import { retailerLabel } from "@/lib/retailers";
import type { MarketplaceProduct } from "@/lib/types";

interface TopDealsPanelProps {
  topDeals: MarketplaceProduct[];
  trending: MarketplaceProduct[];
  latest: MarketplaceProduct[];
}

function MiniDealRow({ product }: { product: MarketplaceProduct }) {
  return (
    <Link
      href={`/oferta/${product.slug}`}
      className="group flex items-start gap-2.5 rounded-control p-2 transition hover:bg-surface-muted"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            className="object-contain p-1"
            sizes="56px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted">
            —
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs font-medium leading-snug text-ink group-hover:text-primary">
          {product.title}
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-snug">
          <span className="price font-semibold text-ink">
            {formatEuro(product.currentPrice)}
          </span>
          {product.discountPercentage > 0 && (
            <>
              <span className="text-muted">·</span>
              <span className="font-semibold text-primary">
                {formatDiscount(product.discountPercentage)}
              </span>
            </>
          )}
          <span className="text-muted">·</span>
          <span className="text-[11px] font-medium text-muted">
            {retailerLabel(product.retailer)}
          </span>
        </p>
      </div>
    </Link>
  );
}

function PanelSection({
  title,
  items,
}: {
  title: string;
  items: MarketplaceProduct[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-semibold text-ink">{title}</h2>
      <div className="space-y-0.5">
        {items.map((product) => (
          <MiniDealRow key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export function TopDealsPanel({
  topDeals,
  trending,
  latest,
}: TopDealsPanelProps) {
  return (
    <div className="space-y-4">
      <PanelSection title="Los mejores de hoy" items={topDeals} />
      {/* «Más descuento» solo si no repite los mismos productos. */}
      {trending.some((item) => !topDeals.some((top) => top.id === item.id)) && (
        <PanelSection title="Más descuento" items={trending} />
      )}
      <PanelSection title="Recién añadidas" items={latest} />
    </div>
  );
}
