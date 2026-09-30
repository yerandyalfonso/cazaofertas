"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  emptyForm,
  type AdminProduct,
  type CategoryOption,
} from "@/components/admin/products/productsAdmin";
import {
  detectRetailerFromUrl,
  getRetailerDefinition,
  isProductRetailer,
  retailerScrapeSupported,
  type ProductRetailer,
} from "@/lib/retailers";

/**
 * Estado y acciones del formulario de alta/edición de Productos: abrir,
 * extraer datos de la ficha, crear categoría y guardar. Los avisos van al
 * `setError`/`setMessage` de la página, que los muestra fuera del panel.
 */
export function useProductForm({
  categories,
  setCategories,
  setError,
  setMessage,
  onOpen,
  onSaved,
}: {
  categories: CategoryOption[];
  setCategories: Dispatch<SetStateAction<CategoryOption[]>>;
  setError: (message: string | null) => void;
  setMessage: (message: string | null) => void;
  /** Al abrir el formulario (cierra el panel de detalle). */
  onOpen: () => void;
  /** Tras guardar, para recargar la lista. */
  onSaved: () => unknown;
}) {
  const toast = useAdminToast();
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingAsin, setEditingAsin] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [scrapedDiscount, setScrapedDiscount] = useState<number | null>(null);
  const lastScrapedUrl = useRef<string>("");
  const formRetailerDef = useMemo(
    () => getRetailerDefinition(form.retailer),
    [form.retailer],
  );
  const formScrapeSupported = retailerScrapeSupported(form.retailer);

  function openCreate() {
    onOpen();
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
    onOpen();
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
      await onSaved();
    } catch {
      setError("Error de red al guardar.");
      toast.error("Error de red al guardar.");
    } finally {
      setSaving(false);
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

  return {
    liveDiscount,
    saving,
    scraping,
    creatingCategory,
    open,
    setOpen,
    editingAsin,
    setEditingAsin,
    form,
    setForm,
    showNewCategory,
    setShowNewCategory,
    newCategoryName,
    setNewCategoryName,
    scrapedDiscount,
    formRetailerDef,
    formScrapeSupported,
    openCreate,
    openEdit,
    onUrlChange,
    onRetailerChange,
    createCategory,
    scrapeFromUrl,
    onSave,
  };
}
