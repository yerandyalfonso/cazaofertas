/** Constantes Figma (lienzo 1080) + tipografía adaptativa al largo del precio. */

export const PULSE_CANVAS = 1080;

/** Badge −% (píldora completamente redonda). */
export const PULSE_DISCOUNT_BADGE = {
  width: 168,
  padY: 14,
  padX: 16,
  radius: 9999,
  shadow: "0 6.5px 23.3px 0 rgba(0, 0, 0, 0.25)",
  font: 48,
} as const;

/** Badge precio actual (Figma). */
export const PULSE_PRICE_BADGE = {
  height: 122,
  padTop: 4,
  padRight: 33,
  padBottom: 2,
  padLeft: 54,
  radius: "9999px 0 0 9999px",
  shadow: "0 13px 46.6px 0 rgba(0, 0, 0, 0.25)",
} as const;

/** Badge precio anterior + línea (Figma). */
export const PULSE_STRIKE_BADGE = {
  height: 61,
  padTop: 2,
  padRight: 16.5,
  padBottom: 1,
  padLeft: 27,
  radius: "4999.5px 0 0 4999.5px",
  shadow: "0 6.5px 23.3px 0 rgba(0, 0, 0, 0.25)",
} as const;

/** Escala tipografía del precio según longitud del texto (ancla 1080). */
export function adaptivePriceMetrics(priceText: string, canvasW: number) {
  const compact = priceText.replace(/\s/g, "");
  const len = Math.max(1, compact.length);
  const k = canvasW / PULSE_CANVAS;
  if (len <= 5) {
    return { main: 78 * k, strike: 36 * k };
  }
  if (len <= 7) {
    return { main: 64 * k, strike: 30 * k };
  }
  if (len <= 9) {
    return { main: 52 * k, strike: 26 * k };
  }
  if (len <= 11) {
    return { main: 42 * k, strike: 22 * k };
  }
  return { main: 34 * k, strike: 18 * k };
}

export function pulseScale(canvasW: number): number {
  return canvasW / PULSE_CANVAS;
}
