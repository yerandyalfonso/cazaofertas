"use client";

import { useCallback, useEffect, useState } from "react";

interface CronStatus {
  activeProducts: number;
  withAmazonUrl: number;
  lastCheckedAt: string | null;
}

interface CronRunResult {
  ok: boolean;
  error?: string;
  monitorable?: number;
  scoped?: number;
  finishedAt?: string;
  stats?: {
    processed: number;
    updated: number;
    unchanged: number;
    dealsDetected: number;
    notificationsSent: number;
    errors: Array<{ asin: string; message: string }>;
    deals: Array<{
      asin: string;
      title: string;
      scoring: { score: number; label: string; level: string };
    }>;
  };
}

interface FlashRunResult {
  ok: boolean;
  error?: string;
  finishedAt?: string;
  focus?: string;
  discovery?: {
    feedsFetched: number;
    candidates: number;
    newAsins?: number;
    existingAsins?: number;
    usedSimulation?: boolean;
    feedErrors: Array<{ url: string; message: string }>;
  };
  catalogScanned?: number;
  flashDealsDetected?: number;
  inserted?: number;
  updated?: number;
  unchanged?: number;
  newLows?: number;
  channelNotificationsSent?: number;
  channelNotificationsSkipped?: number;
  products?: Array<{
    asin: string;
    title: string;
    action: string;
    isFlashDeal: boolean;
    isNewLow: boolean;
    wasNewToCatalog?: boolean;
    currentPrice: number | null;
    listPrice: number | null;
    discountPercentage: number | null;
    dealLabel?: string;
    amazonUrl: string;
  }>;
  errors?: Array<{ asin: string; message: string }>;
}

export function CronAdminClient() {
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [result, setResult] = useState<CronRunResult | null>(null);
  const [flashResult, setFlashResult] = useState<FlashRunResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningFlash, setRunningFlash] = useState(false);
  const [limit, setLimit] = useState("10");
  const [flashLimit, setFlashLimit] = useState("20");
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/cron/run");
      const data = (await response.json()) as CronStatus & {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || data.ok === false) {
        setError(data.error ?? "No se pudo cargar el estado.");
        return;
      }
      setStatus({
        activeProducts: data.activeProducts,
        withAmazonUrl: data.withAmazonUrl,
        lastCheckedAt: data.lastCheckedAt,
      });
    } catch {
      setError("Error de red al cargar estado.");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function runCron() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const parsedLimit = Number.parseInt(limit, 10);
      const response = await fetch("/api/admin/cron/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: Number.isFinite(parsedLimit) ? parsedLimit : 10,
          notify: true,
        }),
      });
      const data = (await response.json()) as CronRunResult;
      setResult(data);
      if (!response.ok || !data.ok) {
        setError(data.error ?? "La revisión falló.");
      }
      await loadStatus();
    } catch {
      setError("Error de red al ejecutar el cron.");
    } finally {
      setRunning(false);
    }
  }

  async function runFlashCron() {
    setRunningFlash(true);
    setError(null);
    setFlashResult(null);
    try {
      const parsedLimit = Number.parseInt(flashLimit, 10);
      const response = await fetch("/api/admin/cron/flash-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limit: Number.isFinite(parsedLimit) ? parsedLimit : 20,
          allowSimulatedFallback: true,
          notify: true,
        }),
      });
      const data = (await response.json()) as FlashRunResult;
      setFlashResult(data);
      if (!response.ok || !data.ok) {
        setError(data.error ?? "El cron de Ofertas Flash falló.");
      }
      await loadStatus();
    } catch {
      setError("Error de red al ejecutar Ofertas Flash.");
    } finally {
      setRunningFlash(false);
    }
  }

  return (
    <div>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
          Operaciones
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
          Monitorización / Cron
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Revisa precios del catálogo o lanza el descubrimiento de Ofertas Flash
          (Gold Box / Deals) con auto-alta en Supabase.
        </p>
      </header>

      {error ? (
        <p className="mt-6 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="border border-stone-300 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Activos
          </p>
          <p className="mt-3 font-display text-2xl">
            {loadingStatus ? "…" : (status?.activeProducts ?? "—")}
          </p>
        </div>
        <div className="border border-stone-300 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Con URL Amazon
          </p>
          <p className="mt-3 font-display text-2xl">
            {loadingStatus ? "…" : (status?.withAmazonUrl ?? "—")}
          </p>
        </div>
        <div className="border border-stone-300 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Última revisión
          </p>
          <p className="mt-3 text-sm leading-snug text-ink">
            {loadingStatus
              ? "…"
              : status?.lastCheckedAt
                ? new Date(status.lastCheckedAt).toLocaleString("es-ES")
                : "Sin ejecuciones"}
          </p>
        </div>
      </section>

      <section className="mt-8 flex flex-wrap items-end gap-4 border border-stone-300 bg-white p-6">
        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Límite de productos
          <input
            type="number"
            min="1"
            max="50"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            className="mt-2 block h-11 w-28 border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
          />
        </label>
        <button
          type="button"
          disabled={running || runningFlash}
          onClick={() => void runCron()}
          className="inline-flex h-11 items-center bg-ink px-6 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900 disabled:opacity-60"
        >
          {running ? "Ejecutando…" : "Ejecutar revisión de precios ahora"}
        </button>
      </section>

      <section className="mt-4 flex flex-wrap items-end gap-4 border border-amber-200 bg-amber-50/40 p-6">
        <div className="min-w-[12rem] flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">
            Ofertas Flash
          </p>
          <p className="mt-1 max-w-xl text-sm text-stone-600">
            Descubre ASINs en Gold Box / Deals (o simulación), inserta novedades
            en el catálogo y solo actualiza el precio de los que ya existan.
          </p>
        </div>
        <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Límite
          <input
            type="number"
            min="1"
            max="40"
            value={flashLimit}
            onChange={(event) => setFlashLimit(event.target.value)}
            className="mt-2 block h-11 w-28 border border-stone-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
          />
        </label>
        <button
          type="button"
          disabled={running || runningFlash}
          onClick={() => void runFlashCron()}
          className="inline-flex h-11 items-center bg-amber-800 px-6 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-amber-900 disabled:opacity-60"
        >
          {runningFlash ? "Escaneando Flash…" : "Ejecutar Ofertas Flash ahora"}
        </button>
      </section>

      {flashResult?.ok ? (
        <section className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ResultStat
              label="Flash detectadas"
              value={flashResult.flashDealsDetected ?? 0}
            />
            <ResultStat label="Insertados" value={flashResult.inserted ?? 0} />
            <ResultStat label="Actualizados" value={flashResult.updated ?? 0} />
            <ResultStat label="Nuevos mínimos" value={flashResult.newLows ?? 0} />
          </div>

          <p className="text-sm text-stone-500">
            Finalizado:{" "}
            {flashResult.finishedAt
              ? new Date(flashResult.finishedAt).toLocaleString("es-ES")
              : "—"}{" "}
            · candidatos {flashResult.discovery?.candidates ?? 0} · nuevos{" "}
            {flashResult.discovery?.newAsins ?? 0} · ya en catálogo{" "}
            {flashResult.discovery?.existingAsins ?? 0}
            {flashResult.discovery?.usedSimulation
              ? " · listado simulado"
              : ""}
            {" · "}Telegram canal {flashResult.channelNotificationsSent ?? 0}{" "}
            enviadas / {flashResult.channelNotificationsSkipped ?? 0} omitidas
          </p>

          {flashResult.discovery?.feedErrors &&
          flashResult.discovery.feedErrors.length > 0 ? (
            <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Algunos feeds fallaron (Amazon puede bloquear scrapers):{" "}
              {flashResult.discovery.feedErrors
                .map((item) => item.message)
                .join(" · ")}
            </div>
          ) : null}

          {flashResult.products && flashResult.products.length > 0 ? (
            <div className="border border-stone-300 bg-white">
              <div className="border-b border-stone-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">
                Productos Flash / cambios
              </div>
              <ul className="divide-y divide-stone-100">
                {flashResult.products.map((product) => (
                  <li key={`${product.asin}-${product.action}`} className="px-4 py-3 text-sm">
                    <p className="font-medium text-ink">{product.title}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {product.asin} · {product.action}
                      {product.wasNewToCatalog ? " · NUEVO" : ""}
                      {product.isFlashDeal ? " · FLASH" : ""}
                      {product.isNewLow ? " · nuevo mínimo" : ""}
                      {product.currentPrice != null
                        ? ` · ${product.currentPrice.toFixed(2)} €`
                        : ""}
                      {product.listPrice != null
                        ? ` (antes ${product.listPrice.toFixed(2)} €)`
                        : ""}
                      {product.discountPercentage
                        ? ` · −${Math.round(product.discountPercentage)}%`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {flashResult.errors && flashResult.errors.length > 0 ? (
            <div className="border border-amber-200 bg-amber-50">
              <div className="border-b border-amber-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">
                Errores ({flashResult.errors.length})
              </div>
              <ul className="divide-y divide-amber-100">
                {flashResult.errors.map((item) => (
                  <li
                    key={`${item.asin}-${item.message}`}
                    className="px-4 py-3 text-sm text-amber-950"
                  >
                    <span className="font-mono text-xs">{item.asin}</span>
                    <span className="mt-1 block">{item.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {result?.ok && result.stats ? (
        <section className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ResultStat label="Procesados" value={result.stats.processed} />
            <ResultStat label="Actualizados" value={result.stats.updated} />
            <ResultStat label="Sin cambio" value={result.stats.unchanged} />
            <ResultStat
              label="Chollos detectados"
              value={result.stats.dealsDetected}
            />
          </div>

          {result.finishedAt ? (
            <p className="text-sm text-stone-500">
              Finalizado: {new Date(result.finishedAt).toLocaleString("es-ES")} ·
              monitorizables {result.monitorable} · en lote {result.scoped} ·
              notificaciones {result.stats.notificationsSent}
            </p>
          ) : null}

          {result.stats.deals.length > 0 ? (
            <div className="border border-stone-300 bg-white">
              <div className="border-b border-stone-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                Chollos en esta pasada
              </div>
              <ul className="divide-y divide-stone-100">
                {result.stats.deals.map((deal) => (
                  <li key={deal.asin} className="px-4 py-3 text-sm">
                    <p className="font-medium text-ink">{deal.title}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {deal.asin} · score {Math.round(deal.scoring.score)} ·{" "}
                      {deal.scoring.label}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.stats.errors.length > 0 ? (
            <div className="border border-amber-200 bg-amber-50">
              <div className="border-b border-amber-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">
                Errores ({result.stats.errors.length})
              </div>
              <ul className="divide-y divide-amber-100">
                {result.stats.errors.map((item) => (
                  <li
                    key={`${item.asin}-${item.message}`}
                    className="px-4 py-3 text-sm text-amber-950"
                  >
                    <span className="font-mono text-xs">{item.asin}</span>
                    <span className="mt-1 block">{item.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-stone-300 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}
