import { getCategoryNodes, queryMarketplaceProducts } from "@/lib/catalog";
import { DEFAULT_FILTERS, type MarketplaceFilters } from "@/lib/filters";
import {
  categoryHref,
  retailerHref,
  subcategoryHasPage,
  subcategorySegment,
} from "@/lib/links";
import type { PaginatedProducts } from "@/lib/marketplace-types";
import { RETAILER_LABELS } from "@/lib/retailers";
import { BLOG_CATEGORIES } from "@/lib/taxonomy";

export interface ListingLink {
  name: string;
  href: string;
  count?: number;
}

/** Página de listado (categoría, subcategoría o tienda) resuelta desde la URL. */
export interface Listing {
  h1: string;
  intro: string;
  /** Ruta de la página 1, sin /pagina/N. */
  basePath: string;
  page: number;
  breadcrumbs: ListingLink[];
  /** Subcategorías con página propia (solo en categorías padre). */
  subLinks: ListingLink[];
  data: PaginatedProducts;
}

/** [] → 1; ["pagina", "N"] con N ≥ 2 → N; cualquier otra cosa → null (404). */
function parsePage(rest: string[]): number | null {
  if (rest.length === 0) return 1;
  if (rest.length !== 2 || rest[0] !== "pagina" || !/^\d+$/.test(rest[1])) {
    return null;
  }
  const page = Number(rest[1]);
  return page >= 2 ? page : null;
}

async function loadPage(
  filters: MarketplaceFilters,
  page: number,
): Promise<PaginatedProducts | null> {
  const data = await queryMarketplaceProducts(filters, page);
  if (data.total === 0 || page > data.totalPages) return null;
  return data;
}

/** /categoria/<padre>[/<sub>][/pagina/N] */
export async function resolveCategoryListing(
  path: string[],
): Promise<Listing | null> {
  const [parentSlug, maybeSub, ...rest] = path;
  const parentMeta = BLOG_CATEGORIES.find((c) => c.slug === parentSlug);
  if (!parentMeta) return null;

  const nodes = await getCategoryNodes();
  const parent = nodes.find((n) => n.slug === parentSlug && !n.parentId);
  if (!parent) return null;

  const subs = nodes
    .filter((n) => n.parentId === parent.id && subcategoryHasPage(n, parent.slug))
    .sort((a, b) => b.productCount - a.productCount);

  const isSubPath = maybeSub !== undefined && maybeSub !== "pagina";
  const sub = isSubPath
    ? subs.find((n) => subcategorySegment(parent.slug, n.slug) === maybeSub)
    : null;
  if (isSubPath && !sub) return null;

  const page = parsePage(isSubPath ? rest : path.slice(1));
  if (page === null) return null;

  const data = await loadPage(
    { ...DEFAULT_FILTERS, parentSlug: parent.slug, subcategorySlug: sub?.slug ?? null },
    page,
  );
  if (!data) return null;

  const parentLink = { name: parent.name, href: categoryHref(parent.slug) };
  if (sub) {
    return {
      h1: `Ofertas de ${sub.name}`,
      intro: `Chollos y descuentos en ${sub.name.toLowerCase()} (${parent.name}), con el precio comprobado y ordenados por calidad de la oferta.`,
      basePath: categoryHref(parent.slug, sub.slug),
      page,
      breadcrumbs: [parentLink, { name: sub.name, href: categoryHref(parent.slug, sub.slug) }],
      subLinks: [],
      data,
    };
  }

  return {
    h1: `Ofertas de ${parent.name}`,
    intro: `${parentMeta.description} Los mejores chollos de hoy, con el precio comprobado y ordenados por calidad de la oferta.`,
    basePath: parentLink.href,
    page,
    breadcrumbs: [parentLink],
    subLinks: subs.map((n) => ({
      name: n.name,
      href: categoryHref(parent.slug, n.slug),
      count: n.productCount,
    })),
    data,
  };
}

/** /tienda/<tienda>[/pagina/N] */
export async function resolveRetailerListing(
  path: string[],
): Promise<Listing | null> {
  const [retailer, ...rest] = path;
  const label = RETAILER_LABELS[retailer];
  if (!label) return null;

  const page = parsePage(rest);
  if (page === null) return null;

  const data = await loadPage({ ...DEFAULT_FILTERS, retailers: [retailer] }, page);
  if (!data) return null;

  return {
    h1: `Ofertas de ${label}`,
    intro: `Los mejores chollos de ${label} hoy, con el precio comprobado y ordenados por calidad de la oferta.`,
    basePath: retailerHref(retailer),
    page,
    breadcrumbs: [{ name: label, href: retailerHref(retailer) }],
    subLinks: [],
    data,
  };
}
