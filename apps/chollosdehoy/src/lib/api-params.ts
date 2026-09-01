import { DEFAULT_FILTERS, type MarketplaceFilters } from "@/lib/filters";
import type { SortOption } from "@/lib/types";

export function filtersToSearchParams(
  filters: MarketplaceFilters,
  page: number,
  pageSize: number,
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.parentSlug) params.set("parent", filters.parentSlug);
  if (filters.subcategorySlug) params.set("sub", filters.subcategorySlug);
  if (filters.retailers.length) params.set("retailers", filters.retailers.join(","));
  if (filters.minDiscount > 0) params.set("minDiscount", String(filters.minDiscount));
  if (filters.minPrice !== null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.sort !== "score") params.set("sort", filters.sort);
  if (filters.onlyFeatured) params.set("featured", "1");
  if (filters.onlyTopDeals) params.set("topDeals", "1");
  return params;
}

export function searchParamsToFilters(
  params: URLSearchParams,
): { filters: MarketplaceFilters; page: number; pageSize: number } {
  const sort = params.get("sort") as SortOption | null;
  const validSorts: SortOption[] = [
    "score",
    "discount",
    "price-asc",
    "price-desc",
    "newest",
  ];

  return {
    page: Math.max(1, Number(params.get("page")) || 1),
    pageSize: Math.min(48, Math.max(12, Number(params.get("pageSize")) || 24)),
    filters: {
      ...DEFAULT_FILTERS,
      query: params.get("q") ?? "",
      parentSlug: params.get("parent"),
      subcategorySlug: params.get("sub"),
      retailers: params.get("retailers")?.split(",").filter(Boolean) ?? [],
      minDiscount: Number(params.get("minDiscount")) || 0,
      minPrice: params.get("minPrice") ? Number(params.get("minPrice")) : null,
      maxPrice: params.get("maxPrice") ? Number(params.get("maxPrice")) : null,
      sort: sort && validSorts.includes(sort) ? sort : "score",
      onlyFeatured: params.get("featured") === "1",
      onlyTopDeals: params.get("topDeals") === "1",
    },
  };
}
