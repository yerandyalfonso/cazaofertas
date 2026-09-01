"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronUp,
  Eye,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import { availabilityLabel } from "@/lib/out-of-stock-policy";
import { splitProductDescription } from "@/lib/product-description";
import {
  detectRetailerFromUrl,
  getRetailerDefinition,
  isProductRetailer,
  PRODUCT_RETAILERS,
  retailerBuyCtaLabel,
  retailerLabel,
  retailerScrapeSupported,
  type ProductRetailer,
} from "@/lib/retailers";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  AdminPageHeader,
  AdminRetailerBadge,
  AdminSearchField,
} from "@/components/admin/AdminListChrome";
import { AdminSidePanel } from "@/components/admin/AdminSidePanel";
import { AdminRowMenu } from "@/components/admin/AdminRowMenu";
import { AdminProductsTableSkeleton } from "@/components/admin/AdminSkeleton";

interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  asin: string;
  retailer: string;
  externalId: string | null;
  brand: string | null;
  description?: string | null;
  productUrl: string;
  amazonUrl: string;
  affiliateUrl?: string | null;
  imageUrl?: string | null;
  currentPrice: number;
  previousPrice: number | null;
  lowestPrice?: number | null;
  highestPrice?: number | null;
  averagePrice30d?: number | null;
  averagePrice90d?: number | null;
  referencePrice: number;
  dealScore: number;
  dealLabel: string;
  dealLevel?: string;
  discountPercentage: number;
  currency?: string;
  availability?: string;
  availabilityLabel?: string;
  outOfStockAt?: string | null;
  category: { id: string; name: string; slug: string } | null;
  isActive: boolean;
  isFeatured?: boolean;
  lastCheckedAt: string | null;
  lastTelegramNotifiedAt?: string | null;
  lastTelegramNotifiedPrice?: number | null;
  lastTelegramNotifiedScore?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

type SortKey =
  | "title"
  | "asin"
  | "currentPrice"
  | "referencePrice"
  | "dealScore"
  | "category"
  | "lastCheckedAt";

type SortDir = "asc" | "desc";
type StaleFilter = "all" | "fresh" | "stale" | "never";
type DealFilter = "all" | "offer" | "normal";

function productStatusBadges(product: AdminProduct) {
  const badges: Array<{ key: string; label: string; className: string }> = [];

  if (product.availability === "OUT_OF_STOCK") {
    badges.push({
      key: "oos",
      label: "Agotado",
      className:
        "border-amber-300 bg-amber-50 text-amber-900",
    });
  }

  if (!product.isActive) {
    badges.push({
      key: "inactive",
      label: "Inactivo",
      className: "border-stone-300 bg-stone-100 text-stone-600",
    });
  }

  return badges;
}

function freshnessMeta(lastCheckedAt: string | null): {
  label: string;
  className: string;
  hours: number | null;
} {
  if (!lastCheckedAt) {
    return { label: "Nunca", className: "text-rose-700", hours: null };
  }
  const ageMs = Date.now() - new Date(lastCheckedAt).getTime();
  const hours = ageMs / 3_600_000;
  if (hours < 6) {
    return {
      label: new Date(lastCheckedAt).toLocaleString("es-ES"),
      className: "text-teal-800",
      hours,
    };
  }
  if (hours < 48) {
    return {
      label: new Date(lastCheckedAt).toLocaleString("es-ES"),
      className: "text-amber-800",
      hours,
    };
  }
  return {
    label: new Date(lastCheckedAt).toLocaleString("es-ES"),
    className: "text-rose-700",
    hours,
  };
}

const emptyForm = {
  retailer: "amazon" as ProductRetailer,
  productUrl: "",
  externalId: "",
  title: "",
  categoryId: "",
  referencePrice: "",
  currentPrice: "",
  brand: "",
  imageUrl: "",
  description: "",
};

const iconBtnClass = "admin-icon-btn";

const toolbarFieldClass = "admin-select w-auto";

export default function ProductsAdminClient() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [updatingAsin, setUpdatingAsin] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [editingAsin, setEditingAsin] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [scrapedDiscount, setScrapedDiscount] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [retailerFilter, setRetailerFilter] = useState("");
  const [staleFilter, setStaleFilter] = useState<StaleFilter>("all");
  const [dealFilter, setDealFilter] = useState<DealFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastCheckedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const lastScrapedUrl = useRef<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nextOffsetRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadInFlightRef = useRef(false);
  const deferredQuery = useDeferredValue(query);
  const toast = useAdminToast();

  const formRetailerDef = useMemo(
    () => getRetailerDefinition(form.retailer),
    [form.retailer],
  );
  const formScrapeSupported = retailerScrapeSupported(form.retailer);

  const PAGE_SIZE = 100;

  const listQueryKey = useMemo(
    () =>
      JSON.stringify({
        q: deferredQuery.trim(),
        categoryFilter,
        retailerFilter,
        staleFilter,
        dealFilter,
        sortKey,
        sortDir,
      }),
    [
      deferredQuery,
      categoryFilter,
      retailerFilter,
      staleFilter,
      dealFilter,
      sortKey,
      sortDir,
    ],
  );

  const loadPage = useCallback(
    async (reset: boolean) => {
      if (loadInFlightRef.current) return;
      if (!reset && !hasMoreRef.current) return;

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
        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
          products?: AdminProduct[];
          categories?: CategoryOption[];
          total?: number;
          hasMore?: boolean;
        };
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
          const next = reset ? batch : [...prev, ...batch];
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
        setError("Error de red al cargar productos.");
        toast.error("Error de red al cargar productos.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        loadInFlightRef.current = false;
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

  useEffect(() => {
    void loadPage(true);
  }, [listQueryKey, loadPage]);

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
      const nearBottom =
        el.scrollTop + el.clientHeight >= el.scrollHeight - 280;
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

  function SortButton({
    column,
    label,
  }: {
    column: SortKey;
    label: string;
  }) {
    const active = sortKey === column;
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        className={`inline-flex items-center gap-1 font-semibold uppercase tracking-[0.12em] transition hover:text-ink ${
          active ? "text-ink" : "text-stone-500"
        }`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden />
        )}
      </button>
    );
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

  function openCreate() {
    setViewingProduct(null);
    setEditingAsin(null);
    setForm(emptyForm);
    setShowNewCategory(false);
    setNewCategoryName("");
    setScrapedDiscount(null);
    lastScrapedUrl.current = "";
    setMessage(null);
    setError(null);
    setOpen(true);
  }

  function openEdit(product: AdminProduct) {
    setViewingProduct(null);
    setEditingAsin(product.asin);
    const retailer = isProductRetailer(product.retailer)
      ? product.retailer
      : "amazon";
    setForm({
      retailer,
      productUrl: product.productUrl || product.amazonUrl,
      externalId: product.externalId ?? "",
      title: product.title,
      categoryId: product.category?.id ?? "",
      referencePrice: String(product.referencePrice),
      currentPrice: String(product.currentPrice),
      brand: product.brand ?? "",
      imageUrl: product.imageUrl ?? "",
      description: product.description ?? "",
    });
    setShowNewCategory(false);
    setNewCategoryName("");
    setScrapedDiscount(
      product.discountPercentage > 0 ? product.discountPercentage : null,
    );
    lastScrapedUrl.current = product.productUrl || product.amazonUrl;
    setMessage(null);
    setError(null);
    setOpen(true);
  }

  function onUrlChange(value: string) {
    const detected = detectRetailerFromUrl(value);
    setForm((prev) => ({
      ...prev,
      productUrl: value,
      retailer: detected ?? prev.retailer,
    }));
  }

  function onRetailerChange(value: string) {
    if (!isProductRetailer(value)) return;
    setForm((prev) => ({ ...prev, retailer: value }));
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError("Escribe un nombre para la nueva categoría.");
      return;
    }

    setCreatingCategory(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        category?: CategoryOption;
      };
      if (!response.ok || !data.ok || !data.category) {
        setError(data.error ?? "No se pudo crear la categoría.");
        return;
      }

      setCategories((prev) => {
        const without = prev.filter((item) => item.id !== data.category!.id);
        return [...without, data.category!].sort((a, b) =>
          a.name.localeCompare(b.name, "es"),
        );
      });
      setForm((prev) => ({ ...prev, categoryId: data.category!.id }));
      setNewCategoryName("");
      setShowNewCategory(false);
      setMessage(`Categoría «${data.category.name}» lista.`);
    } catch {
      setError("Error de red al crear la categoría.");
    } finally {
      setCreatingCategory(false);
    }
  }

  async function scrapeFromUrl(force = false) {
    const url = form.productUrl.trim();
    const scrapeInput = url || form.externalId.trim();

    if (!scrapeInput) {
      if (force) {
        setError("Pega la URL del producto o su identificador.");
      }
      return;
    }

    if (!formScrapeSupported) {
      if (force) {
        setError(
          `${formRetailerDef.label} no tiene extracción automática. Rellena los campos manualmente.`,
        );
      }
      return;
    }

    if (!force && lastScrapedUrl.current === scrapeInput) return;

    setScraping(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/products/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productUrl: scrapeInput,
          retailer: form.retailer,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        partial?: boolean;
        warning?: string | null;
        title?: string | null;
        brand?: string | null;
        price?: number | null;
        listPrice?: number | null;
        referencePrice?: number | null;
        discountPercentage?: number | null;
        productUrl?: string;
        amazonUrl?: string;
        asin?: string;
        externalId?: string;
        retailer?: ProductRetailer;
        categorySlug?: string | null;
        imageUrl?: string | null;
        description?: string | null;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "No se pudo extraer datos de la ficha.");
        return;
      }

      if (data.warning) {
        toast.info(data.warning);
      }

      lastScrapedUrl.current = data.productUrl ?? data.amazonUrl ?? scrapeInput;
      const current = data.price;
      const reference =
        data.listPrice ??
        data.referencePrice ??
        (current != null ? current : null);

      const matchedCategory =
        data.categorySlug != null
          ? categories.find((c) => c.slug === data.categorySlug)
          : undefined;

      setForm((prev) => ({
        ...prev,
        retailer: data.retailer ?? prev.retailer,
        productUrl: data.productUrl ?? data.amazonUrl ?? prev.productUrl,
        externalId: data.externalId ?? prev.externalId,
        title: data.title?.trim() || prev.title,
        brand: data.brand?.trim() || prev.brand,
        currentPrice: current != null ? String(current) : prev.currentPrice,
        referencePrice:
          reference != null ? String(reference) : prev.referencePrice,
        categoryId: matchedCategory?.id ?? prev.categoryId,
        imageUrl: data.imageUrl?.trim() || prev.imageUrl,
        description: data.description?.trim() || prev.description,
      }));
      setScrapedDiscount(
        data.discountPercentage != null && data.discountPercentage > 0
          ? data.discountPercentage
          : current != null &&
              reference != null &&
              reference > current
            ? Math.round(((reference - current) / reference) * 10000) / 100
            : null,
      );

      const discountLabel =
        data.discountPercentage != null && data.discountPercentage > 0
          ? ` · −${Math.round(data.discountPercentage)}%`
          : "";
      const partialNote = data.partial ? " (extracción parcial)" : "";
      setMessage(
        data.warning
          ? data.warning
          : current != null
            ? `Extraído${partialNote}: ${data.title ?? "sin título"} · oferta ${current.toFixed(2)} €${
                data.listPrice != null
                  ? ` (antes ${data.listPrice.toFixed(2)} €)`
                  : ""
              }${discountLabel}`
            : `Título extraído${partialNote}${data.title ? `: ${data.title}` : ""}. Precio no disponible — complétalo manualmente.`,
      );
    } catch {
      setError("Error de red al consultar la tienda.");
    } finally {
      setScraping(false);
    }
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailer: form.retailer,
          productUrl: form.productUrl,
          externalId: form.externalId || undefined,
          title: form.title,
          categoryId: form.categoryId || undefined,
          referencePrice: Number(form.referencePrice),
          currentPrice: form.currentPrice
            ? Number(form.currentPrice)
            : undefined,
          brand: form.brand || undefined,
          imageUrl: form.imageUrl || undefined,
          description: form.description || undefined,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        const message = data.error ?? "No se pudo guardar.";
        setError(message);
        toast.error(message);
        return;
      }
      const success = editingAsin
        ? "Producto actualizado."
        : "Producto creado / upsert.";
      setMessage(success);
      toast.success(success);
      setForm(emptyForm);
      setEditingAsin(null);
      setScrapedDiscount(null);
      setOpen(false);
      await load();
    } catch {
      setError("Error de red al guardar.");
      toast.error("Error de red al guardar.");
    } finally {
      setSaving(false);
    }
  }

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
        const message = quote
          ? quote.unavailable || quote.price === null
            ? `${product.asin}: agotado en Amazon (sin precio)`
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

  const liveDiscount = (() => {
    const current = Number(form.currentPrice);
    const reference = Number(form.referencePrice);
    if (
      Number.isFinite(current) &&
      Number.isFinite(reference) &&
      reference > current &&
      current > 0
    ) {
      return Math.round(((reference - current) / reference) * 10000) / 100;
    }
    return scrapedDiscount;
  })();

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

      <AdminSidePanel
        open={Boolean(viewingProduct)}
        onClose={() => setViewingProduct(null)}
        eyebrow="Consulta BD"
        title={viewingProduct?.title ?? ""}
        size="xl"
        headerActions={
          viewingProduct ? (
            <>
              <a
                href={`/producto/${viewingProduct.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn-ghost h-9 px-3 text-[10px]"
              >
                Ver en web
              </a>
              <a
                href={
                  viewingProduct.productUrl ||
                  viewingProduct.amazonUrl ||
                  (viewingProduct.retailer === "amazon"
                    ? `https://www.amazon.es/dp/${viewingProduct.asin}`
                    : "#")
                }
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn-primary h-9 px-3 text-[10px]"
              >
                {retailerBuyCtaLabel(viewingProduct.retailer)}
              </a>
              <button
                type="button"
                onClick={() => {
                  openEdit(viewingProduct);
                }}
                className="admin-btn admin-btn-ghost h-9 px-3 text-[10px]"
              >
                Editar
              </button>
            </>
          ) : null
        }
      >
        {viewingProduct ? (
          <>
            <div className="admin-detail-hero">
              <div className="admin-detail-hero__image">
                {viewingProduct.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewingProduct.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-[var(--text-muted)]">
                    Sin imagen
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  <AdminRetailerBadge retailer={viewingProduct.retailer} />
                  {viewingProduct.discountPercentage > 0 ? (
                    <span className="admin-badge">
                      −{Math.round(viewingProduct.discountPercentage)}%
                    </span>
                  ) : null}
                  <span className="admin-badge admin-badge--muted">
                    {Math.round(viewingProduct.dealScore)} · {viewingProduct.dealLabel}
                  </span>
                  {productStatusBadges(viewingProduct).map((badge) => (
                    <span
                      key={badge.key}
                      className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--text)]">
                  {viewingProduct.currentPrice.toFixed(2)} €
                  {viewingProduct.previousPrice != null ? (
                    <span className="ml-2 text-base font-medium text-[var(--text-muted)] line-through">
                      {viewingProduct.previousPrice.toFixed(2)} €
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {viewingProduct.brand ?? "Sin marca"}
                  {viewingProduct.category?.name
                    ? ` · ${viewingProduct.category.name}`
                    : ""}
                </p>
                <p className="mt-2 font-mono text-[11px] text-[var(--text-muted)]">
                  {viewingProduct.externalId ?? viewingProduct.asin}
                </p>
              </div>
            </div>

            <section className="admin-detail-section">
              <h3>Identificación</h3>
              <dl className="admin-detail-grid">
                {(
                  [
                    ["Tienda", retailerLabel(viewingProduct.retailer)],
                    ["ASIN / ID", viewingProduct.asin],
                    ["Externo", viewingProduct.externalId ?? "—"],
                    ["Slug", viewingProduct.slug],
                    ["Marca", viewingProduct.brand ?? "—"],
                    ["Categoría", viewingProduct.category?.name ?? "—"],
                    ["UUID", viewingProduct.id],
                  ] as Array<[string, string]>
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd className={label === "UUID" || label === "Slug" ? "admin-detail-muted" : undefined}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="admin-detail-section">
              <h3>Precios</h3>
              <dl className="admin-detail-grid">
                {(
                  [
                    ["Actual", `${viewingProduct.currentPrice.toFixed(2)} €`],
                    [
                      "Anterior",
                      viewingProduct.previousPrice != null
                        ? `${viewingProduct.previousPrice.toFixed(2)} €`
                        : "—",
                    ],
                    [
                      "Mínimo",
                      viewingProduct.lowestPrice != null
                        ? `${viewingProduct.lowestPrice.toFixed(2)} €`
                        : "—",
                    ],
                    [
                      "Máximo",
                      viewingProduct.highestPrice != null
                        ? `${viewingProduct.highestPrice.toFixed(2)} €`
                        : "—",
                    ],
                    [
                      "Media 30d",
                      viewingProduct.averagePrice30d != null
                        ? `${viewingProduct.averagePrice30d.toFixed(2)} €`
                        : "—",
                    ],
                    [
                      "Media 90d",
                      viewingProduct.averagePrice90d != null
                        ? `${viewingProduct.averagePrice90d.toFixed(2)} €`
                        : "—",
                    ],
                    [
                      "Descuento",
                      viewingProduct.discountPercentage > 0
                        ? `−${Math.round(viewingProduct.discountPercentage)}%`
                        : "—",
                    ],
                    [
                      "Score",
                      `${Math.round(viewingProduct.dealScore)} · ${viewingProduct.dealLabel}`,
                    ],
                    ["Nivel", viewingProduct.dealLevel ?? "—"],
                    ["Moneda", viewingProduct.currency ?? "EUR"],
                  ] as Array<[string, string]>
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="admin-detail-section">
              <h3>Estado</h3>
              <dl className="admin-detail-grid">
                {(
                  [
                    [
                      "Disponibilidad",
                      viewingProduct.availabilityLabel ??
                        availabilityLabel(viewingProduct.availability),
                    ],
                    [
                      "Agotado desde",
                      viewingProduct.outOfStockAt
                        ? new Date(viewingProduct.outOfStockAt).toLocaleString("es-ES")
                        : "—",
                    ],
                    ["Activo", viewingProduct.isActive ? "Sí" : "No"],
                    ["Destacado", viewingProduct.isFeatured ? "Sí" : "No"],
                    [
                      "Última revisión",
                      viewingProduct.lastCheckedAt
                        ? new Date(viewingProduct.lastCheckedAt).toLocaleString("es-ES")
                        : "—",
                    ],
                    [
                      "Último Telegram",
                      viewingProduct.lastTelegramNotifiedAt
                        ? new Date(viewingProduct.lastTelegramNotifiedAt).toLocaleString("es-ES")
                        : "—",
                    ],
                    [
                      "Precio notificado",
                      viewingProduct.lastTelegramNotifiedPrice != null
                        ? `${viewingProduct.lastTelegramNotifiedPrice.toFixed(2)} €`
                        : "—",
                    ],
                    [
                      "Score notificado",
                      viewingProduct.lastTelegramNotifiedScore != null
                        ? String(Math.round(viewingProduct.lastTelegramNotifiedScore))
                        : "—",
                    ],
                    [
                      "Creado",
                      viewingProduct.createdAt
                        ? new Date(viewingProduct.createdAt).toLocaleString("es-ES")
                        : "—",
                    ],
                    [
                      "Actualizado",
                      viewingProduct.updatedAt
                        ? new Date(viewingProduct.updatedAt).toLocaleString("es-ES")
                        : "—",
                    ],
                  ] as Array<[string, string]>
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="admin-detail-section">
              <h3>Enlaces</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    URL producto
                  </p>
                  <p className="admin-detail-muted mt-1">
                    {viewingProduct.productUrl || viewingProduct.amazonUrl || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Affiliate
                  </p>
                  <p className="admin-detail-muted mt-1">
                    {viewingProduct.affiliateUrl || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    Imagen
                  </p>
                  <p className="admin-detail-muted mt-1">
                    {viewingProduct.imageUrl || "—"}
                  </p>
                </div>
              </div>
            </section>

            <section className="admin-detail-section">
              <h3>Descripción</h3>
              {(() => {
                const parts = splitProductDescription(viewingProduct.description);
                if (parts.length === 0) {
                  return (
                    <p className="text-sm text-[var(--text-muted)]">Sin descripción</p>
                  );
                }
                return (
                  <ul className="space-y-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    {parts.map((part, index) => (
                      <li key={`${index}-${part.slice(0, 24)}`}>• {part}</li>
                    ))}
                  </ul>
                );
              })()}
            </section>
          </>
        ) : null}
      </AdminSidePanel>

      <AdminSidePanel
        open={open}
        onClose={() => setOpen(false)}
        eyebrow={editingAsin ? "Editar" : "Alta"}
        title={editingAsin ? "Editar producto" : "Nuevo producto"}
        size="xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="admin-btn admin-btn-ghost"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="admin-product-form"
              disabled={saving}
              className="admin-btn admin-btn-primary"
            >
              {saving
                ? "Guardando…"
                : editingAsin
                  ? "Guardar cambios"
                  : "Guardar en Supabase"}
            </button>
          </>
        }
      >
<form
            id="admin-product-form"
            onSubmit={(event) => void onSave(event)}
            className="grid gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                Tienda
                <select
                  value={form.retailer}
                  onChange={(event) => onRetailerChange(event.target.value)}
                  className="admin-input mt-2"
                >
                  {PRODUCT_RETAILERS.map((retailer) => (
                    <option key={retailer} value={retailer}>
                      {retailerLabel(retailer)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                ID en tienda
                <span className="ml-1 font-normal normal-case text-stone-400">
                  ({formRetailerDef.externalIdHint})
                </span>
                <input
                  value={form.externalId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      externalId: event.target.value,
                    }))
                  }
                  placeholder={
                    form.retailer === "amazon" ? "B0XXXXXXXXXX" : "Opcional si está en la URL"
                  }
                  className="admin-input mt-2"
                />
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                URL del producto
                <input
                  required
                  value={form.productUrl}
                  onChange={(event) => onUrlChange(event.target.value)}
                  onBlur={() => void scrapeFromUrl(false)}
                  placeholder={formRetailerDef.urlPlaceholder}
                  className="admin-input mt-2"
                />
              </label>
              {formScrapeSupported ? (
                <button
                  type="button"
                  disabled={
                    scraping ||
                    (!form.productUrl.trim() && !form.externalId.trim())
                  }
                  onClick={() => void scrapeFromUrl(true)}
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal-800 hover:underline disabled:opacity-50"
                >
                  {scraping ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : null}
                  {scraping
                    ? `Extrayendo de ${formRetailerDef.label}…`
                    : `Extraer título y precios de ${formRetailerDef.label}`}
                </button>
              ) : (
                <p className="mt-2 text-xs text-stone-500">
                  {formRetailerDef.label} no tiene extracción automática todavía.
                  Rellena título y precios manualmente.
                </p>
              )}
            </div>
            <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Título
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="admin-input mt-2"
              />
            </label>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                Categoría
              </p>
              <div className="mt-2 flex gap-2">
                <select
                  value={form.categoryId}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "__new__") {
                      setShowNewCategory(true);
                      return;
                    }
                    setShowNewCategory(false);
                    setForm((prev) => ({ ...prev, categoryId: value }));
                  }}
                  className="admin-input"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                  <option value="__new__">+ Nueva categoría…</option>
                </select>
              </div>
              {showNewCategory ? (
                <div className="mt-2 flex gap-2">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void createCategory();
                      }
                    }}
                    placeholder="Nombre de la categoría"
                    className="h-11 w-full border border-stone-300 px-3 text-sm text-ink outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    disabled={creatingCategory}
                    onClick={() => void createCategory()}
                    title="Crear categoría"
                    className="admin-btn admin-btn-primary shrink-0"
                  >
                    {creatingCategory ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Crear
                  </button>
                </div>
              ) : null}
            </div>

            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Marca
              <input
                value={form.brand}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, brand: event.target.value }))
                }
                className="admin-input mt-2"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Precio de referencia (€)
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={form.referencePrice}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    referencePrice: event.target.value,
                  }))
                }
                className="admin-input mt-2"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Precio actual / oferta (€)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.currentPrice}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    currentPrice: event.target.value,
                  }))
                }
                className="admin-input mt-2"
              />
            </label>
            <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              URL de imagen
              <input
                value={form.imageUrl}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="https://static.carrefour.es/..."
                className="admin-input mt-2"
              />
            </label>
            {form.imageUrl.trim() ? (
              <div className="md:col-span-2">
                <img
                  src={form.imageUrl.trim()}
                  alt="Vista previa"
                  className="h-32 w-32 rounded-sm border border-stone-200 bg-white object-contain p-2"
                />
              </div>
            ) : null}
            <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Descripción
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="mt-2 w-full border border-stone-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
              />
            </label>
            {liveDiscount != null && liveDiscount > 0 ? (
              <p className="md:col-span-2 text-sm text-amber-800">
                Descuento detectado:{" "}
                <span className="font-semibold">
                  −{Math.round(liveDiscount)}%
                </span>
              </p>
            ) : null}
          </form>
      </AdminSidePanel>

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
          <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
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
                <SortButton column="title" label="Título" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="asin" label="Tienda / ID" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="currentPrice" label="Precio" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="referencePrice" label="Referencia" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="dealScore" label="Score" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="category" label="Categoría" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="lastCheckedAt" label="Última revisión" />
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
                                  className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${badge.className}`}
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
                      <span className="mt-1 inline-block rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-900">
                        Oferta
                      </span>
                    ) : (
                      <span className="mt-1 inline-block rounded-sm bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-600">
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
                            disabled: product.retailer !== "amazon",
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
