"use client";

import Image from "next/image";
import { Flame, Sparkles, TrendingUp } from "lucide-react";
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
      className="group flex items-start gap-2.5 rounded-[var(--radius-sm)] p-2 transition hover:bg-[var(--surface-muted)]"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-contain p-1"
            sizes="56px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-[var(--text-muted)]">
            —
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs font-medium leading-snug text-[var(--text)] group-hover:text-[var(--primary)]">
          {product.title}
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm leading-snug">
          <span className="font-bold text-[var(--primary)]">
            {formatEuro(product.currentPrice)}
          </span>
          {product.discountPercentage > 0 && (
            <>
              <span className="text-[var(--text-muted)]">·</span>
              <span className="font-semibold text-[var(--primary)]">
                {formatDiscount(product.discountPercentage)}
              </span>
            </>
          )}
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-[11px] font-medium text-[var(--text-muted)]">
            {retailerLabel(product.retailer)}
          </span>
        </p>
      </div>
    </Link>
  );
}

function PanelSection({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: typeof Flame;
  items: MarketplaceProduct[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="card p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
        <Icon className="h-4 w-4 text-[var(--primary)]" />
        {title}
      </h2>
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
      <PanelSection title="Top chollos" icon={Flame} items={topDeals} />
      <PanelSection title="Más descuento" icon={TrendingUp} items={trending} />
      <PanelSection title="Últimas añadidas" icon={Sparkles} items={latest} />
    </div>
  );
}
