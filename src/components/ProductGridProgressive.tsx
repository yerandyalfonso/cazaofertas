"use client";

import { useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import type { CatalogProduct } from "@/lib/catalog";
import { retailerViewCtaLabel } from "@/lib/retailers";

const PAGE_SIZE = 24;

/** Rejilla de productos con carga progresiva (24 más al acercarse al final). */
export function ProductGridProgressive({
  products,
  clickSource = "category_grid",
}: {
  products: CatalogProduct[];
  clickSource?: string;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visible < products.length;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible((count) => count + PAGE_SIZE);
        }
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visible]);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {products.slice(0, visible).map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showBuyButton
            buyLabel={retailerViewCtaLabel(product.retailer)}
            clickSource={clickSource}
          />
        ))}
      </div>
      {hasMore ? (
        <div
          ref={sentinelRef}
          className="mt-14 flex flex-col items-center gap-3 border-t border-stone-300 pt-8"
        >
          <button
            type="button"
            onClick={() => setVisible((count) => count + PAGE_SIZE)}
            className="h-12 border border-ink px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
          >
            Cargar más ofertas
          </button>
          <p className="text-sm text-stone-500">
            Mostrando {visible} de {products.length}
          </p>
        </div>
      ) : null}
    </>
  );
}
