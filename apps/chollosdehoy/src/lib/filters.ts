import type { MarketplaceProduct, SortOption } from "@/lib/types";

export interface MarketplaceFilters {
  query: string;
  parentSlug: string | null;
  subcategorySlug: string | null;
  retailers: string[];
  minDiscount: number;
  maxPrice: number | null;
  minPrice: number | null;
  sort: SortOption;
  onlyFeatured: boolean;
  onlyTopDeals: boolean;
}

export const DEFAULT_FILTERS: MarketplaceFilters = {
  query: "",
  parentSlug: null,
  subcategorySlug: null,
  retailers: [],
  minDiscount: 0,
  maxPrice: null,
  minPrice: null,
  sort: "score",
  onlyFeatured: false,
  onlyTopDeals: false,
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function filterProducts(
  products: MarketplaceProduct[],
  filters: MarketplaceFilters,
): MarketplaceProduct[] {
  const q = normalize(filters.query.trim());

  let result = products.filter((product) => {
    if (q) {
      const haystack = normalize(
        [product.title, product.brand, product.category?.name, product.category?.parentName]
          .filter(Boolean)
          .join(" "),
      );
      if (!haystack.includes(q)) return false;
    }

    if (filters.parentSlug) {
      const parent = product.category?.parentSlug ?? product.category?.slug;
      if (parent !== filters.parentSlug) return false;
    }

    if (filters.subcategorySlug) {
      if (product.category?.slug !== filters.subcategorySlug) return false;
    }

    if (filters.retailers.length > 0) {
      if (!filters.retailers.includes(product.retailer)) return false;
    }

    if (product.discountPercentage < filters.minDiscount) return false;

    if (filters.minPrice !== null && product.currentPrice < filters.minPrice) {
      return false;
    }

    if (filters.maxPrice !== null && product.currentPrice > filters.maxPrice) {
      return false;
    }

    if (filters.onlyFeatured && !product.isFeatured) return false;

    if (filters.onlyTopDeals && product.dealScore < 55) return false;

    return true;
  });

  result = [...result].sort((a, b) => compareProducts(a, b, filters.sort));
  return result;
}

function compareProducts(
  a: MarketplaceProduct,
  b: MarketplaceProduct,
  sort: SortOption,
): number {
  switch (sort) {
    case "discount":
      return b.discountPercentage - a.discountPercentage;
    case "price-asc":
      return a.currentPrice - b.currentPrice;
    case "price-desc":
      return b.currentPrice - a.currentPrice;
    case "newest":
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case "score":
    default:
      if (b.dealScore !== a.dealScore) return b.dealScore - a.dealScore;
      return b.discountPercentage - a.discountPercentage;
  }
}

export function countActiveFilters(filters: MarketplaceFilters): number {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.parentSlug) count += 1;
  if (filters.subcategorySlug) count += 1;
  if (filters.retailers.length) count += 1;
  if (filters.minDiscount > 0) count += 1;
  if (filters.minPrice !== null) count += 1;
  if (filters.maxPrice !== null) count += 1;
  if (filters.onlyFeatured) count += 1;
  if (filters.onlyTopDeals) count += 1;
  return count;
}
