/**
 * Columnas de «Oferta Prime» a partir de una lectura de Amazon: el precio es el
 * de oferta para Prime y `regular_price` el precio sin Prime.
 */
export function primePriceFields(quote: {
  primeOnly?: boolean;
  regularPrice?: number | null;
}): { prime_only: boolean; regular_price: number | null } {
  const primeOnly = Boolean(quote.primeOnly);
  return {
    prime_only: primeOnly,
    regular_price: primeOnly ? (quote.regularPrice ?? null) : null,
  };
}
