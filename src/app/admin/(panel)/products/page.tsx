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
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { extractAsin } from "@/lib/affiliate";
import { buildTrackedAffiliatePath } from "@/lib/affiliate-tracking";
import { useAdminToast } from "@/components/admin/AdminToast";

interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  asin: string;
  brand: string | null;
  amazonUrl: string;
  currentPrice: number;
  previousPrice: number | null;
  referencePrice: number;
  dealScore: number;
  dealLabel: string;
  discountPercentage: number;
  category: { id: string; name: string; slug: string } | null;
  isActive: boolean;
  lastCheckedAt: string | null;
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

function sortValue(product: AdminProduct, key: SortKey): string | number {
  switch (key) {
    case "title":
      return product.title.toLocaleLowerCase("es");
    case "asin":
      return product.asin;
    case "currentPrice":
      return product.currentPrice;
    case "referencePrice":
      return product.referencePrice;
    case "dealScore":
      return product.dealScore;
    case "category":
      return (product.category?.name ?? "").toLocaleLowerCase("es");
    case "lastCheckedAt":
      return product.lastCheckedAt
        ? new Date(product.lastCheckedAt).getTime()
        : 0;
  }
}

const emptyForm = {
  amazonUrl: "",
  title: "",
  categoryId: "",
  referencePrice: "",
  currentPrice: "",
  brand: "",
};

const iconBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-stone-200 bg-white text-stone-600 transition hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";

const toolbarFieldClass =
  "h-10 border border-stone-300 bg-white px-3 text-sm text-ink outline-none focus:border-ink";

export default function ProductsAdminClient() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [updatingAsin, setUpdatingAsin] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingAsin, setEditingAsin] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [scrapedDiscount, setScrapedDiscount] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [staleFilter, setStaleFilter] = useState<StaleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("lastCheckedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const lastScrapedUrl = useRef<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);
  const toast = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/products");
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        products?: AdminProduct[];
        categories?: CategoryOption[];
      };
      if (!response.ok || !data.ok) {
        const message = data.error ?? "No se pudieron cargar productos.";
        setError(message);
        toast.error(message);
        return;
      }
      setProducts(data.products ?? []);
      setCategories(data.categories ?? []);
    } catch {
      setError("Error de red al cargar productos.");
      toast.error("Error de red al cargar productos.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const visibleProducts = useMemo(() => {
    const needle = deferredQuery.trim().toLocaleLowerCase("es");
    const filtered = products.filter((product) => {
      if (categoryFilter && product.category?.id !== categoryFilter) {
        return false;
      }

      if (staleFilter !== "all") {
        const hours = freshnessMeta(product.lastCheckedAt).hours;
        if (staleFilter === "never" && hours !== null) return false;
        if (staleFilter === "fresh" && (hours === null || hours >= 48)) {
          return false;
        }
        if (staleFilter === "stale" && hours !== null && hours < 48) {
          return false;
        }
      }

      if (!needle) return true;
      const haystack = [
        product.title,
        product.asin,
        product.brand ?? "",
        product.category?.name ?? "",
        product.dealLabel,
      ]
        .join(" ")
        .toLocaleLowerCase("es");
      return haystack.includes(needle);
    });

    const sorted = [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), "es", {
          numeric: true,
          sensitivity: "base",
        });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [
    products,
    deferredQuery,
    categoryFilter,
    staleFilter,
    sortKey,
    sortDir,
  ]);

  useEffect(() => {
    const el = tableScrollRef.current;
    function updateVisibility() {
      const tableScroll = el?.scrollTop ?? 0;
      const pageScroll = window.scrollY;
      setShowScrollTop(tableScroll > 280 || pageScroll > 420);
    }
    updateVisibility();
    el?.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => {
      el?.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("scroll", updateVisibility);
    };
  }, [loading, visibleProducts.length]);

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
    setStaleFilter("all");
  }

  const hasActiveFilters =
    query.trim().length > 0 ||
    categoryFilter.length > 0 ||
    staleFilter !== "all";

  function openCreate() {
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
    setEditingAsin(product.asin);
    setForm({
      amazonUrl: product.amazonUrl,
      title: product.title,
      categoryId: product.category?.id ?? "",
      referencePrice: String(product.referencePrice),
      currentPrice: String(product.currentPrice),
      brand: product.brand ?? "",
    });
    setShowNewCategory(false);
    setNewCategoryName("");
    setScrapedDiscount(
      product.discountPercentage > 0 ? product.discountPercentage : null,
    );
    lastScrapedUrl.current = product.amazonUrl;
    setMessage(null);
    setError(null);
    setOpen(true);
  }

  function onUrlChange(value: string) {
    setForm((prev) => ({
      ...prev,
      amazonUrl: value,
    }));
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
    const url = form.amazonUrl.trim();
    if (!url || !extractAsin(url)) {
      if (force) setError("Pega una URL de Amazon válida con ASIN.");
      return;
    }
    if (!force && lastScrapedUrl.current === url) return;

    setScraping(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/products/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amazonUrl: url }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        title?: string | null;
        price?: number | null;
        listPrice?: number | null;
        referencePrice?: number | null;
        discountPercentage?: number | null;
        amazonUrl?: string;
        asin?: string;
      };

      if (!response.ok || !data.ok) {
        setError(data.error ?? "No se pudo extraer datos de Amazon.");
        return;
      }

      lastScrapedUrl.current = data.amazonUrl ?? url;
      const current = data.price;
      const reference =
        data.listPrice ??
        data.referencePrice ??
        (current != null ? current : null);

      setForm((prev) => ({
        ...prev,
        amazonUrl: data.amazonUrl ?? prev.amazonUrl,
        title: data.title?.trim() || prev.title,
        currentPrice: current != null ? String(current) : prev.currentPrice,
        referencePrice:
          reference != null ? String(reference) : prev.referencePrice,
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
      setMessage(
        current != null
          ? `Extraído: ${data.title ?? "sin título"} · oferta ${current.toFixed(2)} €${
              data.listPrice != null
                ? ` (antes ${data.listPrice.toFixed(2)} €)`
                : ""
            }${discountLabel}`
          : `Título extraído${data.title ? `: ${data.title}` : ""}. Precio no disponible.`,
      );
    } catch {
      setError("Error de red al consultar Amazon.");
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
          amazonUrl: form.amazonUrl,
          title: form.title,
          categoryId: form.categoryId || undefined,
          referencePrice: Number(form.referencePrice),
          currentPrice: form.currentPrice
            ? Number(form.currentPrice)
            : undefined,
          brand: form.brand || undefined,
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
          price: number;
          listPrice: number | null;
          discountPercentage: number | null;
          updated: boolean;
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
          ? `${product.asin}: ${quote.price.toFixed(2)} €` +
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            Catálogo
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            Productos
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            {loading
              ? "Cargando catálogo…"
              : `${visibleProducts.length} de ${products.length} productos`}
            {!loading && staleCount > 0 ? (
              <span className="text-rose-700">
                {" "}
                · {staleCount} sin revisar (&gt;48 h)
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            title="Recargar listado"
            className="inline-flex h-11 items-center gap-2 border border-stone-300 bg-white px-4 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-ink hover:text-ink disabled:opacity-50"
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
            className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Nuevo producto
          </button>
        </div>
      </header>

      {message ? (
        <p className="mt-4 border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 border border-stone-300 bg-white p-4 md:flex-row md:flex-wrap md:items-center">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Buscar productos</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden
          />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar título, ASIN, marca… (/)"
            className={`${toolbarFieldClass} w-full pl-9 pr-9`}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-ink"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>

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

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="h-10 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600 hover:text-ink"
          >
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {open ? (
        <section className="mt-8 border border-stone-300 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl text-ink">
              {editingAsin ? "Editar producto" : "Nuevo producto"}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-stone-500 hover:text-ink"
            >
              Cerrar
            </button>
          </div>
          <form
            onSubmit={(event) => void onSave(event)}
            className="mt-6 grid gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                URL de Amazon
                <input
                  required
                  value={form.amazonUrl}
                  onChange={(event) => onUrlChange(event.target.value)}
                  onBlur={() => void scrapeFromUrl(false)}
                  placeholder="https://www.amazon.es/.../dp/B0XXXXXXXX/"
                  className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
                />
              </label>
              <button
                type="button"
                disabled={scraping || !form.amazonUrl.trim()}
                onClick={() => void scrapeFromUrl(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-teal-800 hover:underline disabled:opacity-50"
              >
                {scraping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                {scraping
                  ? "Extrayendo de Amazon…"
                  : "Extraer título y precios ahora"}
              </button>
            </div>
            <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Título
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
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
                  className="h-11 w-full border border-stone-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
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
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 bg-ink px-3 text-xs font-semibold uppercase tracking-[0.12em] text-paper disabled:opacity-60"
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
                className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
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
                className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
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
                className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
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
            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-11 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900 disabled:opacity-60"
              >
                {saving
                  ? "Guardando…"
                  : editingAsin
                    ? "Guardar cambios"
                    : "Guardar en Supabase"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div
        ref={tableScrollRef}
        className="mt-4 min-h-0 flex-1 overflow-auto border border-stone-300 bg-white"
      >
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
            <tr>
              <th className="px-4 py-3">
                <SortButton column="title" label="Título" />
              </th>
              <th className="px-4 py-3">
                <SortButton column="asin" label="ASIN" />
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
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-stone-500">
                  Cargando…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-stone-500">
                  No hay productos todavía. Añade el primero con «Nuevo producto».
                </td>
              </tr>
            ) : visibleProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-stone-500">
                  Ningún producto coincide con la búsqueda o los filtros.{" "}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-medium text-teal-800 underline"
                  >
                    Limpiar filtros
                  </button>
                </td>
              </tr>
            ) : (
              visibleProducts.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-stone-100 align-middle hover:bg-stone-50/80"
                >
                  <td className="px-4 py-3">
                    <p className="max-w-xs font-medium text-ink">
                      {product.title}
                    </p>
                    {product.brand ? (
                      <p className="mt-0.5 text-xs text-stone-500">
                        {product.brand}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{product.asin}</td>
                  <td className="px-4 py-3">
                    {product.currentPrice.toFixed(2)} €
                    {product.discountPercentage > 0 ? (
                      <span className="mt-1 block text-xs text-amber-800">
                        −{Math.round(product.discountPercentage)}%
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {product.referencePrice.toFixed(2)} €
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">
                      {Math.round(product.dealScore)}
                    </span>
                    <span className="mt-1 block text-xs text-stone-500">
                      {product.dealLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {product.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
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
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={buildTrackedAffiliatePath({
                          productId: product.id,
                          source: "admin",
                          test: true,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver en Amazon (clic de prueba)"
                        aria-label="Ver en Amazon (clic de prueba)"
                        className={iconBtnClass}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        title="Editar producto"
                        aria-label="Editar producto"
                        onClick={() => openEdit(product)}
                        className={iconBtnClass}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Revisar precio ahora"
                        aria-label="Revisar precio ahora"
                        disabled={updatingAsin === product.asin}
                        onClick={() => void onUpdatePrice(product)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-teal-800 bg-teal-50 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal-900 transition hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {updatingAsin === product.asin ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Revisar
                      </button>
                      <button
                        type="button"
                        title="Eliminar"
                        aria-label="Eliminar"
                        disabled={deletingId === product.id}
                        onClick={() => void onDelete(product)}
                        className={`${iconBtnClass} hover:border-rose-600 hover:text-rose-700`}
                      >
                        {deletingId === product.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
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
          className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center border border-stone-300 bg-ink text-paper shadow-lg transition hover:bg-teal-900 md:bottom-8 md:right-8"
          title="Volver arriba"
          aria-label="Volver arriba"
        >
          <ChevronUp className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
