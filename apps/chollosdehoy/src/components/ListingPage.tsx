import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { SiteFooter } from "@/components/SiteFooter";
import { withPage } from "@/lib/links";
import type { Listing } from "@/lib/listing";
import { pageNumbers } from "@/lib/pagination";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

function listingJsonLd(listing: Listing) {
  const url = absoluteUrl(withPage(listing.basePath, listing.page));
  return [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: listing.h1,
      description: listing.intro,
      url,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: listing.data.items.map((product, index) => ({
          "@type": "ListItem",
          position: (listing.page - 1) * listing.data.pageSize + index + 1,
          url: absoluteUrl(`/oferta/${product.slug}`),
          name: product.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: SITE_NAME, href: "/" },
        ...listing.breadcrumbs,
      ].map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.href),
      })),
    },
  ];
}

/** Listado renderizado en servidor para categorías, subcategorías y tiendas. */
export function ListingPage({ listing }: { listing: Listing }) {
  const { data, page, basePath } = listing;
  const from = (page - 1) * data.pageSize + 1;
  const to = Math.min(page * data.pageSize, data.total);

  return (
    <div className="marketplace-shell bg-[var(--bg)]">
      <script
        type="application/ld+json"
        // JSON escapado para que "</script>" en un título no rompa la página.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(listingJsonLd(listing)).replace(/</g, "\\u003c"),
        }}
      />
      <div className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="btn btn-ghost text-sm">
            <ArrowLeft className="h-4 w-4" />
            Todas las ofertas
          </Link>
          <nav
            className="flex min-w-0 flex-1 items-center gap-1 text-xs text-[var(--text-muted)]"
            aria-label="Migas de pan"
          >
            {listing.breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                {i < listing.breadcrumbs.length - 1 ? (
                  <Link href={crumb.href} className="truncate hover:text-[var(--text)]">
                    {crumb.name}
                  </Link>
                ) : (
                  <span className="truncate">{crumb.name}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:py-8">
        <header>
          <h1 className="text-2xl font-bold text-[var(--text)] md:text-3xl">
            {listing.h1}
            {page > 1 && (
              <span className="text-[var(--text-muted)]"> · Página {page}</span>
            )}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)]">
            {listing.intro}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {data.total} ofertas disponibles
          </p>
        </header>

        {listing.subLinks.length > 0 && (
          <nav aria-label="Subcategorías" className="flex flex-wrap gap-2">
            {listing.subLinks.map((sub) => (
              <Link
                key={sub.href}
                href={sub.href}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm transition hover:border-[var(--border-strong)]"
              >
                {sub.name}
                {sub.count !== undefined && (
                  <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                    {sub.count}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.items.map((product) => (
            <ProductCard key={product.id} product={product} view="grid" />
          ))}
        </div>

        {data.totalPages > 1 && (
          <nav
            className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            aria-label="Paginación"
          >
            <p className="text-sm text-[var(--text-muted)]">
              Mostrando{" "}
              <span className="font-medium text-[var(--text)]">
                {from}–{to}
              </span>{" "}
              de <span className="font-medium text-[var(--text)]">{data.total}</span>{" "}
              ofertas
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {page > 1 && (
                <Link
                  href={withPage(basePath, page - 1)}
                  className="btn btn-ghost p-2"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              )}
              {pageNumbers(page, data.totalPages).map((p, index) =>
                p === "…" ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-sm text-[var(--text-muted)]"
                  >
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={withPage(basePath, p)}
                    aria-current={p === page ? "page" : undefined}
                    className={`min-w-[2.25rem] rounded-[var(--radius-sm)] px-2 py-1.5 text-center text-sm font-semibold transition ${
                      p === page
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {p}
                  </Link>
                ),
              )}
              {page < data.totalPages && (
                <Link
                  href={withPage(basePath, page + 1)}
                  className="btn btn-ghost p-2"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </nav>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

/** Metadatos comunes: título con la página, canonical propio. */
export function listingMetadata(listing: Listing) {
  const path = withPage(listing.basePath, listing.page);
  const pageSuffix = listing.page > 1 ? ` · Página ${listing.page}` : "";
  const title = `${listing.h1} hoy${pageSuffix}`;
  const description = `${listing.data.total} ofertas: ${listing.intro}`.slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      type: "website" as const,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      locale: "es_ES",
      title,
      description,
    },
  };
}
