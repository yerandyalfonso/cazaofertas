"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import {
  AdminPageHeader,
  AdminSearchToolbar,
} from "@/components/admin/AdminListChrome";
import { useAdminToast } from "@/components/admin/AdminToast";
import { formatRelativeTime } from "@/lib/relative-time";
import { retailerLabel } from "@/lib/retailers";
import type {
  AdminAlertKind,
  AdminAlertRun,
  AdminUserAlert,
} from "@/services/adminUserAlerts";

const KIND_LABEL: Record<AdminAlertKind, string> = {
  url: "Producto (URL)",
  category: "Categoría",
  brand: "Marca",
  keyword: "Palabra clave",
};

type StatusFilter = "all" | "active" | "paused" | "waiting" | "failing";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Activas" },
  { value: "paused", label: "Pausadas" },
  { value: "waiting", label: "Esperando al Mac" },
  { value: "failing", label: "Con fallos" },
  { value: "all", label: "Todas" },
];

function formatEuro(value: number | null): string {
  return value == null ? "—" : `${value.toFixed(2).replace(".", ",")} €`;
}

function matchesStatus(alert: AdminUserAlert, status: StatusFilter): boolean {
  if (status === "active") return alert.isActive;
  if (status === "paused") return !alert.isActive;
  if (status === "waiting") return alert.waitingForMac;
  if (status === "failing") return alert.failCount > 0;
  return true;
}

export function UserAlertsAdminClient() {
  const toast = useAdminToast();
  const [alerts, setAlerts] = useState<AdminUserAlert[] | null>(null);
  const [runs, setRuns] = useState<AdminAlertRun[]>([]);
  const [reloading, setReloading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [kind, setKind] = useState<AdminAlertKind | "all">("all");
  const [retailer, setRetailer] = useState("all");
  const [showTests, setShowTests] = useState(false);

  // Devuelve los datos sin tocar el estado: el efecto los aplica en su callback.
  const fetchAlerts = useCallback(async () => {
    const response = await fetch("/api/admin/alerts");
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      alerts?: AdminUserAlert[];
      runs?: AdminAlertRun[];
    } | null;
    if (!response.ok || !data?.ok || !data.alerts) {
      throw new Error(data?.error ?? "No se pudieron cargar las alertas.");
    }
    return { alerts: data.alerts, runs: data.runs ?? [] };
  }, []);

  const apply = useCallback((data: { alerts: AdminUserAlert[]; runs: AdminAlertRun[] }) => {
    setAlerts(data.alerts);
    setRuns(data.runs);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAlerts().then(
      (data) => {
        if (!cancelled) apply(data);
      },
      (error: unknown) => {
        if (cancelled) return;
        toast.error(error instanceof Error ? error.message : "Error al cargar alertas.");
        setAlerts([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fetchAlerts, apply, toast]);

  async function reload() {
    setReloading(true);
    try {
      apply(await fetchAlerts());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar alertas.");
    } finally {
      setReloading(false);
    }
  }

  async function toggleActive(alert: AdminUserAlert) {
    const next = !alert.isActive;
    if (
      !next &&
      !window.confirm(
        `¿Pausar la alerta de ${alert.userLabel}? Dejará de revisarse hasta que la reactives.`,
      )
    ) {
      return;
    }
    setBusyId(alert.id);
    try {
      const response = await fetch("/api/admin/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alert.id, isActive: next }),
      });
      const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error ?? "No se pudo guardar.");
      setAlerts((current) =>
        current?.map((row) =>
          row.id === alert.id
            ? { ...row, isActive: next, failCount: next ? 0 : row.failCount }
            : row,
        ) ?? current,
      );
      toast.success(next ? "Alerta reactivada." : "Alerta pausada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusyId(null);
    }
  }

  const scoped = useMemo(
    () => (alerts ?? []).filter((alert) => showTests || !alert.isTestUser),
    [alerts, showTests],
  );

  const summary = useMemo(
    () => ({
      active: scoped.filter((alert) => alert.isActive).length,
      paused: scoped.filter((alert) => !alert.isActive).length,
      waiting: scoped.filter((alert) => alert.waitingForMac).length,
      failing: scoped.filter((alert) => alert.failCount > 0).length,
      users: new Set(scoped.map((alert) => alert.userLabel)).size,
    }),
    [scoped],
  );

  const retailers = useMemo(
    () => [...new Set(scoped.map((alert) => alert.retailer).filter((r): r is string => !!r))].sort(),
    [scoped],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter(
      (alert) =>
        matchesStatus(alert, status) &&
        (kind === "all" || alert.kind === kind) &&
        (retailer === "all" || alert.retailer === retailer) &&
        (!needle ||
          alert.userLabel.toLowerCase().includes(needle) ||
          alert.target.toLowerCase().includes(needle) ||
          (alert.productTitle ?? "").toLowerCase().includes(needle)),
    );
  }, [scoped, status, kind, retailer, query]);

  const loading = alerts === null;

  return (
    <div>
      <AdminPageHeader
        eyebrow="Usuarios"
        title="Alertas"
        description="Alertas que los usuarios crean en el bot de Telegram. Las de producto de Carrefour, PcComponentes y MediaMarkt las completa el Mac."
        actions={
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading || reloading}
            className="admin-btn admin-btn-ghost"
          >
            <RefreshCw className={`h-4 w-4 ${reloading ? "animate-spin" : ""}`} aria-hidden />
            Recargar
          </button>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Activas", value: summary.active },
          { label: "Pausadas", value: summary.paused },
          { label: "Esperando al Mac", value: summary.waiting },
          { label: "Con fallos", value: summary.failing },
          { label: "Usuarios", value: summary.users },
        ].map((tile) => (
          <div key={tile.label} className="admin-card p-4">
            <p className="text-xs font-semibold text-[var(--text-muted)]">{tile.label}</p>
            <p className="mt-1 text-2xl font-bold">{loading ? "…" : tile.value}</p>
          </div>
        ))}
      </div>

      {runs.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">Últimas revisiones</h2>
          <div className="admin-table-wrap mt-2">
            <table className="text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)]">
                  <th className="px-4 py-2 font-semibold">Cuándo</th>
                  <th className="px-4 py-2 font-semibold">Máquina</th>
                  <th className="px-4 py-2 text-right font-semibold">Revisadas</th>
                  <th className="px-4 py-2 text-right font-semibold">Fallidas</th>
                  <th className="px-4 py-2 text-right font-semibold">Omitidas</th>
                  <th className="px-4 py-2 text-right font-semibold">Bajadas</th>
                  <th className="px-4 py-2 text-right font-semibold">Avisos</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-[var(--border)]">
                    <td className="whitespace-nowrap px-4 py-2">{formatRelativeTime(run.finishedAt)}</td>
                    <td className="px-4 py-2">{run.machine}</td>
                    <td className="px-4 py-2 text-right">{run.checked}</td>
                    <td className="px-4 py-2 text-right">{run.failed}</td>
                    <td className="px-4 py-2 text-right">{run.skipped}</td>
                    <td className="px-4 py-2 text-right">{run.priceDrops}</td>
                    <td className="px-4 py-2 text-right">{run.notified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <AdminSearchToolbar
        value={query}
        onChange={setQuery}
        placeholder="Buscar usuario, URL, producto o marca"
      >
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="admin-select"
          aria-label="Estado"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as AdminAlertKind | "all")}
          className="admin-select"
          aria-label="Tipo"
        >
          <option value="all">Todos los tipos</option>
          {(Object.keys(KIND_LABEL) as AdminAlertKind[]).map((value) => (
            <option key={value} value={value}>
              {KIND_LABEL[value]}
            </option>
          ))}
        </select>
        <select
          value={retailer}
          onChange={(e) => setRetailer(e.target.value)}
          className="admin-select"
          aria-label="Tienda"
        >
          <option value="all">Todas las tiendas</option>
          {retailers.map((value) => (
            <option key={value} value={value}>
              {retailerLabel(value)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={showTests}
            onChange={(e) => setShowTests(e.target.checked)}
            className="h-4 w-4 accent-teal-800"
          />
          Incluir usuarios de prueba
        </label>
      </AdminSearchToolbar>

      {loading ? (
        <div className="admin-card mt-4 p-8 text-sm text-[var(--text-muted)]">Cargando alertas…</div>
      ) : visible.length === 0 ? (
        <AdminEmptyState
          className="mt-4"
          title="No hay alertas con estos filtros"
          subtitle="Cambia el estado o la tienda, o incluye a los usuarios de prueba."
        />
      ) : (
        <div className="admin-table-wrap mt-4">
          <table className="text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--text-muted)]">
                <th className="px-4 py-2.5 font-semibold">Alerta</th>
                <th className="px-4 py-2.5 font-semibold">Usuario</th>
                <th className="px-4 py-2.5 font-semibold">Estado</th>
                <th className="px-4 py-2.5 text-right font-semibold">Precio</th>
                <th className="px-4 py-2.5 font-semibold">Revisada</th>
                <th className="px-4 py-2.5 text-right font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 300).map((alert) => (
                <tr key={alert.id} className="border-t border-[var(--border)] align-top">
                  <td className="max-w-md px-4 py-2.5">
                    <p className="text-xs text-[var(--text-muted)]">
                      {KIND_LABEL[alert.kind]}
                      {alert.retailer ? ` · ${retailerLabel(alert.retailer)}` : ""}
                    </p>
                    <p className="truncate font-medium" title={alert.productTitle ?? alert.target}>
                      {alert.kind === "url" ? (
                        <a href={alert.target} target="_blank" rel="noreferrer" className="hover:underline">
                          {alert.productTitle ?? alert.target}
                        </a>
                      ) : (
                        alert.target
                      )}
                    </p>
                    {alert.maxPrice != null || alert.minDiscountPercentage != null ? (
                      <p className="text-xs text-[var(--text-muted)]">
                        {alert.maxPrice != null ? `Hasta ${formatEuro(alert.maxPrice)}` : ""}
                        {alert.maxPrice != null && alert.minDiscountPercentage != null ? ", " : ""}
                        {alert.minDiscountPercentage != null ? `desde −${alert.minDiscountPercentage}%` : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {alert.userLabel}
                    {alert.isTestUser ? (
                      <span className="ml-1.5 text-xs text-amber-800">prueba</span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {!alert.isActive ? (
                      <span className="text-[var(--text-muted)]">Pausada</span>
                    ) : alert.waitingForMac ? (
                      <span className="text-amber-800">Esperando al Mac</span>
                    ) : alert.failCount > 0 ? (
                      <span className="text-rose-800">{alert.failCount} fallos seguidos</span>
                    ) : (
                      <span className="text-emerald-800">Activa</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {formatEuro(alert.lastKnownPrice)}
                    {alert.lastNotifiedPrice != null ? (
                      <span className="block text-xs text-[var(--text-muted)]">
                        avisado a {formatEuro(alert.lastNotifiedPrice)}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {alert.lastCheckedAt ? formatRelativeTime(alert.lastCheckedAt) : "Nunca"}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleActive(alert)}
                      disabled={busyId === alert.id}
                      className="admin-btn admin-btn-ghost h-9"
                    >
                      {alert.isActive ? "Pausar" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length > 300 ? (
            <p className="border-t border-[var(--border)] px-4 py-3 text-center text-xs text-[var(--text-muted)]">
              Se muestran 300 de {visible.length}. Usa la búsqueda o los filtros para acotar.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
