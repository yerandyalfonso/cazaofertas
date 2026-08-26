import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { productHasMonitorableUrl } from "@/services/products";

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

function startOfDaysAgo(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString();
}

export default async function AdminDashboardPage({
  searchParams,
}: AdminDashboardPageProps) {
  const params = await searchParams;
  const includeTest = params.include_test === "1";

  let productCount = 0;
  let monitorable = 0;
  let lastCheckedAt: string | null = null;
  let loadError: string | null = null;

  let clicks7d = 0;
  let clicks30d = 0;
  let testClicks7d = 0;
  let clicksBySource: { source: string; count: number }[] = [];
  let recentClicks: ClickRow[] = [];
  let clicksError: string | null = null;

  try {
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("products")
      .select("id, amazon_url, asin, last_checked_at, is_active")
      .eq("is_active", true);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    productCount = rows.length;
    monitorable = rows.filter(productHasMonitorableUrl).length;
    lastCheckedAt =
      rows
        .map((row) => row.last_checked_at)
        .filter((value): value is string => Boolean(value))
        .sort()
        .reverse()[0] ?? null;

    const since30 = startOfDaysAgo(30);
    const since7 = startOfDaysAgo(7);

    let clicksQuery = client
      .from("affiliate_clicks")
      .select(
        "id, product_id, article_id, source, is_test, created_at, products(title, slug)",
      )
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!includeTest) {
      clicksQuery = clicksQuery.eq("is_test", false);
    }

    const { data: clickRows, error: clickErr } = await clicksQuery;

    if (clickErr) {
      clicksError = clickErr.message;
    } else {
      const all = (clickRows ?? []) as ClickRow[];
      const since7Ms = new Date(since7).getTime();

      const realOrAll = includeTest ? all : all.filter((c) => !c.is_test);
      clicks30d = realOrAll.length;
      clicks7d = realOrAll.filter(
        (c) => new Date(c.created_at).getTime() >= since7Ms,
      ).length;
      testClicks7d = all.filter(
        (c) =>
          c.is_test && new Date(c.created_at).getTime() >= since7Ms,
      ).length;

      const sourceMap = new Map<string, number>();
      for (const click of realOrAll) {
        const key = click.source || "web";
        sourceMap.set(key, (sourceMap.get(key) ?? 0) + 1);
      }
      clicksBySource = [...sourceMap.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      recentClicks = all.slice(0, 12);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Error al cargar.";
  }

  return (
    <div>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
          Panel
        </p>
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
          Dashboard
        </h1>
        <p className="mt-2 max-w-xl text-sm text-stone-600">
          Resumen operativo de catálogo, monitorización y clics de afiliado.
        </p>
      </header>

      {loadError ? (
        <p className="mt-8 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {loadError}
        </p>
      ) : (
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <StatCard label="Productos activos" value={String(productCount)} />
          <StatCard
            label="Con URL Amazon"
            value={String(monitorable)}
            hint="Listos para el scraper"
          />
          <StatCard
            label="Última revisión"
            value={
              lastCheckedAt
                ? new Date(lastCheckedAt).toLocaleString("es-ES")
                : "Sin datos"
            }
          />
        </div>
      )}

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
                : "Solo tráfico real (clics de prueba ocultos)."}
            </p>
          </div>
          <Link
            href={
              includeTest ? "/admin" : "/admin?include_test=1"
            }
            className="inline-flex h-10 items-center border border-stone-400 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink transition hover:border-ink"
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
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Clics (7 días)"
                value={String(clicks7d)}
                hint={includeTest ? "Con pruebas incluidas" : "Solo reales"}
              />
              <StatCard
                label="Clics (30 días)"
                value={String(clicks30d)}
                hint={includeTest ? "Con pruebas incluidas" : "Solo reales"}
              />
              <StatCard
                label="Pruebas (7 días)"
                value={String(testClicks7d)}
                hint="is_test = true"
              />
            </div>

            {clicksBySource.length > 0 ? (
              <div className="mt-6 border border-stone-300 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  Por origen (30 días)
                </p>
                <ul className="mt-4 space-y-2">
                  {clicksBySource.map((row) => (
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
              <div className="mt-6 overflow-x-auto border border-stone-300 bg-white">
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
        )}
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Link
          href="/admin/products"
          className="border border-stone-300 bg-white p-6 transition hover:border-ink"
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
          className="border border-stone-300 bg-white p-6 transition hover:border-ink"
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
          className="border border-stone-300 bg-white p-6 transition hover:border-ink"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Operaciones
          </p>
          <h2 className="mt-2 font-display text-2xl text-ink">
            Monitorización / Cron
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Lanza la revisión de precios y revisa chollos o errores.
          </p>
        </Link>
      </div>
    </div>
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
    <div className="border border-stone-300 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
        {label}
      </p>
      <p className="mt-3 font-display text-2xl tracking-tight text-ink">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-stone-500">{hint}</p> : null}
    </div>
  );
}
