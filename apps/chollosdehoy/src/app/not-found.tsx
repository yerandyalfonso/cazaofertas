import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { categoryHref } from "@/lib/links";
import { BLOG_CATEGORIES } from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="marketplace-shell">
      <SiteHeader />
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-16 md:py-24">
        <p className="text-sm font-medium text-muted">Error 404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          No encontramos esta página
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Puede que la oferta haya terminado o que el enlace esté mal escrito.
          Estas son las categorías con chollos ahora mismo:
        </p>

        <ul className="mt-6 flex flex-wrap gap-2">
          {BLOG_CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                href={categoryHref(category.slug)}
                className="tap-target inline-flex items-center rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Ver todos los chollos
          </Link>
          <Link href="/cupones" className="btn btn-ghost">
            Cupones
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
