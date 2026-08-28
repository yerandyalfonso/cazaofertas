import { calculateDiscountPercentage, roundMoney } from "@/lib/money";
import { evaluateHistoricalLow } from "@/services/historicalLow";
import {
  DealLevel,
  type DealScoringConfig,
  type DealScoringInput,
  type DealScoringResult,
} from "@/types";

export const DEFAULT_DEAL_SCORING_CONFIG: DealScoringConfig = {
  minDiscountPercentForDeal: 5,
  goodDealScore: 40,
  greatDealScore: 70,
  historicalLowDistancePercent: 1,
  weights: {
    discountPercent: 1,
    absoluteSavings: 1,
    historicalProximity: 1,
    stability: 1,
    priceAge: 1,
    category: 1,
  },
  categoryBonuses: {
    tecnologia: 6,
    informatica: 6,
    hogar: 3,
    belleza: 2,
    deportes: 2,
    moda: 1,
    juguetes: 2,
    videojuegos: 5,
    bebe: 2,
    mascotas: 2,
    jardin: 2,
    automovil: 2,
  },
};

export const DEAL_LEVEL_LABELS: Record<DealLevel, string> = {
  [DealLevel.NORMAL]: "Precio normal",
  [DealLevel.GOOD_DEAL]: "Buena oferta",
  [DealLevel.GREAT_DEAL]: "Gran oferta",
  [DealLevel.HISTORICAL_LOW]: "Chollazo",
};

export interface ProductDealInput {
  currentPrice: number;
  previousPrice: number | null;
  lowestPrice: number | null;
  categorySlug?: string;
  priceChangeCount30d?: number;
  previousPriceAgeHours?: number | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function historicalDistancePercent(
  currentPrice: number,
  lowestPrice: number | null,
): number | null {
  return evaluateHistoricalLow({ currentPrice, lowestPrice }).distancePercent;
}

function mapScoreToLevel(
  score: number,
  isHistoricalLow: boolean,
  config: DealScoringConfig,
): DealLevel {
  if (isHistoricalLow) {
    return DealLevel.HISTORICAL_LOW;
  }

  if (score >= config.greatDealScore) {
    return DealLevel.GREAT_DEAL;
  }

  if (score >= config.goodDealScore) {
    return DealLevel.GOOD_DEAL;
  }

  return DealLevel.NORMAL;
}

export class DealScoringService {
  constructor(private readonly config: DealScoringConfig = DEFAULT_DEAL_SCORING_CONFIG) {}

  getLabel(level: DealLevel): string {
    return DEAL_LEVEL_LABELS[level];
  }

  scoreProduct(input: ProductDealInput): DealScoringResult & { label: string } {
    const discountPercentage =
      input.previousPrice === null
        ? 0
        : calculateDiscountPercentage(input.previousPrice, input.currentPrice);

    const result = this.score({
      currentPrice: input.currentPrice,
      previousPrice: input.previousPrice,
      lowestPrice: input.lowestPrice,
      discountPercentage,
      categorySlug: input.categorySlug ?? "general",
      priceChangeCount30d: input.priceChangeCount30d ?? 1,
      previousPriceAgeHours: input.previousPriceAgeHours ?? 72,
    });

    return {
      ...result,
      label: this.getLabel(result.level),
    };
  }

  score(input: DealScoringInput): DealScoringResult {
    const reasons: string[] = [];
    const savings =
      input.previousPrice === null
        ? 0
        : roundMoney(input.previousPrice - input.currentPrice);
    const discountPercentage =
      input.previousPrice === null
        ? 0
        : calculateDiscountPercentage(input.previousPrice, input.currentPrice);
    const distanceToHistoricalLowPercent = historicalDistancePercent(
      input.currentPrice,
      input.lowestPrice,
    );

    if (input.previousPrice === null || savings <= 0) {
      return {
        score: 0,
        level: DealLevel.NORMAL,
        reasons: ["Sin bajada de precio respecto al valor almacenado."],
        discountPercentage,
        savings,
        distanceToHistoricalLowPercent,
      };
    }

    let score = 0;

    const discountPoints =
      clamp(discountPercentage, 0, 50) * 0.8 * this.config.weights.discountPercent;
    score += discountPoints;
    if (discountPercentage >= 30) {
      reasons.push(`Descuento alto (${discountPercentage}%).`);
    } else if (discountPercentage >= 15) {
      reasons.push(`Descuento relevante (${discountPercentage}%).`);
    }

    const savingsPoints =
      clamp(savings / 80, 0, 1) * 15 * this.config.weights.absoluteSavings;
    score += savingsPoints;
    if (savings >= 30) {
      reasons.push(`Ahorro absoluto de ${savings.toFixed(2)} €.`);
    }

    let historicalPoints = 0;
    const historical = evaluateHistoricalLow({
      currentPrice: input.currentPrice,
      lowestPrice: input.lowestPrice,
      nearThresholdPercent: this.config.historicalLowDistancePercent,
    });
    const isHistoricalLow = historical.isNearHistoricalLow;

    if (historical.isAtHistoricalLow || isHistoricalLow) {
      historicalPoints = 30;
      reasons.push("Precio en el mínimo histórico o muy cercano.");
    } else if (
      historical.distancePercent !== null &&
      historical.distancePercent <= 5
    ) {
      historicalPoints = 18;
      reasons.push("Precio cercano al mínimo histórico.");
    } else if (
      historical.distancePercent !== null &&
      historical.distancePercent <= 10
    ) {
      historicalPoints = 8;
      reasons.push("Precio relativamente cerca del mínimo histórico.");
    }
    score += historicalPoints * this.config.weights.historicalProximity;

    let stabilityPoints = 0;
    if (input.priceChangeCount30d <= 2) {
      stabilityPoints = 10;
      reasons.push("Producto con precio estable.");
    } else if (input.priceChangeCount30d <= 5) {
      stabilityPoints = 5;
    } else if (input.priceChangeCount30d > 12) {
      stabilityPoints = -6;
      reasons.push("Precio volátil en los últimos 30 días.");
    }
    score += stabilityPoints * this.config.weights.stability;

    let agePoints = 0;
    if (input.previousPriceAgeHours !== null) {
      if (input.previousPriceAgeHours >= 14 * 24) {
        agePoints = 10;
        reasons.push("El precio anterior se mantuvo durante más de 14 días.");
      } else if (input.previousPriceAgeHours >= 7 * 24) {
        agePoints = 6;
      } else if (input.previousPriceAgeHours >= 48) {
        agePoints = 3;
      }
    }
    score += agePoints * this.config.weights.priceAge;

    const categoryBonus = this.config.categoryBonuses[input.categorySlug] ?? 0;
    score += categoryBonus * this.config.weights.category;

    const roundedScore = roundMoney(score);
    const qualifiesAsDeal =
      discountPercentage >= this.config.minDiscountPercentForDeal || isHistoricalLow;

    if (!qualifiesAsDeal) {
      return {
        score: roundedScore,
        level: DealLevel.NORMAL,
        reasons: [
          `La bajada (${discountPercentage}%) no supera el umbral mínimo configurable.`,
        ],
        discountPercentage,
        savings,
        distanceToHistoricalLowPercent,
      };
    }

    return {
      score: roundedScore,
      level: mapScoreToLevel(roundedScore, isHistoricalLow, this.config),
      reasons,
      discountPercentage,
      savings,
      distanceToHistoricalLowPercent,
    };
  }
}

export const dealScoringService = new DealScoringService();

export function scoreDeal(
  input: DealScoringInput,
  config?: DealScoringConfig,
): DealScoringResult {
  if (config) {
    return new DealScoringService(config).score(input);
  }
  return dealScoringService.score(input);
}
