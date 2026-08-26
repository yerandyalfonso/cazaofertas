import Link from "next/link";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { productHasMonitorableUrl } from "@/services/products";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let productCount = 0;
  let monitorable = 0;
  let lastCheckedAt: string | null = null;
  let loadError: string | null = null;

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
          Resumen operativo de catálogo y monitorización de precios Amazon.
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
