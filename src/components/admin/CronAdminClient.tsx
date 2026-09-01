"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminField } from "@/components/admin/AdminField";
import { useAdminToast } from "@/components/admin/AdminToast";
import { retailerLabel } from "@/lib/retailers";

interface CronStatus {
  activeProducts: number;
  withAmazonUrl: number;
  retailMonitorable?: number;
  lastCheckedAt: string | null;
  oldestCheckedAt?: string | null;
  neverChecked?: number;
  byRetailer?: Array<{ retailer: string; count: number }>;
  cronControl?: {
    isPaused: boolean;
    pausedUntil: string | null;
    pauseReason: string | null;
    consecutiveDenials: number;
    lastDenialAt: string | null;
    lastSuccessAt: string | null;
  } | null;
  settings?: {
    telegramMinScore: number;
    miraviaTelegramMinScore?: number;
    kiabiTelegramMinScore?: number;
    telegramBatchHours: number;
    telegramFlushRescheduleMinutes?: number;
    telegramFlushLimit?: number;
    amazonAssociateTag?: string;
    lastTelegramFlushAt: string | null;
    telegramFlushResumeAt?: string | null;
    source: "database" | "env";
    updatedAt: string | null;
  } | null;
  pendingTelegram?: number;
  failedTelegram?: number;
  queuedTelegram?: number;
  telegramBatchDue?: boolean;
  telegramNextFlushAt?: string | null;
  facebookConfigured?: boolean;
}

interface CronRunResult {
  ok: boolean;
  error?: string;
  monitorable?: number;
  scoped?: number;
  finishedAt?: string;
  pause?: {
    activated: boolean;
    denials: number;
  };
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
      amazonUrl?: string;
      imageUrl?: string | null;
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
  channelNotificationsQueued?: number;
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
    imageUrl?: string | null;
  }>;
  errors?: Array<{ asin: string; message: string }>;
}

export function CronAdminClient({
  mode = "full",
  embedded = false,
}: {
  mode?: "full" | "monitor" | "run";
  embedded?: boolean;
} = {}) {
  const showMonitor = mode === "full" || mode === "monitor";
  const showRun = mode === "full" || mode === "run";
  const toast = useAdminToast();
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [result, setResult] = useState<CronRunResult | null>(null);
  const [flashResult, setFlashResult] = useState<FlashRunResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningFlash, setRunningFlash] = useState(false);
  const [limit, setLimit] = useState("10");
  const [flashLimit, setFlashLimit] = useState("12");
  const [error, setError] = useState<string | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [flushingTelegram, setFlushingTelegram] = useState(false);

  async function readJsonSafe<T>(response: Response): Promise<T | null> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(
        response.status === 504 || response.status === 408
          ? "Timeout del servidor. Baja el límite (p. ej. 3–5) e inténtalo de nuevo."
          : `Respuesta no válida del servidor (HTTP ${response.status}). ${text.slice(0, 120)}`,
      );
    }
  }

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/cron/run");
      const data = await readJsonSafe<
        CronStatus & { ok?: boolean; error?: string }
      >(response);
      if (!response.ok || !data || data.ok === false) {
        const message = data?.error ?? "No se pudo cargar el estado.";
        setError(message);
        toast.error(message);
        return;
      }
      setStatus({
        activeProducts: data.activeProducts,
        withAmazonUrl: data.withAmazonUrl,
        retailMonitorable: data.retailMonitorable,
        lastCheckedAt: data.lastCheckedAt,
        oldestCheckedAt: data.oldestCheckedAt,
        neverChecked: data.neverChecked,
        byRetailer: data.byRetailer,
        cronControl: data.cronControl,
        settings: data.settings ?? null,
        pendingTelegram: data.pendingTelegram ?? 0,
        failedTelegram: data.failedTelegram ?? 0,
        queuedTelegram: data.queuedTelegram ?? 0,
        telegramBatchDue: data.telegramBatchDue,
        telegramNextFlushAt: data.telegramNextFlushAt ?? null,
        facebookConfigured: data.facebookConfigured ?? false,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error de red al cargar estado.";
      setError(message);
      toast.error(message);
    } finally {
      setLoadingStatus(false);
    }
  }, [toast]);

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
          notify: false,
          provider: "auto",
          force: true,
        }),
      });
      const data = await readJsonSafe<CronRunResult>(response);
      if (!data) {
        throw new Error("Sin respuesta del servidor.");
      }
      setResult(data);
      if (!response.ok || !data.ok) {
        const message = data.error ?? "La revisión falló.";
        setError(message);
        toast.error(message);
      } else {
        const processed = data.stats?.processed ?? 0;
        const updated = data.stats?.updated ?? 0;
        const scrapeErrors = data.stats?.errors?.length ?? 0;
        if (processed > 0 && scrapeErrors >= processed) {
          const first = data.stats?.errors?.[0]?.message;
          const message =
            `Amazon bloqueó el scrape en el servidor (${scrapeErrors}/${processed}).` +
            (first ? ` ${first}` : "") +
            " Reintenta en unos minutos o baja el límite.";
          setError(message);
          toast.error(message);
        } else {
          toast.success(
            `Lote rotativo · ${processed} procesados, ${updated} actualizados` +
              (scrapeErrors > 0 ? ` · ${scrapeErrors} con error` : "") +
              (data.pause?.activated ? " · pausa preventiva activada" : ""),
          );
        }
      }
      await loadStatus();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Error de red al ejecutar el cron.";
      setError(message);
      toast.error(message);
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
          limit: Number.isFinite(parsedLimit) ? parsedLimit : 12,
          allowSimulatedFallback: true,
          notify: true,
          force: true,
        }),
      });
      const data = await readJsonSafe<FlashRunResult>(response);
      if (!data) {
        throw new Error("Sin respuesta del servidor.");
      }
      setFlashResult(data);
      if (!response.ok || !data.ok) {
        const message = data.error ?? "El cron de Ofertas Flash falló.";
        setError(message);
        toast.error(message);
      } else {
        const errCount = data.errors?.length ?? 0;
        const newFound = data.discovery?.newAsins ?? 0;
        const inserted = data.inserted ?? 0;
        if (inserted === 0 && errCount > 0) {
          const first = data.errors?.[0]?.message;
          const message =
            `Flash sin insertar (${errCount} errores de Amazon).` +
            (first ? ` ${first}` : "") +
            " En Vercel el HTML suele bloquearse; reintenta más tarde.";
          setError(message);
          toast.error(message);
        } else if (inserted === 0 && newFound === 0) {
          toast.success(
            `Flash OK · sin ASINs nuevos (ya en catálogo ${data.discovery?.existingAsins ?? 0}). Precios → Revisar precios.`,
          );
        } else {
          toast.success(
            `Flash OK · +${inserted} nuevos` +
              (errCount > 0 ? ` · ${errCount} errores` : "") +
              ` · Telegram cola ${data.channelNotificationsQueued ?? 0}` +
              ` / enviadas ${data.channelNotificationsSent ?? 0}`,
          );
        }
      }
      await loadStatus();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Error de red al ejecutar Ofertas Flash.";
      setError(message);
      toast.error(message);
    } finally {
      setRunningFlash(false);
    }
  }

  async function setPause(action: "pause" | "resume") {
    setPauseBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/cron/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "pause"
            ? {
                action: "pause",
                minutes: 90,
                reason: "Pausa manual desde admin",
              }
            : { action: "resume" },
        ),
      });
      const data = await readJsonSafe<{
        ok?: boolean;
        error?: string;
        cronControl?: CronStatus["cronControl"];
      }>(response);
      if (!response.ok || !data?.ok) {
        const message = data?.error ?? "No se pudo actualizar la pausa.";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success(
        action === "pause"
          ? "Crons en pausa 90 min"
          : "Crons reanudados",
      );
      await loadStatus();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al cambiar la pausa.";
      setError(message);
      toast.error(message);
    } finally {
      setPauseBusy(false);
    }
  }

  async function flushTelegramNow() {
    setFlushingTelegram(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/cron/telegram-flush", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = await readJsonSafe<{
        ok?: boolean;
        error?: string;
        sent?: number;
        skippedExpired?: number;
        skippedLowScore?: number;
        failed?: number;
        pendingBefore?: number;
        remainingPending?: number;
        resumeAt?: string | null;
      }>(response);
      if (!response.ok || !data?.ok) {
        const message = data?.error ?? "No se pudo enviar el lote de Telegram.";
        setError(message);
        toast.error(message);
        return;
      }
      const resumeHint =
        data.remainingPending && data.remainingPending > 0 && data.resumeAt
          ? ` · reintento ${new Date(data.resumeAt).toLocaleString("es-ES")}`
          : "";
      toast.success(
        `Lote Telegram · ${data.sent ?? 0} enviadas` +
          (data.remainingPending ? ` · ${data.remainingPending} pendientes` : "") +
          resumeHint +
          (data.skippedExpired ? ` · ${data.skippedExpired} caducadas` : "") +
          (data.failed ? ` · ${data.failed} fallos` : ""),
      );
      await loadStatus();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al enviar el lote.";
      setError(message);
      toast.error(message);
    } finally {
      setFlushingTelegram(false);
    }
  }

  return (
    <div>
      {!embedded ? (
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            Operaciones
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            Monitorización / Cron
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-600">
            Rotación por lotes (los más antiguos primero) para cubrir el catálogo
            al día sin saturar Amazon. Si hay denegaciones, los crons se pausan
            solos un tiempo prudencial.
          </p>
        </header>
      ) : null}

      {error ? (
        <p className={`${embedded ? "" : "mt-6"} border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800`}>
          {error}
        </p>
      ) : null}

      {showMonitor ? (
        <>
      {status?.cronControl?.isPaused ? (
        <div className="mt-6 border border-amber-300 bg-amber-50 px-4 py-4">
          <p className="text-sm font-semibold text-amber-950">
            Crons en pausa preventiva
          </p>
          <p className="mt-1 text-sm text-amber-900/90">
            Hasta{" "}
            {status.cronControl.pausedUntil
              ? new Date(status.cronControl.pausedUntil).toLocaleString("es-ES")
              : "—"}
            {status.cronControl.pauseReason
              ? ` · ${status.cronControl.pauseReason}`
              : ""}
          </p>
          <button
            type="button"
            disabled={pauseBusy}
            onClick={() => void setPause("resume")}
            className="mt-3 inline-flex h-9 items-center border border-amber-800 bg-white px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-950 disabled:opacity-60"
          >
            {pauseBusy ? "…" : "Reanudar ahora"}
          </button>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3 admin-card px-4 py-3">
          <p className="text-sm text-stone-600">
            Estado: <span className="font-medium text-ink">activos</span>
            {status?.neverChecked != null
              ? ` · ${status.neverChecked} sin revisar`
              : ""}
            {status?.oldestCheckedAt
              ? ` · más antiguo ${new Date(status.oldestCheckedAt).toLocaleString("es-ES")}`
              : ""}
          </p>
          <button
            type="button"
            disabled={pauseBusy || loadingStatus}
            onClick={() => void setPause("pause")}
            className="admin-btn admin-btn-ghost ml-auto h-9"
          >
            {pauseBusy ? "…" : "Pausar 90 min"}
          </button>
        </div>
      )}

      <section className="mt-8 admin-card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
          Telegram
        </p>
        <h2 className="mt-2 font-display text-2xl text-ink">
          Canal / grupo Telegram
        </h2>
        <p className="mt-1 max-w-xl text-sm text-stone-600">
          Los crons solo encolan ofertas. El envío al grupo respeta el intervalo
          configurado (p. ej. cada 4 h); check-prices o «Enviar lote ahora»
          publican cuando toca.
        </p>
        {status?.settings ? (
          <p className="mt-3 text-sm text-stone-600">
            Umbrales: Amazon ≥ {status.settings.telegramMinScore}
            {status.settings.miraviaTelegramMinScore != null
              ? ` · Miravia ≥ ${status.settings.miraviaTelegramMinScore}`
              : ""}
            {status.settings.kiabiTelegramMinScore != null
              ? ` · Kiabi ≥ ${status.settings.kiabiTelegramMinScore}`
              : ""}
            {" · "}lote cada {status.settings.telegramBatchHours} h
            {status.settings.telegramFlushLimit != null
              ? ` · máx. ${status.settings.telegramFlushLimit} por envío`
              : ""}
            {status?.telegramBatchDue ? " · lote listo para enviar" : ""}
            {!loadingStatus && status?.telegramNextFlushAt && !status?.telegramBatchDue
              ? ` · próximo lote ${new Date(status.telegramNextFlushAt).toLocaleString("es-ES")}`
              : ""}
            {status.settings.source === "env" ? " (valores de entorno)" : ""}
          </p>
        ) : null}
        <p className="mt-2 text-sm">
          <Link
            href="/admin/cron?tab=config"
            className="font-medium text-teal-800 underline"
          >
            Editar configuración →
          </Link>
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-4">
          <p className="text-sm text-stone-600">
            Pendientes:{" "}
            <span className="font-medium text-ink">
              {loadingStatus ? "…" : (status?.pendingTelegram ?? 0)}
            </span>
            {!loadingStatus && (status?.failedTelegram ?? 0) > 0 ? (
              <>
                {" "}
                · fallidos (reintento):{" "}
                <span className="font-medium text-amber-900">
                  {status?.failedTelegram}
                </span>
              </>
            ) : null}
            {!loadingStatus && (status?.queuedTelegram ?? 0) > 0 ? (
              <>
                {" "}
                · en cola total:{" "}
                <span className="font-medium text-ink">
                  {status?.queuedTelegram}
                </span>
              </>
            ) : null}
            {status?.settings?.lastTelegramFlushAt ? (
              <>
                {" "}
                · último lote{" "}
                {new Date(status.settings.lastTelegramFlushAt).toLocaleString(
                  "es-ES",
                )}
              </>
            ) : null}
          </p>
          <button
            type="button"
            disabled={flushingTelegram || loadingStatus}
            onClick={() => void flushTelegramNow()}
            className="admin-btn admin-btn-ghost h-9"
          >
            {flushingTelegram ? "Enviando…" : "Enviar lote ahora"}
          </button>
        </div>
        <p className="mt-3 text-sm text-stone-600">
          Facebook:{" "}
          {loadingStatus
            ? "…"
            : status?.facebookConfigured
              ? "configurado (se publica con el mismo lote)"
              : "sin configurar (FACEBOOK_PAGE_ID + FACEBOOK_PAGE_ACCESS_TOKEN)"}
        </p>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="admin-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Activos
          </p>
          <p className="mt-3 font-display text-2xl">
            {loadingStatus ? "…" : (status?.activeProducts ?? "—")}
          </p>
        </div>
        <div className="admin-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Amazon monitorizable
          </p>
          <p className="mt-3 font-display text-2xl">
            {loadingStatus ? "…" : (status?.withAmazonUrl ?? "—")}
          </p>
        </div>
        <div className="admin-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Retail monitorizable
          </p>
          <p className="mt-3 font-display text-2xl">
            {loadingStatus ? "…" : (status?.retailMonitorable ?? "—")}
          </p>
        </div>
        <div className="admin-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Sin revisar
          </p>
          <p className="mt-3 font-display text-2xl">
            {loadingStatus ? "…" : (status?.neverChecked ?? "—")}
          </p>
        </div>
        <div className="admin-card p-5">
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

      {!loadingStatus && (status?.byRetailer?.length ?? 0) > 0 ? (
        <section className="admin-card mt-6 max-w-xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
            Por tienda
          </p>
          <ul className="mt-3 divide-y divide-stone-100">
            {status!.byRetailer!.map((row) => {
              const total = status?.activeProducts || 1;
              const pct = Math.round((row.count / total) * 100);
              return (
                <li
                  key={row.retailer}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="w-24 shrink-0 text-sm font-medium text-ink">
                    {retailerLabel(row.retailer)}
                  </span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-teal-700"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums text-stone-600">
                    {row.count}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
        </>
      ) : null}

      {showRun ? (
        <>
      <section className="mt-8 admin-card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
          Acción primaria
        </p>
        <h2 className="mt-2 font-display text-2xl text-ink">
          Revisar catálogo vigilado
        </h2>
        <p className="mt-1 max-w-xl text-sm text-stone-600">
          Cada vez revisa un lote (por defecto 10) empezando por los que hace
          más tiempo que no se comprueban. Varias corridas al día cubren todo el
          catálogo y alimentan el histórico.
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <AdminField label="Límite de productos" className="!w-28 shrink-0">
            <input
              type="number"
              min="1"
              max="50"
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
          <button
            type="button"
            disabled={running || runningFlash}
            onClick={() => void runCron()}
            className="admin-btn admin-btn-primary"
          >
            {running ? "Revisando…" : "Revisar precios ahora"}
          </button>
        </div>
      </section>

      <section className="mt-4 border border-amber-200 bg-amber-50/40 p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">
          Secundaria
        </p>
        <h2 className="mt-2 font-display text-2xl text-ink">
          Descubrir flash / canal
        </h2>
        <p className="mt-1 max-w-xl text-sm text-stone-600">
          Solo busca ASINs <strong>nuevos</strong> en Gold Box / Deals e
          inserta + publica en Telegram si el score es alto. Lo ya indexado
          lo vigila «Revisar precios» (bajadas → notificación).
        </p>
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <AdminField label="Límite" className="!w-28 shrink-0">
            <input
              type="number"
              min="1"
              max="40"
              value={flashLimit}
              onChange={(event) => setFlashLimit(event.target.value)}
              className="admin-input w-full"
            />
          </AdminField>
          <button
            type="button"
            disabled={running || runningFlash}
            onClick={() => void runFlashCron()}
            className="inline-flex h-11 items-center border border-amber-900 bg-amber-900 px-6 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-amber-900 disabled:opacity-60"
          >
            {runningFlash ? "Descubriendo…" : "Lanzar Ofertas Flash"}
          </button>
        </div>
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
            {" · "}Telegram cola {flashResult.channelNotificationsQueued ?? 0}{" "}
            / enviadas {flashResult.channelNotificationsSent ?? 0} / omitidas{" "}
            {flashResult.channelNotificationsSkipped ?? 0}
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
            <div className="admin-card">
              <div className="border-b border-stone-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-900">
                Productos Flash insertados
              </div>
              <ul className="divide-y divide-stone-100">
                {flashResult.products.map((product) => (
                  <li
                    key={`${product.asin}-${product.action}`}
                    className="flex items-start gap-3 px-4 py-3 text-sm"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-stone-200">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">
                          —
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium text-ink">
                        {product.title}
                      </p>
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
                    </div>
                    <a
                      href={
                        product.amazonUrl ||
                        `https://www.amazon.es/dp/${product.asin}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-btn admin-btn-primary h-9 shrink-0 px-3 text-[10px]"
                    >
                      Ir a Amazon
                    </a>
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
            <div className="admin-card">
              <div className="border-b border-stone-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
                Chollos en esta pasada
              </div>
              <ul className="divide-y divide-stone-100">
                {result.stats.deals.map((deal) => (
                  <li
                    key={deal.asin}
                    className="flex items-start gap-3 px-4 py-3 text-sm"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden bg-stone-200">
                      {deal.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={deal.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">
                          —
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium text-ink">
                        {deal.title}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {deal.asin} · score {Math.round(deal.scoring.score)} ·{" "}
                        {deal.scoring.label}
                      </p>
                    </div>
                    <a
                      href={
                        deal.amazonUrl ||
                        `https://www.amazon.es/dp/${deal.asin}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-btn admin-btn-primary h-9 shrink-0 px-3 text-[10px]"
                    >
                      Ir a Amazon
                    </a>
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
        </>
      ) : null}
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}
