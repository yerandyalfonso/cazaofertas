"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAdminLoad } from "@/components/admin/useAdminLoad";
import {
  ChevronUp,
  Eye,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import {
  adminPriceCheckNote,
  normalizeRetailer,
  PRODUCT_RETAILERS,
  retailerLabel,
} from "@/lib/retailers";
import { formatFullDateTime } from "@/lib/relative-time";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  AdminPageHeader,
  AdminRetailerBadge,
  AdminSearchField,
  AdminSortButton,
} from "@/components/admin/AdminListChrome";
import { ProductDetailPanel } from "@/components/admin/products/ProductDetailPanel";
import { ProductFormPanel } from "@/components/admin/products/ProductFormPanel";
import { useProductForm } from "@/components/admin/products/useProductForm";
import {
  type AdminProduct,
  type CategoryOption,
  type SortKey,
  type SortDir,
  type StaleFilter,
  type DealFilter,
  productStatusBadges,
  freshnessMeta,
  iconBtnClass,
  toolbarFieldClass,
} from "@/components/admin/products/productsAdmin";
import { AdminRowMenu } from "@/components/admin/AdminRowMenu";
import { AdminProductsTableSkeleton } from "@/components/admin/AdminSkeleton";

export default function ProductsAdminClient() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [updatingAsin, setUpdatingAsin] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [retailerFilter, setRetailerFilter] = useState("");
  const [staleFilter, setStaleFilter] = useState<StaleFilter>("all");
  const [dealFilter, setDealFilter] = useState<DealFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastCheckedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nextOffsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadInFlightRef = useRef(false);
  /** Sube en cada recarga: las respuestas de peticiones anteriores se descartan. */
  const loadGenerationRef = useRef(0);
  const deferredQuery = useDeferredValue(query);
  const toast = useAdminToast();


  const PAGE_SIZE = 100;

  const loadPage = useCallback(
    async (reset: boolean) => {
      // Una recarga (filtro, orden, búsqueda) nunca se descarta; «cargar más»
      // espera a que no haya otra petición en curso.
      if (!reset && (loadInFlightRef.current || !hasMoreRef.current)) return;

      const generation = reset ? ++loadGenerationRef.current : loadGenerationRef.current;
      const isCurrent = () => generation === loadGenerationRef.current;
      loadInFlightRef.current = true;
      if (reset) {
        setLoading(true);
        setLoadingMore(false);
        nextOffsetRef.current = 0;
        hasMoreRef.current = true;
        setHasMore(true);
        tableScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
        setProducts((prev) => (prev.length === 0 ? [] : prev));
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const offset = reset ? 0 : nextOffsetRef.current;
        const params = new URLSearchParams({
          offset: String(offset),
          limit: String(PAGE_SIZE),
          sort: sortKey,
          dir: sortDir,
        });
        const needle = deferredQuery.trim();
        if (needle) params.set("q", needle);
        if (categoryFilter) params.set("category", categoryFilter);
        if (retailerFilter) params.set("retailer", retailerFilter);
        if (staleFilter !== "all") params.set("stale", staleFilter);
        if (dealFilter !== "all") params.set("deal", dealFilter);

        const response = await fetch(`/api/admin/products?${params}`);
        if (!isCurrent()) return;
        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
          products?: AdminProduct[];
          categories?: CategoryOption[];
          total?: number;
          hasMore?: boolean;
        };
        if (!isCurrent()) return;
        if (!response.ok || !data.ok) {
          const message = data.error ?? "No se pudieron cargar productos.";
          setError(message);
          toast.error(message);
          return;
        }

        if (offset === 0 && data.categories) {
          setCategories(data.categories);
        }
        if (typeof data.total === "number") {
          setCatalogTotal(data.total);
        }

        const batch = data.products ?? [];
        setProducts((prev) => {
          // Con orden por «última revisión», un producto revisado mientras se
          // pagina cambia de sitio y puede volver en la página siguiente.
          const seen = reset ? new Set<string>() : new Set(prev.map((p) => p.id));
          const fresh = batch.filter((p) => !seen.has(p.id) && seen.add(p.id));
          const next = reset ? fresh : [...prev, ...fresh];
          if (reset) {
            const valid = new Set(next.map((p) => p.id));
            setSelectedIds((prevSelected) => {
              const kept = new Set<string>();
              for (const id of prevSelected) {
                if (valid.has(id)) kept.add(id);
              }
              return kept;
            });
          }
          return next;
        });

        nextOffsetRef.current = offset + batch.length;
        const more =
          batch.length > 0 &&
          (data.hasMore === true ||
            (typeof data.total === "number" &&
              nextOffsetRef.current < data.total));
        hasMoreRef.current = more;
        setHasMore(more);
      } catch {
        if (!isCurrent()) return;
        setError("Error de red al cargar productos.");
        toast.error("Error de red al cargar productos.");
      } finally {
        // Solo la petición vigente limpia el estado de carga: si una recarga
        // la ha sustituido, esa recarga es la que lo gestiona.
        if (isCurrent()) {
          setLoading(false);
          setLoadingMore(false);
          loadInFlightRef.current = false;
        }
      }
    },
    [
      toast,
      deferredQuery,
      categoryFilter,
      retailerFilter,
      staleFilter,
      dealFilter,
      sortKey,
      sortDir,
    ],
  );

  const load = useCallback(() => {
    void loadPage(true);
  }, [loadPage]);

  const productForm = useProductForm({
    categories,
    setCategories,
    setError,
    setMessage,
    onOpen: () => setViewingProduct(null),
    onSaved: load,
  });
  const {
    setOpen,
    editingAsin,
    setEditingAsin,
    openCreate,
    openEdit,
  } = productForm;

  // `loadPage` cambia con cada filtro/orden/búsqueda (`listQueryKey`).
  const reloadList = useCallback(() => loadPage(true), [loadPage]);
  useAdminLoad(reloadList);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.key === "/" || (event.key === "k" && (event.metaKey || event.ctrlKey))) &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLSelectElement)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const refreshing = loading && products.length > 0;

  useEffect(() => {
    const el = tableScrollRef.current;
    function onScroll() {
      const tableScroll = el?.scrollTop ?? 0;
      const pageScroll = window.scrollY;
      setShowScrollTop(tableScroll > 280 || pageScroll > 420);

      if (!el || loadInFlightRef.current || !hasMoreRef.current) return;
      // La tabla solo tiene scroll propio si su alto está limitado; si crece
      // con las filas, lo que cuenta es el scroll de la página. Sin esto,
      // «cerca del final» era siempre cierto y se cargaba el catálogo entero.
      const tableScrolls = el.scrollHeight > el.clientHeight + 1;
      const nearBottom = tableScrolls
        ? el.scrollTop + el.clientHeight >= el.scrollHeight - 280
        : window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 600;
      if (nearBottom) {
        void loadPage(false);
      }
    }
    onScroll();
    el?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [loading, products.length, loadPage]);

  const staleCount = useMemo(
    () =>
      products.filter((product) => {
        const hours = freshnessMeta(product.lastCheckedAt).hours;
        return hours === null || hours >= 48;
      }).length,
    [products],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "title" || key === "asin" || key === "category" ? "asc" : "desc");
  }

  function clearFilters() {
    setQuery("");
    setCategoryFilter("");
    setRetailerFilter("");
    setStaleFilter("all");
    setDealFilter("all");
  }

  const hasActiveFilters =
    query.trim().length > 0 ||
    categoryFilter.length > 0 ||
    retailerFilter.length > 0 ||
    staleFilter !== "all" ||
    dealFilter !== "all";

  async function onDelete(product: AdminProduct) {
    const ok = window.confirm(
      `¿Eliminar «${product.title}» (${product.asin})? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setDeletingId(product.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, asin: product.asin }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        const message = data.error ?? "No se pudo eliminar.";
        setError(message);
        toast.error(message);
        return;
      }
      setMessage(`Eliminado: ${product.asin}`);
      toast.success(`Producto eliminado: ${product.asin}`);
      if (editingAsin === product.asin) {
        setOpen(false);
        setEditingAsin(null);
      }
      await load();
    } catch {
      setError("Error de red al eliminar.");
      toast.error("Error de red al eliminar.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    const visibleIds = products.map((p) => p.id);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.add(id);
        return next;
      });
    }
  }

  async function onBatchDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    const ok = window.confirm(
      `¿Eliminar ${ids.length} producto(s) seleccionado(s)? Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setBatchDeleting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        deleted?: number;
      };
      if (!response.ok || !data.ok) {
        const message = data.error ?? "No se pudo eliminar.";
        setError(message);
        toast.error(message);
        return;
      }
      const count = data.deleted ?? ids.length;
      setMessage(`Eliminados ${count} producto(s).`);
      toast.success(`Eliminados ${count} producto(s).`);
      setSelectedIds(new Set());
      setOpen(false);
      setEditingAsin(null);
      await load();
    } catch {
      setError("Error de red al eliminar.");
      toast.error("Error de red al eliminar.");
    } finally {
      setBatchDeleting(false);
    }
  }

  async function onUpdatePrice(product: AdminProduct) {
    setUpdatingAsin(product.asin);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/products/check-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: product.asin, notify: false }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        provider?: string;
        quotes?: Array<{
          asin: string;
          price: number | null;
          listPrice: number | null;
          discountPercentage: number | null;
          updated: boolean;
          unavailable?: boolean;
        }>;
        stats?: {
          updated: number;
          unchanged: number;
          dealsDetected: number;
          errors: Array<{ asin: string; message: string }>;
        };
      };
      if (!response.ok || !data.ok) {
        const message = data.error ?? "No se pudo actualizar el precio.";
        setError(message);
        toast.error(message);
        return;
      }
      const err = data.stats?.errors?.[0];
      if (err) {
        const message = `${err.asin}: ${err.message}`;
        setError(message);
        toast.error(message);
      } else {
        const quote = data.quotes?.find((item) => item.asin === product.asin);
        const store = retailerLabel(product.retailer);
        const message = quote
          ? quote.unavailable || quote.price === null
            ? `${product.asin}: agotado en ${store} (sin precio)`
            : `${product.asin}: ${quote.price.toFixed(2)} €` +
              (quote.listPrice != null
                ? ` (ref. ${quote.listPrice.toFixed(2)} €)`
                : "") +
              (quote.discountPercentage != null
                ? ` · −${Math.round(quote.discountPercentage)}%`
                : "") +
              (quote.updated ? " · actualizado" : " · sin cambio de precio")
          : `Precio ${product.asin}: ${data.stats?.updated ? "actualizado" : "sin cambios"}`;
        setMessage(message);
        toast.success(message);
      }
      await load();
    } catch {
      setError("Error de red al actualizar precio.");
      toast.error("Error de red al actualizar precio.");
    } finally {
      setUpdatingAsin(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-6.5rem)] flex-col md:min-h-[calc(100dvh-5rem)]">
      <AdminPageHeader
        eyebrow="Catálogo"
        title="Productos"
        description={
          <>
            {loading && products.length === 0
              ? "Cargando catálogo…"
              : refreshing
                ? `Actualizando listado…${
                    catalogTotal != null ? ` · ${catalogTotal} en total` : ""
                  }`
                : loadingMore
                  ? `${products.length}${
                      catalogTotal != null ? ` / ${catalogTotal}` : ""
                    } · cargando más…`
                  : `${products.length}${
                      catalogTotal != null ? ` de ${catalogTotal}` : ""
                    } productos${hasMore ? " · scroll para más" : ""}`}
            {!loading && staleCount > 0 ? (
              <span className="text-rose-700">
                {" "}
                · {staleCount} sin revisar (&gt;48 h)
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title="Recargar listado"
              className="admin-btn admin-btn-ghost"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden
              />
              Recargar
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="admin-btn admin-btn-primary"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nuevo producto
            </button>
          </>
        }
      />

      {message ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--primary-soft)] px-4 py-3 text-sm text-[var(--primary)]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="admin-toolbar">
        <AdminSearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar título, ID, marca… (/)"
          inputRef={searchInputRef}
        />

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className={`${toolbarFieldClass} min-w-[160px]`}
          aria-label="Filtrar por categoría"
        >
          <option value="">Todas las categorías</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <select
          value={retailerFilter}
          onChange={(event) => setRetailerFilter(event.target.value)}
          className={`${toolbarFieldClass} min-w-[140px]`}
          aria-label="Filtrar por tienda"
        >
          <option value="">Todas las tiendas</option>
          {PRODUCT_RETAILERS.map((retailer) => (
            <option key={retailer} value={retailer}>
              {retailerLabel(retailer)}
            </option>
          ))}
        </select>

        <select
          value={staleFilter}
          onChange={(event) =>
            setStaleFilter(event.target.value as StaleFilter)
          }
          className={`${toolbarFieldClass} min-w-[160px]`}
          aria-label="Filtrar por frescura del precio"
        >
          <option value="all">Cualquier revisión</option>
          <option value="fresh">Revisados (&lt;48 h)</option>
          <option value="stale">Desactualizados (≥48 h)</option>
          <option value="never">Nunca revisados</option>
        </select>

        <select
          value={dealFilter}
          onChange={(event) =>
            setDealFilter(event.target.value as DealFilter)
          }
          className={`${toolbarFieldClass} min-w-[160px]`}
          aria-label="Filtrar por estado de oferta"
        >
          <option value="all">Ofertas y normales</option>
          <option value="offer">Solo ofertas / chollos</option>
          <option value="normal">Ya no son oferta</option>
        </select>

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="admin-btn admin-btn-ghost"
          >
            Limpiar filtros
          </button>
        ) : null}

        {selectedIds.size > 0 ? (
          <button
            type="button"
            disabled={batchDeleting}
            onClick={() => void onBatchDelete()}
            className="admin-btn admin-btn-danger"
          >
            {batchDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Eliminar seleccionados ({selectedIds.size})
          </button>
        ) : null}
      </div>

      <ProductDetailPanel
        product={viewingProduct}
        onClose={() => setViewingProduct(null)}
        onEdit={openEdit}
      />

      <ProductFormPanel productForm={productForm} categories={categories} />

      <div
        ref={tableScrollRef}
        className="admin-table-wrap admin-table-wrap--fill mt-4 min-h-0 flex-1"
      >
        <table className="admin-products-table w-full text-left text-sm">
          <colgroup>
            <col className="col-check" />
            <col className="col-title" />
            <col className="col-store" />
            <col className="col-price" />
            <col className="col-reference" />
            <col className="col-score" />
            <col className="col-category" />
            <col className="col-checked" />
            <col className="col-actions" />
          </colgroup>
          <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 text-xs text-stone-500 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={
                    products.length > 0 &&
                    products.every((p) => selectedIds.has(p.id))
                  }
                  onChange={toggleSelectAllVisible}
                  disabled={loading || products.length === 0}
                  aria-label="Seleccionar todos los productos visibles"
                  className="h-4 w-4 accent-[var(--primary)]"
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Título"
                  active={sortKey === "title"}
                  direction={sortDir}
                  onClick={() => toggleSort("title")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Tienda / ID"
                  active={sortKey === "asin"}
                  direction={sortDir}
                  onClick={() => toggleSort("asin")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Precio"
                  active={sortKey === "currentPrice"}
                  direction={sortDir}
                  onClick={() => toggleSort("currentPrice")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Referencia"
                  active={sortKey === "referencePrice"}
                  direction={sortDir}
                  onClick={() => toggleSort("referencePrice")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Score"
                  active={sortKey === "dealScore"}
                  direction={sortDir}
                  onClick={() => toggleSort("dealScore")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Categoría"
                  active={sortKey === "category"}
                  direction={sortDir}
                  onClick={() => toggleSort("category")}
                />
              </th>
              <th className="px-4 py-3">
                <AdminSortButton
                  label="Última revisión"
                  active={sortKey === "lastCheckedAt"}
                  direction={sortDir}
                  onClick={() => toggleSort("lastCheckedAt")}
                />
              </th>
              <th className="sticky right-0 z-20 bg-stone-50 px-4 py-3 font-semibold shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.12)]">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className={refreshing ? "is-reloading" : undefined}>
            {loading && products.length === 0 ? (
              <AdminProductsTableSkeleton rows={12} />
            ) : !loading && products.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-stone-500">
                  {hasActiveFilters
                    ? (
                        <>
                          Ningún producto coincide con la búsqueda o los filtros.{" "}
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="font-medium text-teal-800 underline"
                          >
                            Limpiar filtros
                          </button>
                        </>
                      )
                    : "No hay productos todavía. Añade el primero con «Nuevo producto»."}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-stone-100 align-middle hover:bg-stone-50/80"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      aria-label={`Seleccionar ${product.title}`}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden bg-stone-200">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p
                          className="line-clamp-2 cursor-pointer font-medium leading-snug text-ink hover:text-teal-900"
                          onClick={() => {
                            setOpen(false);
                            setViewingProduct(product);
                          }}
                          title="Ver datos en BD"
                        >
                          {product.title}
                        </p>
                        {product.brand ? (
                          <p className="mt-0.5 text-xs text-stone-500">
                            {product.brand}
                          </p>
                        ) : null}
                        {(() => {
                          const badges = productStatusBadges(product);
                          if (badges.length === 0) return null;
                          return (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {badges.map((badge) => (
                                <span
                                  key={badge.key}
                                  className={`inline-flex rounded-sm border px-1.5 py-0.5 text-xs font-semibold ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <AdminRetailerBadge retailer={product.retailer} />
                    <p className="mt-1 font-mono text-[11px] text-[var(--text-muted)]">
                      {product.externalId ?? product.asin}
                    </p>
                    {(() => {
                      const note = adminPriceCheckNote(
                        normalizeRetailer(product.retailer),
                      );
                      return note ? (
                        <p className="mt-1 whitespace-normal text-xs text-amber-800">{note}</p>
                      ) : null;
                    })()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {product.currentPrice.toFixed(2)} €
                    {product.discountPercentage > 0 ? (
                      <span className="mt-1 block text-xs text-amber-800">
                        −{Math.round(product.discountPercentage)}%
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                    {product.referencePrice.toFixed(2)} €
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium">
                      {Math.round(product.dealScore)}
                    </span>
                    <span className="mt-1 block text-xs text-stone-500">
                      {product.dealLabel}
                    </span>
                    {product.isActive &&
                    product.availability !== "OUT_OF_STOCK" &&
                    ((product.dealLevel != null &&
                      product.dealLevel !== "NORMAL") ||
                      product.discountPercentage >= 5) ? (
                      <span className="mt-1 inline-block rounded-sm bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
                        Oferta
                      </span>
                    ) : (
                      <span className="mt-1 inline-block rounded-sm bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-stone-600">
                        Normal
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                    {product.category?.name ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {(() => {
                      const fresh = freshnessMeta(product.lastCheckedAt);
                      return (
                        <span
                          className={`text-xs leading-snug ${fresh.className}`}
                          title={formatFullDateTime(product.lastCheckedAt)}
                        >
                          {fresh.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="sticky right-0 z-10 bg-white px-3 py-3 shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.1)]">
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        title="Ver datos en BD"
                        aria-label="Ver datos en BD"
                        onClick={() => {
                          setOpen(false);
                          setViewingProduct(product);
                        }}
                        className={iconBtnClass}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <AdminRowMenu
                        label={`Acciones de ${product.title}`}
                        items={[
                          {
                            key: "edit",
                            label: "Editar producto",
                            icon: <Pencil className="h-4 w-4" />,
                            onSelect: () => openEdit(product),
                          },
                          {
                            key: "store",
                            label: `Abrir en ${retailerLabel(product.retailer)}`,
                            icon: <ExternalLink className="h-4 w-4" />,
                            onSelect: () => {
                              window.open(
                                buildTrackedAffiliatePath({
                                  productId: product.id,
                                  source: "admin",
                                  test: true,
                                }),
                                "_blank",
                                "noopener,noreferrer",
                              );
                            },
                          },
                          {
                            key: "price",
                            label: "Revisar precio",
                            icon: <RefreshCw className="h-4 w-4" />,
                            disabled:
                              adminPriceCheckNote(
                                normalizeRetailer(product.retailer),
                              ) !== null,
                            hint:
                              adminPriceCheckNote(
                                normalizeRetailer(product.retailer),
                              ) ?? undefined,
                            loading: updatingAsin === product.asin,
                            onSelect: () => void onUpdatePrice(product),
                          },
                          {
                            key: "delete",
                            label: "Eliminar",
                            icon: <Trash2 className="h-4 w-4" />,
                            tone: "danger",
                            loading: deletingId === product.id,
                            onSelect: () => void onDelete(product),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
            {loadingMore ? (
              <tr className="admin-products-table__load-more">
                <td colSpan={9}>
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Cargando más productos…
                  </span>
                </td>
              </tr>
            ) : null}
            {!loading && !loadingMore && products.length > 0 && !hasMore ? (
              <tr className="admin-products-table__load-more">
                <td colSpan={9}>
                  {catalogTotal != null
                    ? `Fin del listado · ${catalogTotal} productos`
                    : "Fin del listado"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {showScrollTop ? (
        <button
          type="button"
          onClick={() => {
            tableScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="admin-btn admin-btn-primary fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full p-0 shadow-lg md:bottom-8 md:right-8"
          title="Volver arriba"
          aria-label="Volver arriba"
        >
          <ChevronUp className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
