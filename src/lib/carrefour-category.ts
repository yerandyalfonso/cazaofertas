import type { SiteCategorySlug } from "@/lib/site-categories";

const FOOD_PATH_RE =
  /supermercado|alimentacion|frescos|bebidas|lacteos|carniceria|pescaderia|panaderia|congelados|despensa|frutas|verduras|charcuteria/i;

const FOOD_TITLE_RE =
  /\b(leche|yogur|queso|jam[oó]n|pan\b|arroz\b|pasta\b|aceite\b|caf[eé]\b|cerveza|vino\b|agua mineral|galletas|chocolate\b|fruta\b|verdura\b|carne\b|pescado\b|huevos?\b)\b/i;

/** URLs de listados Carrefour no alimentación (configurables vía env). */
export const DEFAULT_CARREFOUR_DEAL_FEED_URLS = [
  "https://www.carrefour.es/electronica/ofertas/c",
  "https://www.carrefour.es/moda/ofertas/c",
  "https://www.carrefour.es/bebe/ofertas/c",
  "https://www.carrefour.es/hogar/ofertas/c",
  "https://www.carrefour.es/deporte/ofertas/c",
  "https://www.carrefour.es/juguetes/ofertas/c",
  "https://www.carrefour.es/bricolaje-y-jardin/ofertas/c",
] as const;

export function isCarrefourFoodContext(input: {
  feedUrl?: string | null;
  productUrl?: string | null;
  breadcrumbs?: string[];
  title?: string | null;
}): boolean {
  const haystack = [
    input.feedUrl ?? "",
    input.productUrl ?? "",
    ...(input.breadcrumbs ?? []),
    input.title ?? "",
  ].join(" ");

  if (FOOD_PATH_RE.test(haystack)) return true;
  if (FOOD_TITLE_RE.test(input.title ?? "")) return true;
  return false;
}

export function inferCarrefourCategorySlug(input: {
  breadcrumbs?: string[];
  feedUrl?: string | null;
  productUrl?: string | null;
  title?: string | null;
}): SiteCategorySlug | null {
  const haystack = [
    ...(input.breadcrumbs ?? []),
    input.feedUrl ?? "",
    input.productUrl ?? "",
    input.title ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (/beb[eé]|reci[eé]n nacido|puericultura|pañal/i.test(haystack)) {
    return "bebe";
  }
  if (/moda|ropa|calzado|zapat/i.test(haystack)) return "moda";
  if (/deporte|fitness|outdoor|cicl/i.test(haystack)) return "deportes";
  if (/juguet|lego|niñ/i.test(haystack)) return "juguetes";
  if (/videojuego|consola|gaming|playstation|xbox|nintendo/i.test(haystack)) {
    return "videojuegos";
  }
  if (/inform[aá]tica|port[aá]til|ordenador|pc\b|monitor/i.test(haystack)) {
    return "informatica";
  }
  if (/electr[oó]nica|televis|tv\b|móvil|smartphone|tablet/i.test(haystack)) {
    return "tecnologia";
  }
  if (/belleza|cosm[eé]tica|perfum|higiene/i.test(haystack)) return "belleza";
  if (/mascota|perro|gato/i.test(haystack)) return "mascotas";
  if (/jard[ií]n|bricolaje|exterior|barbacoa/i.test(haystack)) return "jardin";
  if (/coche|moto|autom[oó]vil|neum[aá]tico/i.test(haystack)) {
    return "automovil";
  }
  if (/hogar|cocina|mueble|decoraci[oó]n/i.test(haystack)) return "hogar";

  return null;
}
