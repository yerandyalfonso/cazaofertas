"use client";

import { formatEuro } from "@/lib/money";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import { retailerLabel } from "@/lib/retailers";
import { telegramAlertForAsin } from "@/lib/telegram-links";

interface ProductStickyBuyBarProps {
  productId: string;
  asin: string;
  retailer: string;
  currentPrice: number;
  previousPrice: number | null;
}

export function ProductStickyBuyBar({
  productId,
  asin,
  retailer,
  currentPrice,
  previousPrice,
}: ProductStickyBuyBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-300 bg-paper/95 px-4 py-3 backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg tracking-tight text-ink">
            {formatEuro(currentPrice)}
          </p>
          {previousPrice !== null && previousPrice > currentPrice ? (
            <p className="text-[11px] text-stone-500 line-through">
              {formatEuro(previousPrice)}
            </p>
          ) : null}
        </div>
        <a
          href={telegramAlertForAsin(asin)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center border border-stone-400 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink"
        >
          Alerta
        </a>
        <a
          href={buildTrackedAffiliatePath({
            productId,
            source: "product_page_sticky",
          })}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex h-11 shrink-0 items-center bg-ink px-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-paper"
        >
          {retailerLabel(retailer)}
        </a>
      </div>
    </div>
  );
}
