"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
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
  const lastScrapedUrl = useRef<string>("");
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
        const message = `Precio ${product.asin}: ${data.stats?.updated ? "actualizado" : "sin cambios"}${
          data.stats?.dealsDetected
            ? ` · ${data.stats.dealsDetected} chollo(s)`
            : ""
        }`;
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
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            Catálogo
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            Productos
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nuevo producto
        </button>
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

      <div className="mt-8 overflow-x-auto border border-stone-300 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Título</th>
              <th className="px-4 py-3 font-semibold">ASIN</th>
              <th className="px-4 py-3 font-semibold">Precio</th>
              <th className="px-4 py-3 font-semibold">Referencia</th>
              <th className="px-4 py-3 font-semibold">Score</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-stone-500">
                  Cargando…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-stone-500">
                  No hay productos. Crea uno o ejecuta el seed.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr
                  key={product.id}
                  className="border-t border-stone-100 align-middle"
                >
                  <td className="px-4 py-3">
                    <p className="max-w-xs font-medium text-ink">
                      {product.title}
                    </p>
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
                    <div className="flex items-center gap-1.5">
                      <a
                        href={buildTrackedAffiliatePath({
                          productId: product.id,
                          source: "admin",
                          test: true,
                        })}
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
                        title="Actualizar precio"
                        aria-label="Actualizar precio"
                        disabled={updatingAsin === product.asin}
                        onClick={() => void onUpdatePrice(product)}
                        className={iconBtnClass}
                      >
                        {updatingAsin === product.asin ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
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
    </div>
  );
}
