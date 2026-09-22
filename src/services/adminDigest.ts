import { detectRetailerFromUrl, type ProductRetailer } from "@/lib/retailers";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { getCronControlState } from "@/services/cronControl";
import { isTelegramConfigured, sendTelegramMessage } from "@/services/telegram/bot";

const WINDOW_HOURS = 24;
const STALE_HOURS = 48;
/** Una sola alerta disparando más que esto en 24h es sospechoso (bug tipo "comodín"). */
const ANOMALY_THRESHOLD = 15;

function resolveAdminChatId(): string | number | null {
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!admin) return null;
  const asNumber = Number(admin);
  return Number.isFinite(asNumber) && admin === String(asNumber) ? asNumber : admin;
}

interface RetailerCount {
  retailer: string;
  count: number;
}

interface UrlAlertsStats {
  totalActive: number;
  checkedLast24h: number;
  neverChecked: number;
  byRetailer: RetailerCount[];
}

interface PersonalAlertsStats {
  totalActive: number;
  sentLast24h: number;
  failedTotal: number;
  pendingTotal: number;
  anomalies: Array<{ alertId: string; count: number }>;
}

interface ChannelStats {
  sentLast24h: number;
  skippedLast24h: number;
  pendingTotal: number;
}

interface DiscoveryStats {
  byRetailer: RetailerCount[];
}

interface CatalogStats {
  activeTotal: number;
  staleOver48h: number;
}

export interface AdminDigestReport {
  generatedAt: string;
  cronPaused: boolean;
  cronPauseReason: string | null;
  cronPausedUntil: string | null;
  discovery: DiscoveryStats;
  catalog: CatalogStats;
  channel: ChannelStats;
  urlAlerts: UrlAlertsStats;
  personalAlerts: PersonalAlertsStats;
}

async function buildDiscoveryStats(client: ReturnType<typeof createSupabaseServiceClient>): Promise<DiscoveryStats> {
  const { data } = await client
    .from("products")
    .select("retailer")
    .gte("created_at", new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString());

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const retailer = row.retailer ?? "amazon";
    counts.set(retailer, (counts.get(retailer) ?? 0) + 1);
  }
  return {
    byRetailer: [...counts.entries()]
      .map(([retailer, count]) => ({ retailer, count }))
      .sort((a, b) => b.count - a.count),
  };
}

async function buildCatalogStats(client: ReturnType<typeof createSupabaseServiceClient>): Promise<CatalogStats> {
  const { count: activeTotal } = await client
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  const staleCutoff = new Date(Date.now() - STALE_HOURS * 3_600_000).toISOString();
  const { count: staleOver48h } = await client
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .or(`last_checked_at.is.null,last_checked_at.lt.${staleCutoff}`);

  return { activeTotal: activeTotal ?? 0, staleOver48h: staleOver48h ?? 0 };
}

async function buildChannelStats(client: ReturnType<typeof createSupabaseServiceClient>): Promise<ChannelStats> {
  const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
  const { data } = await client
    .from("channel_notifications")
    .select("status")
    .gte("created_at", since);

  let sentLast24h = 0;
  let skippedLast24h = 0;
  for (const row of data ?? []) {
    if (row.status === "sent") sentLast24h += 1;
    else if (row.status === "skipped") skippedLast24h += 1;
  }

  const { count: pendingTotal } = await client
    .from("channel_notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return { sentLast24h, skippedLast24h, pendingTotal: pendingTotal ?? 0 };
}

async function buildUrlAlertsStats(client: ReturnType<typeof createSupabaseServiceClient>): Promise<UrlAlertsStats> {
  const { data } = await client
    .from("alerts")
    .select("url, last_checked_at")
    .eq("is_active", true)
    .not("url", "is", null);

  const rows = data ?? [];
  const since = Date.now() - WINDOW_HOURS * 3_600_000;
  const byRetailer = new Map<string, number>();
  let checkedLast24h = 0;
  let neverChecked = 0;

  for (const row of rows) {
    const retailer: ProductRetailer = row.url
      ? detectRetailerFromUrl(row.url) ?? "amazon"
      : "amazon";
    byRetailer.set(retailer, (byRetailer.get(retailer) ?? 0) + 1);

    if (!row.last_checked_at) {
      neverChecked += 1;
    } else if (new Date(row.last_checked_at).getTime() >= since) {
      checkedLast24h += 1;
    }
  }

  return {
    totalActive: rows.length,
    checkedLast24h,
    neverChecked,
    byRetailer: [...byRetailer.entries()]
      .map(([retailer, count]) => ({ retailer, count }))
      .sort((a, b) => b.count - a.count),
  };
}

async function buildPersonalAlertsStats(
  client: ReturnType<typeof createSupabaseServiceClient>,
): Promise<PersonalAlertsStats> {
  const { count: totalActive } = await client
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .or("category_id.not.is.null,brand.not.is.null,keyword.not.is.null");

  const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString();
  const { data: recentSent } = await client
    .from("notifications")
    .select("alert_id")
    .eq("status", "sent")
    .gte("sent_at", since);

  const { count: failedTotal } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed");

  const { count: pendingTotal } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const perAlert = new Map<string, number>();
  for (const row of recentSent ?? []) {
    if (!row.alert_id) continue;
    perAlert.set(row.alert_id, (perAlert.get(row.alert_id) ?? 0) + 1);
  }
  const anomalies = [...perAlert.entries()]
    .filter(([, count]) => count > ANOMALY_THRESHOLD)
    .map(([alertId, count]) => ({ alertId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalActive: totalActive ?? 0,
    sentLast24h: recentSent?.length ?? 0,
    failedTotal: failedTotal ?? 0,
    pendingTotal: pendingTotal ?? 0,
    anomalies,
  };
}

export async function buildAdminDigestReport(): Promise<AdminDigestReport> {
  const client = createSupabaseServiceClient();
  const [cronState, discovery, catalog, channel, urlAlerts, personalAlerts] =
    await Promise.all([
      getCronControlState(),
      buildDiscoveryStats(client),
      buildCatalogStats(client),
      buildChannelStats(client),
      buildUrlAlertsStats(client),
      buildPersonalAlertsStats(client),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    cronPaused: cronState.isPaused,
    cronPauseReason: cronState.pauseReason,
    cronPausedUntil: cronState.pausedUntil,
    discovery,
    catalog,
    channel,
    urlAlerts,
    personalAlerts,
  };
}

function formatRetailerCounts(items: RetailerCount[]): string {
  if (items.length === 0) return "sin datos";
  return items.map((item) => `${item.retailer}: ${item.count}`).join(", ");
}

export function formatAdminDigestMessage(report: AdminDigestReport): string {
  const lines: string[] = [];
  const hour = new Date(report.generatedAt).toLocaleString("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  });

  lines.push(`📊 <b>Resumen del sistema</b> · ${hour}`, "");

  lines.push(
    report.cronPaused
      ? `⏸️ <b>Cron en pausa</b> (${report.cronPauseReason ?? "denegaciones Amazon"}) hasta ${
          report.cronPausedUntil
            ? new Date(report.cronPausedUntil).toLocaleString("es-ES")
            : "—"
        }`
      : "✅ Sin pausas preventivas activas",
  );

  lines.push(
    "",
    "🆕 <b>Descubrimiento (24h)</b>",
    formatRetailerCounts(report.discovery.byRetailer),
  );

  lines.push(
    "",
    "📦 <b>Catálogo</b>",
    `${report.catalog.activeTotal} activos · ${report.catalog.staleOver48h} sin revisar hace >48h` +
      (report.catalog.activeTotal > 0
        ? ` (${Math.round((report.catalog.staleOver48h / report.catalog.activeTotal) * 100)}%)`
        : ""),
  );

  lines.push(
    "",
    "📣 <b>Canal/grupo (24h)</b>",
    `${report.channel.sentLast24h} enviados · ${report.channel.skippedLast24h} saltados` +
      (report.channel.pendingTotal > 0 ? ` · ${report.channel.pendingTotal} pendientes` : ""),
  );

  lines.push(
    "",
    "🔗 <b>Alertas de URL</b>",
    `${report.urlAlerts.totalActive} activas · ${report.urlAlerts.checkedLast24h} revisadas en 24h` +
      (report.urlAlerts.neverChecked > 0
        ? ` · ${report.urlAlerts.neverChecked} sin revisar nunca`
        : ""),
    formatRetailerCounts(report.urlAlerts.byRetailer),
  );

  lines.push(
    "",
    "🎯 <b>Alertas de categoría/marca/keyword</b>",
    `${report.personalAlerts.totalActive} activas · ${report.personalAlerts.sentLast24h} avisos enviados en 24h`,
  );
  if (report.personalAlerts.failedTotal > 0 || report.personalAlerts.pendingTotal > 0) {
    lines.push(
      `Fallidos (histórico): ${report.personalAlerts.failedTotal} · Pendientes: ${report.personalAlerts.pendingTotal}`,
    );
  }
  if (report.personalAlerts.anomalies.length > 0) {
    lines.push(
      "⚠️ Posible anomalía — alertas con >15 avisos en 24h:",
      ...report.personalAlerts.anomalies.map(
        (a) => `• <code>${a.alertId}</code>: ${a.count} avisos`,
      ),
    );
  }

  return lines.join("\n");
}

export async function sendAdminDigest(): Promise<void> {
  if (!isTelegramConfigured()) return;
  const chatId = resolveAdminChatId();
  if (!chatId) {
    console.warn("[admin-digest] Falta TELEGRAM_ADMIN_CHAT_ID.");
    return;
  }

  const report = await buildAdminDigestReport();
  const text = formatAdminDigestMessage(report);
  await sendTelegramMessage({ chatId, text, disableWebPagePreview: true });
}
