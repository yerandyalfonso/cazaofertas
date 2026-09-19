/** Escala tipografía y padding del bloque de precio según longitud del texto. */
export function adaptivePriceMetrics(priceText: string, canvasW: number) {
  const compact = priceText.replace(/\s/g, "");
  const len = Math.max(1, compact.length);
  // Ancla en 1080px; escala con el ancho del lienzo.
  const k = canvasW / 1080;
  if (len <= 5) {
    return { main: 104 * k, strike: 52 * k, padX: 40 * k, padY: 22 * k };
  }
  if (len <= 7) {
    return { main: 88 * k, strike: 44 * k, padX: 36 * k, padY: 20 * k };
  }
  if (len <= 9) {
    return { main: 72 * k, strike: 36 * k, padX: 32 * k, padY: 18 * k };
  }
  if (len <= 11) {
    return { main: 58 * k, strike: 30 * k, padX: 28 * k, padY: 16 * k };
  }
  return { main: 46 * k, strike: 26 * k, padX: 24 * k, padY: 14 * k };
}
