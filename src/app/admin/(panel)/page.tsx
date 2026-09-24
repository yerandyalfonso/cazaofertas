import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { formatFullDateTime, formatRelativeTime } from "@/lib/relative-time";
import {
  getAdminCatalogStats,
  getAdminClickStats,
} from "@/services/adminDashboard";
import {
  getAdminAttentionItems,
  type AttentionItem,
} from "@/services/adminAttention";
import { countPendingChannelNotifications } from "@/services/telegramFlush";

export const dynamic = "force-dynamic";

interface AdminDashboardPageProps {
  searchParams: Promise<{ include_test?: string }>;
}

type ClickRow = {
  id: string;
  product_id: string;
  article_id: string | null;
  source: string;
  is_test: boolean;
  created_at: string;
  products: { title: string; slug: string } | { title: string; slug: string }[] | null;
};

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const params = await searchParams;
  const includeTest = params.include_test === "1";

  let catalog = null;
  let clicks = null;
  let pendingTelegram = 0;
  let loadError: string | null = null;
  let clicksError: string | null = null;
  let recentClicks: ClickRow[] = [];
  const attention: AttentionItem[] | null = await getAdminAttentionItems().catch(
    () => null,
  );

  try {
    const [catalogStats, clickStats, telegramPending] = await Promise.all([
      getAdminCatalogStats(),
      getAdminClickStats({ includeTest }),
      countPendingChannelNotifications(),
    ]);
    catalog = catalogStats;
    clicks = clickStats;
    pendingTelegram = telegramPending;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Error al cargar.";
  }

  if (!loadError) {
    try {
      const client = createSupabaseServiceClient();
      let recentQuery = client
        .from("affiliate_clicks")
        .select(
          "id, product_id, article_id, source, is_test, created_at, products(title, slug)",
        )
        .order("created_at", { ascending: false })
        .limit(12);

      if (!includeTest) {
        recentQuery = recentQuery.eq("is_test", false);
      }

      const { data: clickRows, error: clickErr } = await recentQuery;
      if (clickErr) {
        clicksError = clickErr.message;
      } else {
        recentClicks = (clickRows ?? []) as ClickRow[];
      }
    } catch (error) {
      clicksError =
        error instanceof Error ? error.message : "Error al cargar clics.";
    }
  }

  return (
    <div>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
          Panel
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[var(--text)]">
          Dashboard
        </h1>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          Resumen operativo de catálogo, monitorización y clics de afiliado.
        </p>
      </header>

      {attention ? <AttentionPanel items={attention} /> : null}

      {loadError ? (
        <p className="mt-8 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </p>
      ) : catalog ? (
        <>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Productos activos" value={String(catalog.activeProducts)} />
            <StatCard
              label="Amazon monitorizable"
              value={String(catalog.amazonMonitorable)}
              hint="Con ASIN o URL Amazon"
            />
            <StatCard
              label="Retail monitorizable"
              value={String(catalog.retailMonitorable)}
              hint="Miravia, Kiabi, etc."
            />
            <StatCard
              label="Sin revisar"
              value={String(catalog.neverChecked)}
              hint="Nunca comprobados por cron"
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Última revisión"
              value={
                catalog.lastCheckedAt
                  ? formatRelativeTime(catalog.lastCheckedAt)
                  : "Sin datos"
              }
              hint={formatFullDateTime(catalog.lastCheckedAt) || undefined}
            />
            <StatCard
              label="Telegram pendientes"
              value={String(pendingTelegram)}
              hint="Solo estado pending (sin fallidos)"
            />
          </div>

          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Cobertura por tienda y detalle de vigilancia en{" "}
            <Link href="/admin/cron" className="font-semibold text-[var(--primary)] hover:underline">
              Operaciones
            </Link>
            .
          </p>
        </>
      ) : null}

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
              Afiliados
            </p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-ink">
              Clics de afiliación
            </h2>
            <p className="mt-1 max-w-lg text-sm text-stone-600">
              {includeTest
                ? "Incluyendo clics de prueba (admin / ?test=true)."
                : "Solo tráfico real (clics de prueba ocultos). Conteos totales en base de datos."}
            </p>
          </div>
          <Link
            href={
              includeTest ? "/admin" : "/admin?include_test=1"
            }
            className="admin-btn admin-btn-ghost"
          >
            {includeTest ? "Ocultar pruebas" : "Mostrar pruebas"}
          </Link>
        </div>

        {clicksError ? (
          <p className="mt-6 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No se pudieron cargar los clics: {clicksError}. ¿Aplicaste la
            migración{" "}
            <code className="text-xs">0009_affiliate_clicks_tracking.sql</code>
            ?
          </p>
        ) : clicks ? (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Clics (7 días)"
                value={String(clicks.clicks7d)}
                hint={includeTest ? "Con pruebas incluidas" : "Solo reales"}
              />
              <StatCard
                label="Clics (30 días)"
                value={String(clicks.clicks30d)}
                hint={includeTest ? "Con pruebas incluidas" : "Solo reales"}
              />
              <StatCard
                label="Pruebas (7 días)"
                value={String(clicks.testClicks7d)}
                hint="is_test = true"
              />
            </div>

            {clicks.bySource.length > 0 ? (
              <div className="admin-card mt-6 p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Por origen (30 días)
                </p>
                <ul className="mt-4 space-y-2">
                  {clicks.bySource.map((row) => (
                    <li
                      key={row.source}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium text-ink">{row.source}</span>
                      <span className="text-stone-600">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-6 text-sm text-stone-500">
                Aún no hay clics registrados en los últimos 30 días.
              </p>
            )}

            {recentClicks.length > 0 ? (
              <div className="admin-table-wrap mt-6">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-stone-200 bg-stone-50 text-[11px] uppercase tracking-[0.12em] text-stone-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Producto</th>
                      <th className="px-4 py-3 font-semibold">Origen</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentClicks.map((click) => {
                      const product = Array.isArray(click.products)
                        ? click.products[0]
                        : click.products;
                      return (
                        <tr
                          key={click.id}
                          className="border-b border-stone-100 last:border-0"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-stone-600">
                            {new Date(click.created_at).toLocaleString("es-ES")}
                          </td>
                          <td className="px-4 py-3 text-ink">
                            {product?.slug ? (
                              <Link
                                href={`/producto/${product.slug}`}
                                className="hover:text-teal-900"
                              >
                                {product.title}
                              </Link>
                            ) : (
                              <span className="text-stone-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-stone-600">
                            {click.source}
                          </td>
                          <td className="px-4 py-3">
                            {click.is_test ? (
                              <span className="inline-flex bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                                Prueba
                              </span>
                            ) : (
                              <span className="inline-flex bg-teal-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-900">
                                Real
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/products"
          className="admin-card p-6 transition hover:border-[var(--primary)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Gestión
          </p>
          <h2 className="mt-2 font-display text-2xl text-ink">Productos</h2>
          <p className="mt-2 text-sm text-stone-600">
            Alta y edición por URL de Amazon, precios y categorías.
          </p>
        </Link>
        <Link
          href="/admin/articles"
          className="admin-card p-6 transition hover:border-[var(--primary)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Editorial
          </p>
          <h2 className="mt-2 font-display text-2xl text-ink">Artículos</h2>
          <p className="mt-2 text-sm text-stone-600">
            Redacta el blog y vincula productos a cada pieza.
          </p>
        </Link>
        <Link
          href="/admin/cron"
          className="admin-card p-6 transition hover:border-[var(--primary)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Operaciones
          </p>
          <h2 className="mt-2 font-display text-2xl text-ink">
            Monitorización y configuración
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Estado de crons, feeds, Telegram y ejecución manual.
          </p>
        </Link>
      </div>
    </div>
  );
}

function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="admin-card mt-8 flex items-center gap-3 p-4 text-sm text-[var(--text-muted)]">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        Todo en orden: no hay tareas pendientes.
      </div>
    );
  }
  return (
    <section className="mt-8" aria-labelledby="attention-title">
      <h2
        id="attention-title"
        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]"
      >
        Requiere atención
      </h2>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">
        {items.map((item) => {
          const warning = item.tone === "warning";
          const Icon = warning ? AlertTriangle : Info;
          return (
            <li
              key={item.id}
              className={`admin-card flex items-start gap-3 p-4 ${
                warning ? "border-amber-300 bg-amber-50/60" : ""
              }`}
            >
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${
                  warning ? "text-amber-600" : "text-[var(--primary)]"
                }`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text)]">{item.title}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.detail}</p>
              </div>
              <Link
                href={item.href}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
              >
                {item.cta}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="admin-card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--text)]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p> : null}
    </div>
  );
}
