import { roundMoney } from "@/lib/money";

/** Días que vale un precio anterior observado por nosotros (bajada real). */
export const OBSERVED_REFERENCE_DAYS = 30;

export interface ReferencePrice {
  /** Precio anterior a mostrar, o null si no hay uno justificable. */
  previousPrice: number | null;
  /** Cuándo vimos ese precio (solo si viene de una bajada observada). */
  observedAt: string | null;
}

/**
 * Precio anterior («antes» tachado, % de descuento), solo si se puede
 * justificar:
 * 1) el precio tachado que la tienda muestra en esta revisión;
 * 2) una bajada que vemos ahora (el precio guardado era mayor);
 * 3) una bajada que vimos hace ≤30 días y el precio sigue por debajo.
 * Si no, null: nada de arrastrar referencias antiguas que la tienda ya quitó.
 */
export function resolveReferencePrice(options: {
  nextPrice: number;
  listPrice: number | null;
  storedCurrent: number | null;
  storedPrevious: number | null;
  storedObservedAt: string | null;
  now: Date;
}): ReferencePrice {
  const { nextPrice, listPrice, storedCurrent, storedPrevious, storedObservedAt, now } =
    options;

  if (listPrice !== null && listPrice > nextPrice) {
    return { previousPrice: roundMoney(listPrice), observedAt: null };
  }
  if (storedCurrent !== null && storedCurrent > nextPrice) {
    return { previousPrice: roundMoney(storedCurrent), observedAt: now.toISOString() };
  }
  if (storedPrevious !== null && storedPrevious > nextPrice && storedObservedAt) {
    const ageMs = now.getTime() - new Date(storedObservedAt).getTime();
    if (ageMs >= 0 && ageMs <= OBSERVED_REFERENCE_DAYS * 86_400_000) {
      return { previousPrice: roundMoney(storedPrevious), observedAt: storedObservedAt };
    }
  }
  return { previousPrice: null, observedAt: null };
}

export function discountFrom(previousPrice: number | null, price: number): number {
  if (previousPrice === null || previousPrice <= price) return 0;
  return roundMoney(((previousPrice - price) / previousPrice) * 100);
}
