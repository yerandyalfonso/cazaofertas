/**
 * Columnas extra de una lectura de Amazon: «Oferta Prime» (el precio es el de
 * oferta para Prime y `regular_price` el precio sin Prime) y `rrp_price`, el
 * «Precio recomendado» cuando el descuento va contra el mínimo de 30 días.
 */
export function amazonPriceFields(quote: {
  primeOnly?: boolean;
  regularPrice?: number | null;
  rrpPrice?: number | null;
}): { prime_only: boolean; regular_price: number | null; rrp_price: number | null } {
  const primeOnly = Boolean(quote.primeOnly);
  return {
    prime_only: primeOnly,
    regular_price: primeOnly ? (quote.regularPrice ?? null) : null,
    rrp_price: quote.rrpPrice ?? null,
  };
}
