import { hostname } from "node:os";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { isTelegramConfigured, sendTelegramMessage } from "@/services/telegram/bot";
import type { UserUrlAlertsResult } from "@/services/userUrlAlerts";

/** Nombre corto de la máquina para las estadísticas (VPS / Mac). */
export function machineName(): string {
  return process.env.CAZAOFERTAS_MACHINE?.trim() || (process.platform === "darwin" ? "Mac" : "VPS");
}

/** Guarda el resultado de una ejecución de user-alerts (no lanza). */
export async function recordUserAlertRun(startedAt: Date, result: UserUrlAlertsResult): Promise<void> {
  try {
    const client = createSupabaseServiceClient();
    await client.from("user_alert_runs").insert({
      machine: machineName(),
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      checked: result.checked,
      failed: result.failed,
      skipped: result.skipped,
      price_drops: result.priceDrops,
      notified: result.notified,
    });
  } catch (error) {
    console.warn(`[user-alerts] No se pudo guardar la ejecución en ${hostname()}:`, error);
  }
}

interface MachineStats {
  runs: number;
  checked: number;
  failed: number;
  drops: number;
  notified: number;
  avgMinutes: number;
}

export interface AlertLoadReport {
  users: number;
  alerts: number;
  neverChecked: number;
  checkedLastHour: number;
  ageBuckets: Record<string, number>;
  /** Minutos desde la revisión más antigua (de las ya revisadas). */
  oldestCheckMinutes: number | null;
  byStore: Record<string, { total: number; checked: number; withPrice: number }>;
  /** Por grupo de usuarios: productos nuevos vs del catálogo. */
  byGroup: Record<string, { total: number; checked: number; withPrice: number; linked: number }>;
  windowHours: number;
  byMachine: Record<string, MachineStats>;
}

/** Estadísticas del test de carga; null si no hay usuarios de prueba. */
export async function buildAlertLoadReport(windowHours = 2): Promise<AlertLoadReport | null> {
  const client = createSupabaseServiceClient();
  const { data: users, error } = await client
    .from("users")
    .select("id, telegram_username")
    .eq("is_test", true);
  if (error) throw error;
  const ids = (users ?? []).map((u) => u.id);
  const groupOf = new Map(
    (users ?? []).map((u) => [
      u.id,
      u.telegram_username?.startsWith("test_nuevos") ? "Productos nuevos" : "Catálogo",
    ]),
  );
  if (ids.length === 0) return null;

  const alerts: {
    user_id: string;
    url: string | null;
    product_id: string | null;
    last_checked_at: string | null;
    last_known_price: number | null;
  }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { data, error: alertError } = await client
      .from("alerts")
      .select("user_id, url, product_id, last_checked_at, last_known_price")
      .in("user_id", ids.slice(i, i + 50));
    if (alertError) throw alertError;
    alerts.push(...(data ?? []));
  }

  const now = Date.now();
  const ageBuckets: Record<string, number> = { "0–1 h": 0, "1–3 h": 0, "3–6 h": 0, ">6 h": 0 };
  const byStore: AlertLoadReport["byStore"] = {};
  const byGroup: AlertLoadReport["byGroup"] = {};
  let neverChecked = 0;
  let checkedLastHour = 0;
  let oldest: number | null = null;
  for (const alert of alerts) {
    const store = (alert.url ?? "").match(/amazon|miravia|kiabi|carrefour|aliexpress|pccomponentes/)?.[0] ?? "otra";
    const g = (byGroup[groupOf.get(alert.user_id) ?? "Catálogo"] ??= { total: 0, checked: 0, withPrice: 0, linked: 0 });
    g.total += 1;
    if (alert.last_checked_at) g.checked += 1;
    if (alert.last_known_price !== null) g.withPrice += 1;
    if (alert.product_id) g.linked += 1;
    const s = (byStore[store] ??= { total: 0, checked: 0, withPrice: 0 });
    s.total += 1;
    if (alert.last_known_price !== null) s.withPrice += 1;
    if (!alert.last_checked_at) {
      neverChecked += 1;
      continue;
    }
    s.checked += 1;
    const minutes = (now - new Date(alert.last_checked_at).getTime()) / 60_000;
    oldest = oldest === null ? minutes : Math.max(oldest, minutes);
    if (minutes < 60) {
      checkedLastHour += 1;
      ageBuckets["0–1 h"] += 1;
    } else if (minutes < 180) ageBuckets["1–3 h"] += 1;
    else if (minutes < 360) ageBuckets["3–6 h"] += 1;
    else ageBuckets[">6 h"] += 1;
  }

  const since = new Date(now - windowHours * 3_600_000).toISOString();
  const { data: runs, error: runError } = await client
    .from("user_alert_runs")
    .select("machine, started_at, finished_at, checked, failed, price_drops, notified")
    .gte("started_at", since);
  if (runError) throw runError;
  const byMachine: Record<string, MachineStats> = {};
  for (const run of runs ?? []) {
    const m = (byMachine[run.machine] ??= { runs: 0, checked: 0, failed: 0, drops: 0, notified: 0, avgMinutes: 0 });
    const minutes = (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 60_000;
    m.avgMinutes = (m.avgMinutes * m.runs + minutes) / (m.runs + 1);
    m.runs += 1;
    m.checked += run.checked;
    m.failed += run.failed;
    m.drops += run.price_drops;
    m.notified += run.notified;
  }

  return {
    users: ids.length,
    alerts: alerts.length,
    neverChecked,
    checkedLastHour,
    ageBuckets,
    oldestCheckMinutes: oldest === null ? null : Math.round(oldest),
    byStore,
    byGroup,
    windowHours,
    byMachine,
  };
}

const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)} %` : "—");

export function formatAlertLoadReport(r: AlertLoadReport): string {
  const machines = Object.entries(r.byMachine);
  const totalChecked = machines.reduce((n, [, m]) => n + m.checked, 0);
  const perHour = Math.round(totalChecked / r.windowHours);
  const cycleHours = perHour ? (r.alerts / perHour).toFixed(1) : "—";
  return [
    "🧪 <b>Test de carga de alertas — estadísticas</b>",
    `${r.users} usuarios de prueba · ${r.alerts} alertas`,
    "",
    `<b>Ritmo (últimas ${r.windowHours} h):</b> ${perHour} alertas/h → vuelta completa cada ~${cycleHours} h`,
    ...machines.map(
      ([name, m]) =>
        `• ${name}: ${m.runs} ejecuciones, ${m.checked} revisadas, ${m.failed} fallidas (${pct(m.failed, m.checked + m.failed)}), ${Math.round(m.avgMinutes)} min de media, ${m.drops} bajadas, ${m.notified} avisos`,
    ),
    ...(machines.length === 0 ? ["• Sin ejecuciones registradas en la ventana"] : []),
    "",
    `<b>Cobertura:</b> ${r.alerts - r.neverChecked} revisadas alguna vez, ${r.neverChecked} pendientes`,
    `Última revisión: ${Object.entries(r.ageBuckets).map(([k, v]) => `${k}: ${v}`).join(" · ")}`,
    r.oldestCheckMinutes !== null ? `La más antigua: hace ${Math.round(r.oldestCheckMinutes / 60 * 10) / 10} h` : "",
    "",
    "<b>Por grupo</b> (revisadas / con precio / con producto creado o vinculado / total):",
    ...Object.entries(r.byGroup).map(
      ([group, g]) => `• ${group}: ${g.checked} / ${g.withPrice} / ${g.linked} / ${g.total}`,
    ),
    "",
    "<b>Por tienda</b> (revisadas / con precio / total):",
    ...Object.entries(r.byStore).map(
      ([store, s]) => `• ${store}: ${s.checked} / ${s.withPrice} / ${s.total} (${pct(s.withPrice, s.checked)} con precio)`,
    ),
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
}

/** Envía el informe al chat privado del admin. No hace nada si no hay test en curso. */
export async function sendAlertLoadReport(windowHours = 2): Promise<string | null> {
  const report = await buildAlertLoadReport(windowHours);
  if (!report) return null;
  const text = formatAlertLoadReport(report);
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (admin && isTelegramConfigured()) {
    await sendTelegramMessage({ chatId: admin, text, disableWebPagePreview: true });
  }
  return text;
}
