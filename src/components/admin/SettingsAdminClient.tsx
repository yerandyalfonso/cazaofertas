"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminField } from "@/components/admin/AdminField";
import { useAdminToast } from "@/components/admin/AdminToast";
import { formatFeedUrlsText } from "@/lib/feed-urls";
import type { AppSettings } from "@/services/appSettings";

type SettingsForm = {
  telegramMinDiscountPercent: string;
  telegramBatchHours: string;
  telegramFlushRescheduleMinutes: string;
  telegramFlushLimit: string;
  amazonAssociateTag: string;
  amazonFlashInsertLimit: string;
  asinScrapeFailThreshold: string;
  amazonFlashFeedUrls: string;
  amazonDepartmentFeedsPerRun: string;
  miraviaDealsEnabled: boolean;
  miraviaMinDiscountPercent: string;
  miraviaDiscoveryMaxItems: string;
  miraviaFlashLimit: string;
  miraviaFlashUpdateLimit: string;
  miraviaFeedUrls: string;
  miraviaFeedsPerRun: string;
  kiabiDealsEnabled: boolean;
  kiabiMinDiscountPercent: string;
  kiabiDiscoveryMaxItems: string;
  kiabiNewProductsOnly: boolean;
  kiabiFeedUrls: string;
  kiabiFeedsPerRun: string;
};

function settingsToForm(settings: AppSettings): SettingsForm {
  return {
    telegramMinDiscountPercent: String(settings.telegramMinDiscountPercent),
    telegramBatchHours: String(settings.telegramBatchHours),
    telegramFlushRescheduleMinutes: String(
      settings.telegramFlushRescheduleMinutes,
    ),
    telegramFlushLimit: String(settings.telegramFlushLimit),
    amazonAssociateTag: settings.amazonAssociateTag,
    amazonFlashInsertLimit: String(settings.amazonFlashInsertLimit),
    asinScrapeFailThreshold: String(settings.asinScrapeFailThreshold),
    amazonFlashFeedUrls: formatFeedUrlsText(settings.amazonFlashFeedUrls),
    amazonDepartmentFeedsPerRun: String(settings.amazonDepartmentFeedsPerRun),
    miraviaDealsEnabled: settings.miraviaDealsEnabled,
    miraviaMinDiscountPercent: String(settings.miraviaMinDiscountPercent),
    miraviaDiscoveryMaxItems: String(settings.miraviaDiscoveryMaxItems),
    miraviaFlashLimit: String(settings.miraviaFlashLimit),
    miraviaFlashUpdateLimit: String(settings.miraviaFlashUpdateLimit),
    miraviaFeedUrls: formatFeedUrlsText(settings.miraviaFeedUrls),
    miraviaFeedsPerRun: String(settings.miraviaFeedsPerRun),
    kiabiDealsEnabled: settings.kiabiDealsEnabled,
    kiabiMinDiscountPercent: String(settings.kiabiMinDiscountPercent),
    kiabiDiscoveryMaxItems: String(settings.kiabiDiscoveryMaxItems),
    kiabiNewProductsOnly: settings.kiabiNewProductsOnly,
    kiabiFeedUrls: formatFeedUrlsText(settings.kiabiFeedUrls),
    kiabiFeedsPerRun: String(settings.kiabiFeedsPerRun),
  };
}

export function SettingsAdminClient({ embedded = false }: { embedded?: boolean } = {}) {
  const toast = useAdminToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<"database" | "env">("env");
  const [form, setForm] = useState<SettingsForm | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/settings");
      const data = (await response.json()) as {
        ok?: boolean;
        settings?: AppSettings;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.settings) {
        throw new Error(data.error ?? "No se pudieron cargar los ajustes.");
      }
      setForm(settingsToForm(data.settings));
      setSource(data.settings.source);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al cargar ajustes.",
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function patch<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramMinDiscountPercent: Number(form.telegramMinDiscountPercent),
          telegramBatchHours: Number(form.telegramBatchHours),
          telegramFlushRescheduleMinutes: Number(
            form.telegramFlushRescheduleMinutes,
          ),
          telegramFlushLimit: Number(form.telegramFlushLimit),
          amazonAssociateTag: form.amazonAssociateTag,
          amazonFlashInsertLimit: Number(form.amazonFlashInsertLimit),
          asinScrapeFailThreshold: Number(form.asinScrapeFailThreshold),
          amazonFlashFeedUrls: form.amazonFlashFeedUrls,
          amazonDepartmentFeedsPerRun: Number(form.amazonDepartmentFeedsPerRun),
          miraviaDealsEnabled: form.miraviaDealsEnabled,
          miraviaMinDiscountPercent: Number(form.miraviaMinDiscountPercent),
          miraviaDiscoveryMaxItems: Number(form.miraviaDiscoveryMaxItems),
          miraviaFlashLimit: Number(form.miraviaFlashLimit),
          miraviaFlashUpdateLimit: Number(form.miraviaFlashUpdateLimit),
          miraviaFeedUrls: form.miraviaFeedUrls,
          miraviaFeedsPerRun: Number(form.miraviaFeedsPerRun),
          kiabiDealsEnabled: form.kiabiDealsEnabled,
          kiabiMinDiscountPercent: Number(form.kiabiMinDiscountPercent),
          kiabiDiscoveryMaxItems: Number(form.kiabiDiscoveryMaxItems),
          kiabiNewProductsOnly: form.kiabiNewProductsOnly,
          kiabiFeedUrls: form.kiabiFeedUrls,
          kiabiFeedsPerRun: Number(form.kiabiFeedsPerRun),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        settings?: AppSettings;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.settings) {
        throw new Error(data.error ?? "No se pudieron guardar los ajustes.");
      }
      setForm(settingsToForm(data.settings));
      setSource(data.settings.source);
      toast.success("Configuración guardada.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return (
      <div className="admin-card p-8 text-sm text-stone-500">
        Cargando configuración…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!embedded ? (
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
            Ajustes
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">Configuración</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">
            Valores operativos del sitio y los crons. Tienen prioridad sobre{" "}
            <code className="text-xs">.env.local</code> cuando los guardas aquí.
            {source === "env" ? (
              <>
                {" "}
                Ahora mismo se usan valores de entorno hasta el primer guardado.
              </>
            ) : null}
          </p>
        </header>
      ) : (
        <p className="text-sm text-stone-600">
          Los valores guardados aquí tienen prioridad sobre{" "}
          <code className="text-xs">.env.local</code>.
          {source === "env"
            ? " Hasta el primer guardado se usan variables de entorno."
            : null}
        </p>
      )}

      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-3 border border-stone-200 bg-paper/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="admin-btn admin-btn-primary"
        >
          {saving ? "Guardando…" : "Guardar configuración"}
        </button>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void load()}
          className="admin-btn admin-btn-ghost"
        >
          Recargar
        </button>
        <span className="text-xs text-stone-500">
          Fuente: {source === "database" ? "base de datos" : "entorno"}
        </span>
      </div>

      <section className="admin-card p-6">
        <h2 className="font-display text-2xl text-ink">Canal Telegram</h2>
        <p className="mt-1 text-sm text-stone-600">
          Descuento mínimo (%) para encolar ofertas. Misma regla para Amazon,
          Miravia, Kiabi y el resto.
        </p>
        <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <AdminField
            label="Dto. mínimo canal (%)"
            hint="Ej. 20 = solo ofertas con −20% o más"
          >
            <input
              type="number"
              min="0"
              max="99"
              step="1"
              value={form.telegramMinDiscountPercent}
              onChange={(e) =>
                patch("telegramMinDiscountPercent", e.target.value)
              }
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField label="Lote cada (horas)" hint="Intervalo entre lotes">
            <input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={form.telegramBatchHours}
              onChange={(e) => patch("telegramBatchHours", e.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField
            label="Reintento (min)"
            hint="Si quedan pendientes tras un lote"
          >
            <input
              type="number"
              min="5"
              max="120"
              value={form.telegramFlushRescheduleMinutes}
              onChange={(e) =>
                patch("telegramFlushRescheduleMinutes", e.target.value)
              }
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField
            label="Tamaño lote Telegram"
            hint="Máx. mensajes por lote al grupo"
          >
            <input
              type="number"
              min="5"
              max="80"
              value={form.telegramFlushLimit}
              onChange={(e) => patch("telegramFlushLimit", e.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
        </div>
      </section>

      <section className="admin-card p-6">
        <h2 className="font-display text-2xl text-ink">Feeds de descubrimiento</h2>
        <p className="mt-1 text-sm text-stone-600">
          Una URL por línea. En cada pasada del cron se consultan solo unas
          pocas (rotación automática cada ~3 min). La lista por defecto incluye
          Gold Box, departamentos Amazon, Miravia y Kiabi; puedes editarla o
          añadir más.
        </p>
        <div className="mt-5 space-y-6">
          <AdminField
            label="Feeds Amazon flash"
            hint="Gold Box / departamentos Amazon"
          >
            <textarea
              rows={5}
              value={form.amazonFlashFeedUrls}
              onChange={(e) => patch("amazonFlashFeedUrls", e.target.value)}
              placeholder="https://www.amazon.es/gp/goldbox"
              className="admin-input w-full font-mono text-xs"
            />
          </AdminField>
          <AdminField
            label="Feeds Amazon / pasada"
            hint="Cuántas URLs Amazon por pasada"
            className="max-w-xs"
          >
            <input
              type="number"
              min="1"
              max="8"
              value={form.amazonDepartmentFeedsPerRun}
              onChange={(e) =>
                patch("amazonDepartmentFeedsPerRun", e.target.value)
              }
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField label="Feeds Miravia" hint="Páginas de ofertas Miravia">
            <textarea
              rows={4}
              value={form.miraviaFeedUrls}
              onChange={(e) => patch("miraviaFeedUrls", e.target.value)}
              placeholder="https://www.miravia.es/flashsale/home"
              className="admin-input w-full font-mono text-xs"
            />
          </AdminField>
          <AdminField label="Feeds Miravia / pasada" className="max-w-xs">
            <input
              type="number"
              min="1"
              max="5"
              value={form.miraviaFeedsPerRun}
              onChange={(e) => patch("miraviaFeedsPerRun", e.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField label="Feeds Kiabi" hint="Listados promocionales Kiabi">
            <textarea
              rows={3}
              value={form.kiabiFeedUrls}
              onChange={(e) => patch("kiabiFeedUrls", e.target.value)}
              placeholder="https://www.kiabi.es/promociones_464410"
              className="admin-input w-full font-mono text-xs"
            />
          </AdminField>
          <AdminField label="Feeds Kiabi / pasada" className="max-w-xs">
            <input
              type="number"
              min="1"
              max="5"
              value={form.kiabiFeedsPerRun}
              onChange={(e) => patch("kiabiFeedsPerRun", e.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
        </div>
      </section>

      <section className="admin-card p-6">
        <h2 className="font-display text-2xl text-ink">Amazon</h2>
        <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <AdminField
            label="Associate tag"
            hint="Vacío = se usa AMAZON_ASSOCIATE_TAG del entorno en los enlaces"
          >
            <input
              type="text"
              value={form.amazonAssociateTag}
              onChange={(e) => patch("amazonAssociateTag", e.target.value)}
              placeholder="(usar variable de entorno)"
              className="admin-input w-full"
              autoComplete="off"
            />
          </AdminField>
          <AdminField
            label="Máx. inserciones flash"
            hint="Por pasada del cron flash"
          >
            <input
              type="number"
              min="1"
              max="20"
              value={form.amazonFlashInsertLimit}
              onChange={(e) => patch("amazonFlashInsertLimit", e.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField
            label="Fallos scrape → desactivar"
            hint="Intentos fallidos seguidos del mismo ASIN antes de desactivarlo"
          >
            <input
              type="number"
              min="1"
              max="50"
              value={form.asinScrapeFailThreshold}
              onChange={(e) =>
                patch("asinScrapeFailThreshold", e.target.value)
              }
              className="admin-input w-full"
            />
          </AdminField>
        </div>
      </section>

      <section className="admin-card p-6">
        <h2 className="font-display text-2xl text-ink">Miravia</h2>
        <label className="mt-4 flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={form.miraviaDealsEnabled}
            onChange={(e) => patch("miraviaDealsEnabled", e.target.checked)}
            className="h-4 w-4 accent-teal-800"
          />
          Cron flash Miravia activo
        </label>
        <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <AdminField label="Descuento mín. (%)">
            <input
              type="number"
              min="1"
              max="90"
              value={form.miraviaMinDiscountPercent}
              onChange={(e) =>
                patch("miraviaMinDiscountPercent", e.target.value)
              }
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField label="Discovery máx.">
            <input
              type="number"
              min="10"
              max="200"
              value={form.miraviaDiscoveryMaxItems}
              onChange={(e) =>
                patch("miraviaDiscoveryMaxItems", e.target.value)
              }
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField label="Insertar / pasada">
            <input
              type="number"
              min="1"
              max="5"
              value={form.miraviaFlashLimit}
              onChange={(e) => patch("miraviaFlashLimit", e.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField label="Actualizar / pasada">
            <input
              type="number"
              min="1"
              max="5"
              value={form.miraviaFlashUpdateLimit}
              onChange={(e) =>
                patch("miraviaFlashUpdateLimit", e.target.value)
              }
              className="admin-input w-full"
            />
          </AdminField>
        </div>
      </section>

      <section className="admin-card p-6">
        <h2 className="font-display text-2xl text-ink">Kiabi</h2>
        <label className="mt-4 flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={form.kiabiDealsEnabled}
            onChange={(e) => patch("kiabiDealsEnabled", e.target.checked)}
            className="h-4 w-4 accent-teal-800"
          />
          Cron Kiabi activo
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={form.kiabiNewProductsOnly}
            onChange={(e) => patch("kiabiNewProductsOnly", e.target.checked)}
            className="h-4 w-4 accent-teal-800"
          />
          Solo productos nuevos (salvo bajadas en listado)
        </label>
        <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <AdminField label="Descuento mín. (%)">
            <input
              type="number"
              min="1"
              max="90"
              value={form.kiabiMinDiscountPercent}
              onChange={(e) => patch("kiabiMinDiscountPercent", e.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
          <AdminField label="Discovery máx.">
            <input
              type="number"
              min="10"
              max="300"
              value={form.kiabiDiscoveryMaxItems}
              onChange={(e) => patch("kiabiDiscoveryMaxItems", e.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 pb-4">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="admin-btn admin-btn-primary"
        >
          {saving ? "Guardando…" : "Guardar configuración"}
        </button>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => void load()}
          className="admin-btn admin-btn-ghost"
        >
          Recargar
        </button>
      </div>
    </div>
  );
}
