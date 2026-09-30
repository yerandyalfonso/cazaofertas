"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryProductsResponse } from "@/app/api/categorias/productos/route";
import { ProductCard } from "@/components/ProductCard";
import type { CatalogProduct } from "@/lib/catalog";
import { retailerViewCtaLabel } from "@/lib/retailers";

/**
 * Rejilla de productos con carga progresiva: el servidor pinta la primera
 * tanda y el resto se pide a `/api/categorias/productos` al acercarse al final.
 */
export function ProductGridProgressive({
  products: initialProducts,
  total,
  categorySlug,
  childSlug = null,
  clickSource = "category_grid",
}: {
  products: CatalogProduct[];
  total: number;
  categorySlug: string;
  childSlug?: string | null;
  clickSource?: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [knownTotal, setKnownTotal] = useState(total);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMore = products.length < knownTotal;

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({
        slug: categorySlug,
        offset: String(products.length),
      });
      if (childSlug) params.set("child", childSlug);
      const response = await fetch(`/api/categorias/productos?${params}`);
      if (!response.ok) throw new Error(String(response.status));
      const page = (await response.json()) as CategoryProductsResponse;
      setProducts((current) => {
        const seen = new Set(current.map((product) => product.id));
        return [...current, ...page.products.filter((p) => !seen.has(p.id))];
      });
      // Si el catálogo cambió y no llega nada nuevo, se deja de pedir.
      setKnownTotal(
        page.products.length === 0 ? products.length : page.total,
      );
    } catch {
      setFailed(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [categorySlug, childSlug, products.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || failed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, failed, loadMore]);

  return (
    <>
      <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {products.map((product) => (
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
            onClick={() => void loadMore()}
            disabled={loading}
            className="h-12 border border-ink px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper disabled:opacity-60"
          >
            {loading ? "Cargando…" : failed ? "Reintentar" : "Cargar más ofertas"}
          </button>
          <p className="text-sm text-stone-500">
            {failed
              ? "No se pudieron cargar más ofertas."
              : `Mostrando ${products.length} de ${knownTotal}`}
          </p>
        </div>
      ) : null}
    </>
  );
}
