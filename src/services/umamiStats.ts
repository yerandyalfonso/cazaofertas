/**
 * Estadísticas de visitas desde Umami (self-hosted en el VPS, 127.0.0.1:3002).
 * Solo servidor: usa usuario/contraseña de Umami para obtener un token.
 */

export interface UmamiSiteSummary {
  pageviews: number;
  visitors: number;
  visits: number;
  /** % de visitas de una sola página. */
  bounceRate: number;
  /** Segundos medios por visita. */
  avgVisitSeconds: number;
  /** Mismas métricas del periodo anterior (comparación). */
  previous: { pageviews: number; visitors: number };
}

export interface UmamiMetric {
  label: string;
  count: number;
}

export interface UmamiSiteReport {
  name: string;
  summary: UmamiSiteSummary;
  topPages: UmamiMetric[];
  topReferrers: UmamiMetric[];
}

const TOKEN_TTL_MS = 60 * 60 * 1000;
let cachedToken: { value: string; expiresAt: number } | null = null;

export function isUmamiConfigured(): boolean {
  return Boolean(
    process.env.UMAMI_API_URL?.trim() &&
      process.env.UMAMI_USERNAME?.trim() &&
      process.env.UMAMI_PASSWORD?.trim(),
  );
}

function apiUrl(path: string): string {
  return `${process.env.UMAMI_API_URL!.trim().replace(/\/$/, "")}${path}`;
}

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.UMAMI_USERNAME,
      password: process.env.UMAMI_PASSWORD,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Umami login HTTP ${res.status}`);
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Umami login sin token");
  cachedToken = { value: data.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return data.token;
}

async function umamiGet<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) cachedToken = null;
  if (!res.ok) throw new Error(`Umami ${path.split("?")[0]} HTTP ${res.status}`);
  return (await res.json()) as T;
}

type StatsResponse = {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
  comparison?: { pageviews: number; visitors: number };
};

async function getMetrics(
  websiteId: string,
  range: string,
  type: "path" | "referrer",
): Promise<UmamiMetric[]> {
  const rows = await umamiGet<Array<{ x: string | null; y: number }>>(
    `/api/websites/${websiteId}/metrics?${range}&type=${type}&limit=10`,
  );
  return rows
    .slice(0, 10)
    .map((row) => ({ label: row.x || "(directo)", count: row.y }));
}

export async function getUmamiSiteReport(
  name: string,
  websiteId: string,
  days: number,
): Promise<UmamiSiteReport> {
  const endAt = Date.now();
  const startAt = endAt - days * 24 * 3_600_000;
  const range = `startAt=${startAt}&endAt=${endAt}`;

  const [stats, topPages, topReferrers] = await Promise.all([
    umamiGet<StatsResponse>(`/api/websites/${websiteId}/stats?${range}`),
    getMetrics(websiteId, range, "path"),
    getMetrics(websiteId, range, "referrer"),
  ]);

  return {
    name,
    summary: {
      pageviews: stats.pageviews,
      visitors: stats.visitors,
      visits: stats.visits,
      bounceRate: stats.visits ? Math.round((stats.bounces / stats.visits) * 100) : 0,
      avgVisitSeconds: stats.visits ? Math.round(stats.totaltime / stats.visits) : 0,
      previous: {
        pageviews: stats.comparison?.pageviews ?? 0,
        visitors: stats.comparison?.visitors ?? 0,
      },
    },
    topPages,
    topReferrers,
  };
}

/** Informes de marketplace y blog (los que tengan websiteId configurado). */
export async function getUmamiReports(days: number): Promise<UmamiSiteReport[]> {
  const sites = [
    { name: "Marketplace", id: process.env.UMAMI_MARKETPLACE_WEBSITE_ID?.trim() },
    { name: "Blog", id: process.env.UMAMI_BLOG_WEBSITE_ID?.trim() },
  ].filter((site): site is { name: string; id: string } => Boolean(site.id));
  return Promise.all(
    sites.map((site) => getUmamiSiteReport(site.name, site.id, days)),
  );
}
