import type { PulseThemeId } from "@/lib/pulse-themes";

/**
 * Color Alerta YIR por categoría padre (Telegram / catálogo).
 * Fallback: ámbar.
 */
export const CATEGORY_PULSE_THEME: Record<string, PulseThemeId> = {
  tecnologia: "blue",
  informatica: "cyan",
  videojuegos: "violet",
  oficina: "slate",
  moda: "rose",
  belleza: "magenta",
  bebe: "coral",
  hogar: "amber",
  jardin: "green",
  deportes: "lime",
  automovil: "red",
  juguetes: "orange",
  mascotas: "teal",
  otros: "stone",
};

export function pulseThemeForCategory(
  parentSlug?: string | null,
  categorySlug?: string | null,
): PulseThemeId {
  const parent = parentSlug?.trim().toLowerCase();
  if (parent && CATEGORY_PULSE_THEME[parent]) {
    return CATEGORY_PULSE_THEME[parent]!;
  }
  const child = categorySlug?.trim().toLowerCase();
  if (child && CATEGORY_PULSE_THEME[child]) {
    return CATEGORY_PULSE_THEME[child]!;
  }
  return "amber";
}
