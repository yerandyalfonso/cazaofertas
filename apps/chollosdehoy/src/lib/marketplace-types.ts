import type {
  CategoryFilterNode,
  MarketplaceProduct,
  MarketplaceStats,
} from "@/lib/types";
import type { CouponOffer } from "@/lib/coupons";

export interface PaginatedProducts {
  items: MarketplaceProduct[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MarketplaceBootstrap {
  categories: CategoryFilterNode[];
  stats: MarketplaceStats;
  spotlight: {
    topDeals: MarketplaceProduct[];
    trending: MarketplaceProduct[];
    latest: MarketplaceProduct[];
  };
  coupons: CouponOffer[];
  initialPage: PaginatedProducts;
}
