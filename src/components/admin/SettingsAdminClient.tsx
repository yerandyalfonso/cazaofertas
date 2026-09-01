"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToast";
import type { AppSettings } from "@/services/appSettings";

type SettingsForm = {
  telegramMinScore: string;
  miraviaTelegramMinScore: string;
  kiabiTelegramMinScore: string;
  telegramBatchHours: string;
  telegramFlushRescheduleMinutes: string;
  amazonAssociateTag: string;
  amazonFlashInsertLimit: string;
  miraviaDealsEnabled: boolean;
  miraviaMinDiscountPercent: string;
  miraviaDiscoveryMaxItems: string;
  miraviaFlashLimit: string;
  miraviaFlashUpdateLimit: string;
  kiabiDealsEnabled: boolean;
  kiabiMinDiscountPercent: string;
  kiabiDiscoveryMaxItems: string;
  kiabiNewProductsOnly: boolean;
};

function settingsToForm(settings: AppSettings): SettingsForm {
  return {
    telegramMinScore: String(settings.telegramMinScore),
    miraviaTelegramMinScore: String(settings.miraviaTelegramMinScore),
    kiabiTelegramMinScore: String(settings.kiabiTelegramMinScore),
    telegramBatchHours: String(settings.telegramBatchHours),
    telegramFlushRescheduleMinutes: String(
      settings.telegramFlushRescheduleMinutes,
    ),
    amazonAssociateTag: settings.amazonAssociateTag,
    amazonFlashInsertLimit: String(settings.amazonFlashInsertLimit),
    miraviaDealsEnabled: settings.miraviaDealsEnabled,
    miraviaMinDiscountPercent: String(settings.miraviaMinDiscountPercent),
    miraviaDiscoveryMaxItems: String(settings.miraviaDiscoveryMaxItems),
    miraviaFlashLimit: String(settings.miraviaFlashLimit),
    miraviaFlashUpdateLimit: String(settings.miraviaFlashUpdateLimit),
    kiabiDealsEnabled: settings.kiabiDealsEnabled,
    kiabiMinDiscountPercent: String(settings.kiabiMinDiscountPercent),
    kiabiDiscoveryMaxItems: String(settings.kiabiDiscoveryMaxItems),
    kiabiNewProductsOnly: settings.kiabiNewProductsOnly,
  };
}

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
      {children}
      {hint ? (
        <span className="mt-1 block font-normal normal-case tracking-normal text-stone-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function SettingsAdminClient() {
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
          telegramMinScore: Number(form.telegramMinScore),
          miraviaTelegramMinScore: Number(form.miraviaTelegramMinScore),
          kiabiTelegramMinScore: Number(form.kiabiTelegramMinScore),
          telegramBatchHours: Number(form.telegramBatchHours),
          telegramFlushRescheduleMinutes: Number(
            form.telegramFlushRescheduleMinutes,
          ),
          amazonAssociateTag: form.amazonAssociateTag,
          amazonFlashInsertLimit: Number(form.amazonFlashInsertLimit),
          miraviaDealsEnabled: form.miraviaDealsEnabled,
          miraviaMinDiscountPercent: Number(form.miraviaMinDiscountPercent),
          miraviaDiscoveryMaxItems: Number(form.miraviaDiscoveryMaxItems),
          miraviaFlashLimit: Number(form.miraviaFlashLimit),
          miraviaFlashUpdateLimit: Number(form.miraviaFlashUpdateLimit),
          kiabiDealsEnabled: form.kiabiDealsEnabled,
          kiabiMinDiscountPercent: Number(form.kiabiMinDiscountPercent),
          kiabiDiscoveryMaxItems: Number(form.kiabiDiscoveryMaxItems),
          kiabiNewProductsOnly: form.kiabiNewProductsOnly,
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
        <p className="mt-2 text-sm text-stone-500">
          Envío manual y cola Telegram:{" "}
          <Link href="/admin/cron" className="text-teal-800 underline">
            Monitorización / Cron
          </Link>
        </p>
      </header>

      <section className="admin-card p-6">
        <h2 className="font-display text-2xl text-ink">Telegram — criterios</h2>
        <p className="mt-1 text-sm text-stone-600">
          Score mínimo para encolar ofertas al grupo/canal según tienda.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <FieldLabel hint="Amazon y resto de retailers">Amazon</FieldLabel>
            <input
              type="number"
              min="0"
              max="100"
              value={form.telegramMinScore}
              onChange={(e) => patch("telegramMinScore", e.target.value)}
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel hint="Descuentos ~15–25%">Miravia</FieldLabel>
            <input
              type="number"
              min="0"
              max="100"
              value={form.miraviaTelegramMinScore}
              onChange={(e) =>
                patch("miraviaTelegramMinScore", e.target.value)
              }
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel>Kiabi</FieldLabel>
            <input
              type="number"
              min="0"
              max="100"
              value={form.kiabiTelegramMinScore}
              onChange={(e) => patch("kiabiTelegramMinScore", e.target.value)}
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel hint="Intervalo entre lotes">Lote cada (horas)</FieldLabel>
            <input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={form.telegramBatchHours}
              onChange={(e) => patch("telegramBatchHours", e.target.value)}
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel hint="Si quedan pendientes tras un lote">
              Reintento (min)
            </FieldLabel>
            <input
              type="number"
              min="5"
              max="120"
              value={form.telegramFlushRescheduleMinutes}
              onChange={(e) =>
                patch("telegramFlushRescheduleMinutes", e.target.value)
              }
              className="admin-input mt-2 w-full"
            />
          </div>
        </div>
      </section>

      <section className="admin-card p-6">
        <h2 className="font-display text-2xl text-ink">Amazon</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel hint="Tag de afiliado en enlaces generados">
              Associate tag
            </FieldLabel>
            <input
              type="text"
              value={form.amazonAssociateTag}
              onChange={(e) => patch("amazonAssociateTag", e.target.value)}
              placeholder="cazaoferta-21"
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel hint="Por pasada del cron flash">
              Máx. inserciones flash
            </FieldLabel>
            <input
              type="number"
              min="1"
              max="20"
              value={form.amazonFlashInsertLimit}
              onChange={(e) => patch("amazonFlashInsertLimit", e.target.value)}
              className="admin-input mt-2 w-full"
            />
          </div>
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
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <FieldLabel>Descuento mín. (%)</FieldLabel>
            <input
              type="number"
              min="1"
              max="90"
              value={form.miraviaMinDiscountPercent}
              onChange={(e) =>
                patch("miraviaMinDiscountPercent", e.target.value)
              }
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel>Discovery máx.</FieldLabel>
            <input
              type="number"
              min="10"
              max="200"
              value={form.miraviaDiscoveryMaxItems}
              onChange={(e) =>
                patch("miraviaDiscoveryMaxItems", e.target.value)
              }
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel>Insertar / pasada</FieldLabel>
            <input
              type="number"
              min="1"
              max="5"
              value={form.miraviaFlashLimit}
              onChange={(e) => patch("miraviaFlashLimit", e.target.value)}
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel>Actualizar / pasada</FieldLabel>
            <input
              type="number"
              min="1"
              max="5"
              value={form.miraviaFlashUpdateLimit}
              onChange={(e) =>
                patch("miraviaFlashUpdateLimit", e.target.value)
              }
              className="admin-input mt-2 w-full"
            />
          </div>
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
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Descuento mín. (%)</FieldLabel>
            <input
              type="number"
              min="1"
              max="90"
              value={form.kiabiMinDiscountPercent}
              onChange={(e) => patch("kiabiMinDiscountPercent", e.target.value)}
              className="admin-input mt-2 w-full"
            />
          </div>
          <div>
            <FieldLabel>Discovery máx.</FieldLabel>
            <input
              type="number"
              min="10"
              max="300"
              value={form.kiabiDiscoveryMaxItems}
              onChange={(e) => patch("kiabiDiscoveryMaxItems", e.target.value)}
              className="admin-input mt-2 w-full"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
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
