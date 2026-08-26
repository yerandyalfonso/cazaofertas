/**
 * Señales de mínimo histórico a partir del precio actual y el mínimo observado.
 * Separado del scoring para poder reutilizarlo en UI y detección.
 */

import { roundMoney } from "@/lib/money";
import { DealLevel } from "@/types";

export interface HistoricalLowInput {
  currentPrice: number;
  lowestPrice: number | null;
  /** Umbral % sobre el mínimo para considerarlo “cerca” (default 1%). */
  nearThresholdPercent?: number;
}

export interface HistoricalLowSignal {
  lowestPrice: number | null;
  distancePercent: number | null;
  isAtHistoricalLow: boolean;
  isNearHistoricalLow: boolean;
  label: string;
}

export function evaluateHistoricalLow(
  input: HistoricalLowInput,
): HistoricalLowSignal {
  const { currentPrice, lowestPrice } = input;
  const threshold = input.nearThresholdPercent ?? 1;

  if (lowestPrice === null || lowestPrice <= 0 || currentPrice <= 0) {
    return {
      lowestPrice,
      distancePercent: null,
      isAtHistoricalLow: false,
      isNearHistoricalLow: false,
      label: "Sin mínimo histórico",
    };
  }

  const distancePercent = roundMoney(
    ((currentPrice - lowestPrice) / lowestPrice) * 100,
  );
  const isAtHistoricalLow = currentPrice <= lowestPrice;
  const isNearHistoricalLow =
    isAtHistoricalLow || distancePercent <= threshold;

  return {
    lowestPrice,
    distancePercent,
    isAtHistoricalLow,
    isNearHistoricalLow,
    label: isAtHistoricalLow
      ? "Mínimo histórico"
      : isNearHistoricalLow
        ? "Cerca del mínimo histórico"
        : "Por encima del mínimo",
  };
}

export function historicalLowToDealLevel(
  signal: HistoricalLowSignal,
): DealLevel | null {
  return signal.isAtHistoricalLow || signal.isNearHistoricalLow
    ? DealLevel.HISTORICAL_LOW
    : null;
}

export const historicalLowService = {
  evaluate: evaluateHistoricalLow,
  toDealLevel: historicalLowToDealLevel,
};
