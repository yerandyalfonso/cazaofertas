import { ProductAvailability } from "@/types";
import type { Database } from "@/types/database";

export const DEFAULT_OUT_OF_STOCK_DEACTIVATE_DAYS = 14;

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

/** Días agotado antes de marcar is_active = false (env OUT_OF_STOCK_DEACTIVATE_DAYS). */
export function outOfStockDeactivateDays(): number {
  const raw = process.env.OUT_OF_STOCK_DEACTIVATE_DAYS?.trim();
  if (!raw) return DEFAULT_OUT_OF_STOCK_DEACTIVATE_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_OUT_OF_STOCK_DEACTIVATE_DAYS;
  }
  return Math.floor(parsed);
}

export function shouldDeactivateOutOfStock(
  outOfStockAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!outOfStockAt) return false;
  const thresholdMs = outOfStockDeactivateDays() * 24 * 60 * 60 * 1000;
  return now.getTime() - new Date(outOfStockAt).getTime() >= thresholdMs;
}

interface OutOfStockProductState {
  availability?: string | null;
  out_of_stock_at?: string | null;
  is_active?: boolean;
}

/**
 * Parche al marcar agotado: fija out_of_stock_at la primera vez y desactiva tras N días.
 */
export function buildOutOfStockUpdate(
  product: OutOfStockProductState,
  nowIso: string,
  extra: ProductUpdate = {},
): ProductUpdate {
  const outOfStockAt = product.out_of_stock_at ?? nowIso;

  const patch: ProductUpdate = {
    availability: ProductAvailability.OUT_OF_STOCK,
    last_checked_at: nowIso,
    updated_at: nowIso,
    out_of_stock_at: outOfStockAt,
    ...extra,
  };

  if (shouldDeactivateOutOfStock(outOfStockAt, new Date(nowIso))) {
    patch.is_active = false;
  }

  return patch;
}

/** Limpia el contador cuando vuelve a haber precio/stock. */
export function inStockAvailabilityPatch(
  availability: ProductAvailability,
): ProductUpdate {
  if (availability === ProductAvailability.IN_STOCK) {
    return { out_of_stock_at: null };
  }
  return {};
}

export function availabilityLabel(availability?: string | null): string {
  switch (availability) {
    case ProductAvailability.OUT_OF_STOCK:
      return "Agotado";
    case ProductAvailability.PREORDER:
      return "Preventa";
    case ProductAvailability.UNKNOWN:
      return "Desconocido";
    case ProductAvailability.IN_STOCK:
      return "En stock";
    default:
      return availability ?? "—";
  }
}
