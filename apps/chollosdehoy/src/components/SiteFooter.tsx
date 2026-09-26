import Link from "next/link";
import { getCategoryNodes, getRetailerCounts } from "@/lib/catalog";
import { categoryHref, retailerHref } from "@/lib/links";
import { retailerLabel } from "@/lib/retailers";

/**
 * Pie común con enlaces a todas las categorías y tiendas: además de
 * navegación, es lo que permite a Google descubrir esas páginas.
 */
export async function SiteFooter() {
  const [nodes, retailers] = await Promise.all([
    getCategoryNodes(),
    getRetailerCounts(),
  ]);
  const parents = nodes
    .filter((node) => !node.parentId && node.productCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-8">
      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 text-sm md:grid-cols-[1fr_2fr_1fr]">
        <div>
          <Link href="/" className="font-semibold text-[var(--text)]">
            Chollos de Hoy
          </Link>
          <p className="mt-1 text-[var(--text-muted)]">
            Marketplace de ofertas · Actualizado en tiempo real
          </p>
        </div>

        <nav aria-label="Categorías">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Categorías
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {parents.map((parent) => (
              <li key={parent.id}>
                <Link
                  href={categoryHref(parent.slug)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {parent.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Tiendas">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Tiendas
          </p>
          <ul className="space-y-1">
            {retailers.map((retailer) => (
              <li key={retailer.id}>
                <Link
                  href={retailerHref(retailer.id)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  {retailerLabel(retailer.id)}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/cupones"
                className="text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                Cupones
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
