export enum DealLevel {
  NORMAL = "NORMAL",
  GOOD_DEAL = "GOOD_DEAL",
  GREAT_DEAL = "GREAT_DEAL",
  HISTORICAL_LOW = "HISTORICAL_LOW",
}

export type SortOption =
  | "score"
  | "discount"
  | "price-asc"
  | "price-desc"
  | "newest";

export type ViewMode = "grid" | "list";

export interface MarketplaceProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  brand: string | null;
  retailer: string;
  currentPrice: number;
  previousPrice: number | null;
  lowestPrice: number | null;
  discountPercentage: number;
  affiliateUrl: string;
  productUrl: string;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  /** IN_STOCK | OUT_OF_STOCK | PREORDER | UNKNOWN */
  availability: string | null;
  /** Caducidad de la oferta flash, si Amazon la publica. */
  expiresAt: string | null;
  /** false = retirado del catálogo (la ficha sigue accesible con alternativas). */
  isActive: boolean;
  category: {
    id: string;
    name: string;
    slug: string;
    parentSlug: string | null;
    parentName: string | null;
  } | null;
  dealLevel: DealLevel;
  dealScore: number;
  dealLabel: string;
}

export interface CategoryFilterNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  productCount: number;
}

export interface MarketplaceStats {
  totalProducts: number;
  avgDiscount: number;
  topRetailer: { id: string; count: number } | null;
}

export interface MarketplaceData {
  products: MarketplaceProduct[];
  categories: CategoryFilterNode[];
  stats: MarketplaceStats;
}
