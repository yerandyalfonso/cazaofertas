import { getCategoryProducts, type CatalogProduct } from "@/lib/catalog";
import {
  getBlogCategory,
  getSubcategoryByPath,
  productMatchesSubcategory,
} from "@/lib/site-categories";

/**
 * Ofertas de la página de una categoría (o de una de sus subcategorías),
 * ordenadas por puntuación. `null` si la categoría o subcategoría no existe.
 */
export async function getCategoryListing(
  slug: string,
  child: string | null,
): Promise<CatalogProduct[] | null> {
  if (!child) return getCategoryProducts(slug);

  const sub = getSubcategoryByPath(slug, child);
  const parent = getBlogCategory(slug);
  if (!sub || !parent) return null;

  const products = await getCategoryProducts(slug);
  return products.filter((product) =>
    productMatchesSubcategory(product.category, parent.slug, sub),
  );
}
