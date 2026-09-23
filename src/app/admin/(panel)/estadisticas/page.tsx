import Link from "next/link";
import { retailerLabel } from "@/lib/retailers";
import { marketplaceAbsoluteUrl } from "@/lib/site";
import {
  getAdminClickStats,
  getTopClickedProducts,
  type AdminClickStats,
  type TopClickedProduct,
} from "@/services/adminDashboard";
import {
  getUmamiReports,
  isUmamiConfigured,
  type UmamiMetric,
  type UmamiSiteReport,
} from "@/services/umamiStats";

export const dynamic = "force-dynamic";

const RANGES = [
  { days: 1, label: "24 h" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
] as const;

interface StatsPageProps {
  searchParams: Promise<{ days?: string }>;
}

function formatNumber(value: number): string {
  return value.toLocaleString("es-ES");
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

function Trend({ current, previous }: { current: number; previous: number }) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const color = pct >= 0 ? "text-emerald-700" : "text-rose-700";
  return (
    <span className={`ml-2 text-xs font-medium ${color}`}>
      {pct >= 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: React.ReactNode;
}) {
  return (
    <div className="admin-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text)]">
        {value}
        {trend}
      </p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}

function MetricList({ title, rows }: { title: string; rows: UmamiMetric[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="admin-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">Sin datos todavía.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate" title={row.label}>
                {row.label}
              </span>
              <div className="h-2 w-24 shrink-0 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.max((row.count / max) * 100, 4)}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tabular-nums text-stone-600">
                {formatNumber(row.count)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SiteSection({ report }: { report: UmamiSiteReport }) {
  const { summary } = report;
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-[var(--text)]">{report.name}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Visitantes"
          value={formatNumber(summary.visitors)}
          trend={<Trend current={summary.visitors} previous={summary.previous.visitors} />}
        />
        <StatCard
          label="Páginas vistas"
          value={formatNumber(summary.pageviews)}
          trend={<Trend current={summary.pageviews} previous={summary.previous.pageviews} />}
        />
        <StatCard
          label="Rebote"
          value={`${summary.bounceRate}%`}
          hint="Visitas de una sola página"
        />
        <StatCard
          label="Tiempo medio"
          value={formatDuration(summary.avgVisitSeconds)}
          hint="Por visita"
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <MetricList title="Páginas más vistas" rows={report.topPages} />
        <MetricList title="De dónde llegan" rows={report.topReferrers} />
      </div>
    </section>
  );
}

export default async function AdminStatsPage({ searchParams }: StatsPageProps) {
  const params = await searchParams;
  const days =
    RANGES.find((range) => String(range.days) === params.days)?.days ?? 7;

  let reports: UmamiSiteReport[] = [];
  let umamiError: string | null = null;
  if (isUmamiConfigured()) {
    try {
      reports = await getUmamiReports(days);
    } catch (error) {
      umamiError = error instanceof Error ? error.message : "Error desconocido";
    }
  } else {
    umamiError = "Umami no configurado (UMAMI_API_URL / UMAMI_USERNAME / UMAMI_PASSWORD).";
  }

  let clickStats: AdminClickStats | null = null;
  let topProducts: TopClickedProduct[] = [];
  let clicksError: string | null = null;
  try {
    [clickStats, topProducts] = await Promise.all([
      getAdminClickStats(),
      getTopClickedProducts(days),
    ]);
  } catch (error) {
    clicksError = error instanceof Error ? error.message : "Error desconocido";
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
            Panel
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--text)]">
            Estadísticas
          </h1>
          <p className="mt-2 max-w-xl text-sm text-stone-600">
            Visitas (Umami, sin cookies) y clics a tiendas de afiliado.
          </p>
        </div>
        <nav className="flex gap-2" aria-label="Periodo">
          {RANGES.map((range) => (
            <Link
              key={range.days}
              href={`/admin/estadisticas?days=${range.days}`}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                range.days === days
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {range.label}
            </Link>
          ))}
        </nav>
      </header>

      {umamiError ? (
        <p className="mt-8 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Visitas no disponibles: {umamiError}
        </p>
      ) : (
        reports.map((report) => <SiteSection key={report.name} report={report} />)
      )}

      <section className="mt-12">
        <h2 className="text-xl font-bold text-[var(--text)]">Clics a tiendas</h2>
        {clicksError ? (
          <p className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {clicksError}
          </p>
        ) : clickStats ? (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Clics 7 días" value={formatNumber(clickStats.clicks7d)} />
              <StatCard label="Clics 30 días" value={formatNumber(clickStats.clicks30d)} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MetricList
                title="Clics por fuente (30 días)"
                rows={clickStats.bySource.map((row) => ({
                  label: row.source,
                  count: row.count,
                }))}
              />
              <div className="admin-card p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                  Productos con más clics
                </p>
                {topProducts.length === 0 ? (
                  <p className="mt-3 text-sm text-stone-500">Sin clics en el periodo.</p>
                ) : (
                  <ol className="mt-3 space-y-2 text-sm">
                    {topProducts.map((row) => (
                      <li key={row.productId} className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate">
                          {row.slug ? (
                            <a
                              href={marketplaceAbsoluteUrl(`/oferta/${row.slug}`)}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {row.title}
                            </a>
                          ) : (
                            row.title
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-stone-500">
                          {row.retailer ? retailerLabel(row.retailer) : ""}
                        </span>
                        <span className="w-10 shrink-0 text-right tabular-nums text-stone-600">
                          {formatNumber(row.clicks)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
