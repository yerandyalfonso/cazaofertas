import { isGeneralSubcategorySlug } from "@/lib/taxonomy";

/** Subcategorías con menos productos no tienen página propia (contenido pobre). */
export const MIN_SUBCATEGORY_PRODUCTS = 10;

/** Segmento URL de una subcategoría: "hogar-cocina" → "cocina". */
export function subcategorySegment(parentSlug: string, subSlug: string): string {
  const prefix = `${parentSlug}-`;
  return subSlug.startsWith(prefix) ? subSlug.slice(prefix.length) : subSlug;
}

/** «General» agrupa lo no clasificado: se ve en la página del padre. */
export function subcategoryHasPage(
  sub: { slug: string; productCount: number },
  parentSlug: string,
): boolean {
  return (
    !isGeneralSubcategorySlug(sub.slug, parentSlug) &&
    sub.productCount >= MIN_SUBCATEGORY_PRODUCTS
  );
}

/** Ruta de la página N de un listado: /categoria/hogar/pagina/2. */
export function withPage(path: string, page: number): string {
  return page > 1 ? `${path}/pagina/${page}` : path;
}

export function categoryHref(
  parentSlug: string,
  subSlug?: string | null,
  page = 1,
): string {
  const base = subSlug
    ? `/categoria/${parentSlug}/${subcategorySegment(parentSlug, subSlug)}`
    : `/categoria/${parentSlug}`;
  return withPage(base, page);
}

export function retailerHref(retailer: string, page = 1): string {
  return withPage(`/tienda/${retailer}`, page);
}
