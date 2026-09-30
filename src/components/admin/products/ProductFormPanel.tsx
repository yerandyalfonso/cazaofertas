"use client";

import { Loader2, Plus } from "lucide-react";
import { AdminSidePanel } from "@/components/admin/AdminSidePanel";
import type { CategoryOption } from "@/components/admin/products/productsAdmin";
import type { useProductForm } from "@/components/admin/products/useProductForm";
import { PRODUCT_RETAILERS, retailerLabel } from "@/lib/retailers";

/** Panel lateral de alta/edición de producto. El estado vive en `useProductForm`. */
export function ProductFormPanel({
  productForm,
  categories,
}: {
  productForm: ReturnType<typeof useProductForm>;
  categories: CategoryOption[];
}) {
  const {
    createCategory,
    creatingCategory,
    editingAsin,
    form,
    formRetailerDef,
    formScrapeSupported,
    liveDiscount,
    newCategoryName,
    onRetailerChange,
    onSave,
    onUrlChange,
    open,
    saving,
    scrapeFromUrl,
    scraping,
    setForm,
    setNewCategoryName,
    setOpen,
    setShowNewCategory,
    showNewCategory,
  } = productForm;

  return (
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
            <label className="text-xs font-semibold text-stone-500">
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
            <label className="text-xs font-semibold text-stone-500">
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
            <label className="text-xs font-semibold text-stone-500">
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
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:underline disabled:opacity-50"
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
          <label className="md:col-span-2 text-xs font-semibold text-stone-500">
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
            <p className="text-xs font-semibold text-stone-500">
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

          <label className="text-xs font-semibold text-stone-500">
            Marca
            <input
              value={form.brand}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, brand: event.target.value }))
              }
              className="admin-input mt-2"
            />
          </label>
          <label className="text-xs font-semibold text-stone-500">
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
          <label className="text-xs font-semibold text-stone-500">
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
          <label className="md:col-span-2 text-xs font-semibold text-stone-500">
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
          <label className="md:col-span-2 text-xs font-semibold text-stone-500">
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
  );
}
