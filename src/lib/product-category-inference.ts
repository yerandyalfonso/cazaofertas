import {
  DEFAULT_SUBCATEGORY_BY_PARENT,
  type BlogCategorySlug,
  resolveParentSlug,
  resolveSubcategorySlug,
} from "@/lib/category-taxonomy";
import {
  inferAmazonCategorySlug,
  type AmazonCategoryInferenceInput,
} from "@/lib/amazon-category";

export type { AmazonCategoryInferenceInput };

interface SubcategoryRule {
  slug: string;
  breadcrumbPatterns: RegExp[];
  titleKeywords: string[];
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function scorePatterns(text: string, patterns: RegExp[]): number {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let score = 0;
  for (const pattern of patterns) {
    if (pattern.test(normalized)) score += 6;
  }
  return score;
}

function scoreKeywords(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let score = 0;
  for (const keyword of keywords) {
    if (normalized.includes(keyword)) score += 4;
  }
  return score;
}

/** Reglas finas → subcategoría interna (prioridad sobre el padre). */
const SUBCATEGORY_RULES: SubcategoryRule[] = [
  {
    slug: "bebe-ninos",
    breadcrumbPatterns: [/\bniños?\b/, /\binfantil\b/],
    titleKeywords: ["niño", "nina", "infantil", "colegio"],
  },
  {
    slug: "belleza-perfumes",
    breadcrumbPatterns: [/\bperfumes?\b/, /\bfragancias?\b/],
    titleKeywords: ["perfume", "eau de toilette", "colonia"],
  },
  {
    slug: "belleza-cuidado-personal",
    breadcrumbPatterns: [/\bcuidado\s+personal\b/, /\bafeitad/],
    titleKeywords: ["champu", "gel de ducha", "desodorante", "afeitadora"],
  },
  {
    slug: "belleza-salud",
    breadcrumbPatterns: [/\bsalud\b/, /\bfarmacia\b/, /\bvitaminas?\b/],
    titleKeywords: ["vitamina", "suplemento", "termometro", "tensiometro"],
  },
  {
    slug: "automovil-motos",
    breadcrumbPatterns: [/\bmotos?\b/, /\bcascos?\s+moto\b/],
    titleKeywords: ["moto", "casco moto", "guantes moto"],
  },
  {
    slug: "automovil-seguridad",
    breadcrumbPatterns: [/\bseguridad\b/, /\bsillas?\s+de\s+coche\b/],
    titleKeywords: ["silla coche", "portabebes", "dash cam", "alarma coche"],
  },
  {
    slug: "deportes-camping",
    breadcrumbPatterns: [/\bcamping\b/, /\btiendas?\s+de\s+campa/],
    titleKeywords: ["tienda campaña", "saco dormir", "mochila trekking"],
  },
  {
    slug: "deportes-aire-libre",
    breadcrumbPatterns: [/\baire\s+libre\b/, /\btrekking\b/],
    titleKeywords: ["senderismo", "montaña", "baston trekking"],
  },
  {
    slug: "deportes-movilidad",
    breadcrumbPatterns: [/\bpatinetes?\b/, /\belectricos?\b/],
    titleKeywords: ["patinete", "bicicleta electrica", "hoverboard"],
  },
  {
    slug: "hogar-cocina",
    breadcrumbPatterns: [/\bcocina\b/, /\bmenaje\b/],
    titleKeywords: ["olla", "sarten", "cafetera", "robot cocina", "air fryer"],
  },
  {
    slug: "hogar-electrodomesticos",
    breadcrumbPatterns: [/\belectrodomesticos?\b/, /\bfrigorificos?\b/],
    titleKeywords: ["lavadora", "secadora", "frigorifico", "microondas"],
  },
  {
    slug: "hogar-limpieza",
    breadcrumbPatterns: [/\blimpieza\b/, /\baspirador/],
    titleKeywords: ["aspiradora", "fregona", "detergente", "robot aspirador"],
  },
  {
    slug: "hogar-muebles",
    breadcrumbPatterns: [/\bmuebles?\b/, /\bsofas?\b/],
    titleKeywords: ["sofa", "mesa", "sillon", "armario", "estanteria"],
  },
  {
    slug: "informatica-perifericos",
    breadcrumbPatterns: [/\bperifericos?\b/, /\bcomponentes?\b/],
    titleKeywords: ["monitor", "teclado", "raton", "ssd", "tarjeta grafica"],
  },
  {
    slug: "juguetes-manualidades",
    breadcrumbPatterns: [/\bmanualidades?\b/, /\barte\s+y\s+manualidades\b/],
    titleKeywords: ["pintura", "plastilina", "manualidades", "lego"],
  },
  {
    slug: "moda-calzado",
    breadcrumbPatterns: [/\bzapatos?\b/, /\bcalzado\b/],
    titleKeywords: ["zapatilla", "bota", "sandalia", "zapato"],
  },
  {
    slug: "moda-relojes",
    breadcrumbPatterns: [/\brelojes?\b/],
    titleKeywords: ["reloj", "smartwatch", "watch pro"],
  },
  {
    slug: "moda-joyeria",
    breadcrumbPatterns: [/\bjoyeria\b/, /\bbisuteria\b/],
    titleKeywords: ["collar", "pendientes", "pulsera", "anillo"],
  },
  {
    slug: "moda-equipaje",
    breadcrumbPatterns: [/\bequipaje\b/, /\bmaletas?\b/],
    titleKeywords: ["maleta", "mochila viaje", "trolley"],
  },
  {
    slug: "tecnologia-moviles",
    breadcrumbPatterns: [/\bmoviles?\b/, /\btelefonos?\b/],
    titleKeywords: ["iphone", "samsung galaxy", "smartphone", "movil"],
  },
  {
    slug: "tecnologia-televisores",
    breadcrumbPatterns: [/\btelevisores?\b/, /\btv\b/],
    titleKeywords: ["televisor", "smart tv", "oled", "qled"],
  },
  {
    slug: "tecnologia-audio",
    breadcrumbPatterns: [/\baudio\b/, /\bsonido\b/],
    titleKeywords: ["auriculares", "altavoz", "barra de sonido", "airpods"],
  },
  {
    slug: "tecnologia-fotografia",
    breadcrumbPatterns: [/\bfoto(grafia)?\b/, /\bcamaras?\b/],
    titleKeywords: ["camara", "objetivo", "tripode", "gopro"],
  },
  {
    slug: "tecnologia-accesorios-movil",
    breadcrumbPatterns: [/\baccesorios?\s+(para\s+)?movil/],
    titleKeywords: ["funda iphone", "cargador", "power bank", "cristal templado"],
  },
  {
    slug: "videojuegos-entretenimiento",
    breadcrumbPatterns: [/\bentretenimiento\b/, /\bstreaming\b/],
    titleKeywords: ["netflix", "disney", "tarjeta regalo"],
  },
  {
    slug: "oficina-material-escolar",
    breadcrumbPatterns: [/\bmaterial\s+escolar\b/, /\bestuches?\b/],
    titleKeywords: ["mochila escolar", "cuaderno", "boligrafo", "estuche"],
  },
  {
    slug: "oficina-papelera",
    breadcrumbPatterns: [/\bpapelera\b/, /\bpapeleria\b/],
    titleKeywords: ["papel a4", "impresora tinta", "archivador"],
  },
  {
    slug: "otros-libros",
    breadcrumbPatterns: [/\blibros?\b/, /\be-?books?\b/],
    titleKeywords: ["libro", "kindle", "ebook"],
  },
  {
    slug: "otros-supermercado",
    breadcrumbPatterns: [/\bsupermercado\b/, /\balimentacion\b/],
    titleKeywords: ["cafe", "aceite", "detergente", "pañales"],
  },
  {
    slug: "otros-cupones",
    breadcrumbPatterns: [/\bcupones?\b/, /\bcodigos?\s+descuento\b/],
    titleKeywords: ["cupon", "codigo descuento", "voucher"],
  },
  {
    slug: "otros-viajes",
    breadcrumbPatterns: [/\bviajes?\b/, /\bvuelos?\b/],
    titleKeywords: ["maleta cabina", "hotel", "maleta viaje"],
  },
];

const MIN_SUBCATEGORY_SCORE = 8;

/**
 * Infiere subcategoría interna (bot / Telegram / BD).
 * Si no hay confianza → subcategoría por defecto del padre inferido → otros-general.
 */
export function inferProductSubcategorySlug(
  input: AmazonCategoryInferenceInput,
): string {
  const breadcrumbs = (input.breadcrumbs ?? [])
    .map((crumb) => crumb.trim())
    .filter(Boolean);
  const title = input.title?.trim() ?? "";
  const breadcrumbBlob = breadcrumbs.join(" ");

  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const rule of SUBCATEGORY_RULES) {
    const score =
      scorePatterns(breadcrumbBlob, rule.breadcrumbPatterns) +
      scoreKeywords(title, rule.titleKeywords);
    if (score > bestScore) {
      bestScore = score;
      bestSlug = rule.slug;
    }
  }

  if (bestSlug && bestScore >= MIN_SUBCATEGORY_SCORE) {
    return bestSlug;
  }

  const parent =
    input.feedCategorySlug ??
    inferAmazonCategorySlug(input) ??
    null;

  if (parent && parent in DEFAULT_SUBCATEGORY_BY_PARENT) {
    return DEFAULT_SUBCATEGORY_BY_PARENT[parent as BlogCategorySlug];
  }

  return DEFAULT_SUBCATEGORY_BY_PARENT.otros;
}

/** Slug de blog (padre) a partir de subcategoría o padre legacy. */
export function inferBlogCategorySlug(
  input: AmazonCategoryInferenceInput,
): BlogCategorySlug {
  const sub = inferProductSubcategorySlug(input);
  return resolveParentSlug(sub) ?? "otros";
}

export function normalizeCategorySlugForStorage(
  slug: string | null | undefined,
): string {
  return resolveSubcategorySlug(slug) ?? DEFAULT_SUBCATEGORY_BY_PARENT.otros;
}
