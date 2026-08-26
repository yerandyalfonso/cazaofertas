export enum DealLevel {
  NORMAL = "NORMAL",
  GOOD_DEAL = "GOOD_DEAL",
  GREAT_DEAL = "GREAT_DEAL",
  HISTORICAL_LOW = "HISTORICAL_LOW",
}

export enum ProductAvailability {
  IN_STOCK = "IN_STOCK",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  PREORDER = "PREORDER",
  UNKNOWN = "UNKNOWN",
}

export type PriceSource = "seed" | "mock" | "amazon" | "keepa";

export type {
  PriceProvider,
  ProductPriceData,
} from "@/providers/price/types";

export interface DealScoringInput {
  currentPrice: number;
  previousPrice: number | null;
  lowestPrice: number | null;
  discountPercentage: number;
  categorySlug: string;
  priceChangeCount30d: number;
  previousPriceAgeHours: number | null;
}

export interface DealScoringResult {
  score: number;
  level: DealLevel;
  reasons: string[];
  discountPercentage: number;
  savings: number;
  distanceToHistoricalLowPercent: number | null;
}

export interface DealScoringConfig {
  minDiscountPercentForDeal: number;
  goodDealScore: number;
  greatDealScore: number;
  historicalLowDistancePercent: number;
  weights: {
    discountPercent: number;
    absoluteSavings: number;
    historicalProximity: number;
    stability: number;
    priceAge: number;
    category: number;
  };
  categoryBonuses: Record<string, number>;
}
