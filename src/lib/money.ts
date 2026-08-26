export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function requireNumber(value: number | string | null | undefined): number {
  const parsed = toNumber(value);
  if (parsed === null) {
    throw new Error("Expected a numeric value");
  }
  return parsed;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateDiscountPercentage(
  previousPrice: number,
  currentPrice: number,
): number {
  if (previousPrice <= 0) {
    return 0;
  }

  return roundMoney(((previousPrice - currentPrice) / previousPrice) * 100);
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}
