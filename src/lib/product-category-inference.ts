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
import { mergeSubcategoryRules } from "@/lib/subcategory-inference-merge";
import { SUBCATEGORY_RULE_EXTENSIONS } from "@/lib/subcategory-inference-extensions";
import type { SubcategoryRule } from "@/lib/subcategory-inference-types";

export type { AmazonCategoryInferenceInput };

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/** Keywords: frases = includes; tokens cortos = límites de palabra. */
function scoreKeywords(text: string, keywords: string[]): number {
  const normalized = normalizeText(text);
  if (!normalized) return 0;
  let score = 0;
  for (const keyword of keywords) {
    const needle = normalizeText(keyword);
    if (!needle) continue;
    if (needle.includes(" ") || needle.length >= 8) {
      if (normalized.includes(needle)) score += 5;
      continue;
    }
    const re = new RegExp(
      `(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:[^a-z0-9]|$)`,
    );
    if (re.test(normalized)) score += 5;
  }
  return score;
}

/**
 * Reglas finas → subcategoría interna (prioridad sobre el padre / feed).
 *
 * Cada regla:
 * - `slug`: subcategoría destino (debe existir en PRODUCT_SUBCATEGORIES, ej. hogar-cocina)
 * - `breadcrumbPatterns`: regex sobre migas de Amazon (+6 por coincidencia)
 * - `titleKeywords`: palabras/frases en título o migas (+5 por coincidencia)
 *
 * Gana la regla con mayor puntuación si alcanza MIN_SUBCATEGORY_SCORE (5).
 * Si ninguna regla gana, se infiere el padre y se usa la subcategoría por defecto.
 */
const SUBCATEGORY_RULES: SubcategoryRule[] = [
  {
    slug: "tecnologia-moviles",
    breadcrumbPatterns: [
      /\bmoviles?\b/,
      /\btelefonos?\b/,
      /\bsmartphones?\b/,
    ],
    titleKeywords: [
      "iphone",
      "smartphone",
      "google pixel",
      "pixel 10",
      "pixel 9",
      "pixel 8",
      "pixel 7",
      "samsung galaxy",
      "galaxy a",
      "galaxy s",
      "galaxy z",
      "xiaomi",
      "redmi",
      "poco ",
      "motorola",
      "oneplus",
      "nothing phone",
      "realme",
      "honor ",
      "oppo ",
      "movil ",
      "telefono movil",
    ],
  },
  {
    slug: "tecnologia-televisores",
    breadcrumbPatterns: [/\btelevisores?\b/, /\btv\b/],
    titleKeywords: ["televisor", "smart tv", "oled", "qled", "fire tv stick"],
  },
  {
    slug: "tecnologia-audio",
    breadcrumbPatterns: [/\baudio\b/, /\bsonido\b/],
    titleKeywords: [
      "auriculares",
      "altavoz",
      "barra de sonido",
      "airpods",
      "soundbar",
      "earbuds",
    ],
  },
  {
    slug: "tecnologia-fotografia",
    breadcrumbPatterns: [/\bfoto(grafia)?\b/, /\bcamaras?\b/],
    titleKeywords: ["camara", "objetivo", "tripode", "gopro", "mirrorless"],
  },
  {
    slug: "tecnologia-accesorios-movil",
    breadcrumbPatterns: [/\baccesorios?\s+(para\s+)?movil/],
    titleKeywords: [
      "funda iphone",
      "cargador",
      "power bank",
      "cristal templado",
      "protector pantalla",
    ],
  },
  {
    slug: "tecnologia-electronica",
    breadcrumbPatterns: [/\btablets?\b/, /\belectronica\b/],
    titleKeywords: [
      "tablet",
      "tableta",
      "ipad",
      "android 1",
      "android 15",
      "android 14",
      "kindle paperwhite",
      "ebook reader",
      "lector de libros",
    ],
  },
  {
    slug: "informatica-perifericos",
    breadcrumbPatterns: [/\bperifericos?\b/, /\bcomponentes?\b/],
    titleKeywords: [
      "monitor",
      "teclado",
      "raton",
      "ssd",
      "tarjeta grafica",
      "webcam",
      "dock usb",
    ],
  },
  {
    slug: "informatica-general",
    breadcrumbPatterns: [/\bportatiles?\b/, /\bordenadores?\b/],
    titleKeywords: ["portatil", "laptop", "notebook", "chromebook", "macbook"],
  },
  {
    slug: "oficina-papelera",
    breadcrumbPatterns: [
      /\bimpr(?:esoras?|esion)\b/,
      /\bpapeleria\b/,
      /\bpapelera\b/,
    ],
    titleKeywords: [
      "impresora",
      "ecotank",
      "laserjet",
      "pixma",
      "toner",
      "cartucho tinta",
      "botellas de tinta",
      "multifuncion",
      "escaneado",
      "epson",
      "brother",
      "hp officejet",
      "canon pixma",
    ],
  },
  {
    slug: "oficina-material-escolar",
    breadcrumbPatterns: [/\bmaterial\s+escolar\b/, /\bestuches?\b/],
    titleKeywords: ["mochila escolar", "cuaderno", "boligrafo", "estuche"],
  },
  {
    slug: "bebe-ninos",
    breadcrumbPatterns: [/\bniños?\b/, /\binfantil\b/],
    titleKeywords: ["niño", "nina", "infantil", "colegio"],
  },
  {
    slug: "bebe-bebes",
    breadcrumbPatterns: [/\bbebe\b/, /\bpuericultura\b/],
    titleKeywords: [
      "cochecito",
      "silla de paseo",
      "biberon",
      "chupete",
      "pañales",
      "panales",
    ],
  },
  {
    slug: "belleza-perfumes",
    breadcrumbPatterns: [/\bperfumes?\b/, /\bfragancias?\b/],
    titleKeywords: ["perfume", "eau de toilette", "colonia", "eau de parfum"],
  },
  {
    slug: "belleza-cuidado-personal",
    breadcrumbPatterns: [/\bcuidado\s+personal\b/, /\bafeitad/],
    titleKeywords: ["champu", "gel de ducha", "desodorante", "afeitadora"],
  },
  {
    slug: "belleza-salud",
    breadcrumbPatterns: [
      /\bsalud\b/,
      /\bfarmacia\b/,
      /\bvitaminas?\b/,
      /\bsuplementos?\b/,
      /\bnutricion\s+deportiva\b/,
    ],
    titleKeywords: [
      "vitamina",
      "suplemento",
      "termometro",
      "tensiometro",
      "proteina",
      "whey",
      "whey isolate",
      "isolate cfm",
      "cfm",
      "creatina",
      "bcaa",
      "aminoacidos",
      "preentreno",
      "pre-entreno",
      "ganador de peso",
      "mass gainer",
      "colageno",
      "omega 3",
      "magnesio",
      "multivitamin",
      "proteina aislada",
      "suero de leche",
    ],
  },
  {
    slug: "belleza-general",
    breadcrumbPatterns: [/\bcosmetica\b/, /\bmaquillaje\b/, /\bcuidado\s+de\s+la\s+piel\b/],
    titleKeywords: [
      "crema facial",
      "serum facial",
      "suero facial",
      "maquillaje",
      "labial",
      "rimel",
      "protector solar",
      "contorno de ojos",
      "acido hialuronico",
    ],
  },
  {
    slug: "deportes-general",
    breadcrumbPatterns: [/\bfitness\b/, /\bgimnasio\b/, /\bmusculacion\b/],
    titleKeywords: [
      "pesas",
      "mancuernas",
      "banco musculacion",
      "cinta de correr",
      "bicicleta estatica",
      "bandas elasticas",
      "guantes gym",
    ],
  },
  {
    slug: "automovil-motos",
    breadcrumbPatterns: [/\bmotos?\b/, /\bcascos?\s+moto\b/],
    titleKeywords: ["casco moto", "guantes moto", "chaqueta moto"],
  },
  {
    slug: "jardin-general",
    breadcrumbPatterns: [/\bjardin\b/, /\bjardineria\b/],
    titleKeywords: [
      "barbacoa",
      "cortacesped",
      "maceta",
      "manguera",
      "muebles jardin",
      "toldo",
      "piscina desmontable",
    ],
  },
  {
    slug: "mascotas-general",
    breadcrumbPatterns: [/\bmascotas?\b/, /\bperros?\b/, /\bgatos?\b/],
    titleKeywords: [
      "pienso",
      "arena gatos",
      "collar perro",
      "correa perro",
      "rascador",
      "comedero",
      "snack perro",
      "snack gato",
      "transporte mascota",
    ],
  },
  {
    slug: "automovil-coches",
    breadcrumbPatterns: [/\bcoche\b/, /\bautomovil\b/, /\bneumaticos?\b/],
    titleKeywords: [
      "neumatico",
      "llanta",
      "aceite motor",
      "limpiaparabrisas",
      "alfombrilla coche",
      "cargador coche",
      "compresor coche",
    ],
  },
  {
    slug: "hogar-climatizacion",
    breadcrumbPatterns: [/\bclimatizacion\b/, /\bcalefaccion\b/],
    titleKeywords: [
      "aire acondicionado",
      "ventilador",
      "calefactor",
      "radiador",
      "deshumidificador",
      "humidificador",
      "purificador de aire",
    ],
  },
  {
    slug: "hogar-descanso",
    breadcrumbPatterns: [/\bdescanso\b/, /\bcolchones?\b/],
    titleKeywords: [
      "colchon",
      "almohada",
      "edredon",
      "funda nordica",
      "sabana",
      "topper",
    ],
  },
  {
    slug: "hogar-iluminacion",
    breadcrumbPatterns: [/\biluminacion\b/, /\blamparas?\b/],
    titleKeywords: ["lampara", "bombilla led", "tira led", "flexo"],
  },
  {
    slug: "hogar-bricolaje",
    breadcrumbPatterns: [/\bbricolaje\b/, /\bherramientas?\b/],
    titleKeywords: [
      "taladro",
      "destornillador",
      "sierra",
      "caja herramientas",
      "atornillador",
    ],
  },
  {
    slug: "juguetes-general",
    breadcrumbPatterns: [/\bjuguetes?\b/],
    titleKeywords: [
      "juguete",
      "peluche",
      "muneca",
      "playmobil",
      "puzzle",
      "coche teledirigido",
      "figura de accion",
    ],
  },
  {
    slug: "videojuegos-general",
    breadcrumbPatterns: [/\bconsolas?\b/, /\bplaystation\b/, /\bxbox\b/],
    titleKeywords: [
      "playstation",
      "ps5",
      "xbox",
      "nintendo switch",
      "dualsense",
      "mando xbox",
      "steam deck",
      "juego ps5",
    ],
  },
  {
    slug: "otros-supermercado",
    breadcrumbPatterns: [/\bsupermercado\b/, /\balimentacion\b/],
    titleKeywords: [
      "cafe molido",
      "aceite oliva",
      "pasta alimentaria",
      "arroz",
      "galletas",
      "chocolate tableta",
      "infusion",
      "te verde",
    ],
  },
  {
    slug: "otros-musica",
    breadcrumbPatterns: [/\bmusica\b/, /\bvinilos?\b/],
    titleKeywords: ["vinilo", "cd musica", "tocadiscos"],
  },
  {
    slug: "otros-cine",
    breadcrumbPatterns: [/\bcine\b/, /\bpeliculas?\b/],
    titleKeywords: ["blu-ray", "pelicula 4k", "dvd pelicula"],
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
    titleKeywords: [
      "olla",
      "sarten",
      "cafetera",
      "robot cocina",
      "air fryer",
      "paños de cocina",
      "panos de cocina",
      "trapo cocina",
    ],
  },
  {
    slug: "hogar-electrodomesticos",
    breadcrumbPatterns: [/\belectrodomesticos?\b/, /\bfrigorificos?\b/],
    titleKeywords: ["lavadora", "secadora", "frigorifico", "microondas"],
  },
  {
    slug: "hogar-limpieza",
    breadcrumbPatterns: [/\blimpieza\b/, /\baspirador/],
    titleKeywords: [
      "aspiradora",
      "fregona",
      "detergente",
      "robot aspirador",
      "papel higienico",
      "papel toilet",
      "scottex",
      "kleenex",
      "bayeta",
      "lejia",
      "limpiacristales",
    ],
  },
  {
    slug: "hogar-bano",
    breadcrumbPatterns: [/\bbaño\b/, /\bbano\b/],
    titleKeywords: ["toalla bano", "alfombrilla bano", "dispensador jabon"],
  },
  {
    slug: "hogar-muebles",
    breadcrumbPatterns: [/\bmuebles?\b/, /\bsofas?\b/],
    titleKeywords: ["sofa", "mesa", "sillon", "armario", "estanteria"],
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
    slug: "moda-bolsos-mujer",
    breadcrumbPatterns: [/\bbolsos?\b/, /\bbandoleras?\b/],
    titleKeywords: [
      "bandolera",
      "bolso",
      "bolsos",
      "tote bag",
      "rinonera",
      "mochila mujer",
      "cartera mujer",
    ],
  },
  {
    slug: "moda-equipaje",
    breadcrumbPatterns: [/\bequipaje\b/, /\bmaletas?\b/],
    titleKeywords: ["maleta", "mochila viaje", "trolley"],
  },
  {
    slug: "moda-complementos",
    breadcrumbPatterns: [/\bcomplementos?\b/, /\bcinturones?\b/],
    titleKeywords: ["cinturon", "bufanda", "gorra", "guantes"],
  },
  {
    slug: "videojuegos-entretenimiento",
    breadcrumbPatterns: [/\bentretenimiento\b/, /\bstreaming\b/],
    titleKeywords: ["netflix", "disney", "tarjeta regalo"],
  },
  {
    slug: "videojuegos-general",
    breadcrumbPatterns: [/\bconsolas?\b/, /\bplaystation\b/, /\bxbox\b/],
    titleKeywords: [
      "playstation",
      "ps5",
      "xbox",
      "nintendo switch",
      "dualsense",
    ],
  },
  {
    slug: "otros-libros",
    breadcrumbPatterns: [/\blibros?\b/, /\be-?books?\b/],
    titleKeywords: ["libro", "kindle", "ebook"],
  },
  {
    slug: "otros-supermercado",
    breadcrumbPatterns: [/\bsupermercado\b/, /\balimentacion\b/],
    titleKeywords: ["cafe molido", "aceite oliva", "pañales", "panales"],
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

const ALL_SUBCATEGORY_RULES = mergeSubcategoryRules(
  SUBCATEGORY_RULES,
  SUBCATEGORY_RULE_EXTENSIONS,
);

const MIN_SUBCATEGORY_SCORE = 5;

/**
 * Infiere subcategoría interna (bot / Telegram / BD).
 *
 * Orden:
 * 1) Reglas finas por título/breadcrumbs
 * 2) Padre inferido del título/breadcrumbs (nunca del feed)
 * 3) Feed Amazon solo como último respaldo (los depts flash mezclan chollos)
 * 4) otros-general
 */
export function inferProductSubcategorySlug(
  input: AmazonCategoryInferenceInput,
): string {
  const breadcrumbs = (input.breadcrumbs ?? [])
    .map((crumb) => crumb.trim())
    .filter(Boolean);
  const title = input.title?.trim() ?? "";
  const brand = input.brand?.trim() ?? "";
  const breadcrumbBlob = breadcrumbs.join(" ");
  const titleBlob = [brand, title].filter(Boolean).join(" ");

  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const rule of ALL_SUBCATEGORY_RULES) {
    const score =
      scorePatterns(breadcrumbBlob, rule.breadcrumbPatterns) +
      scoreKeywords(titleBlob, rule.titleKeywords) +
      scoreKeywords(breadcrumbBlob, rule.titleKeywords);
    if (score > bestScore) {
      bestScore = score;
      bestSlug = rule.slug;
    }
  }

  if (bestSlug && bestScore >= MIN_SUBCATEGORY_SCORE) {
    return bestSlug;
  }

  // Título/breadcrumbs mandan; el departamento del feed es solo pista débil.
  const inferredParent = inferAmazonCategorySlug({
    breadcrumbs,
    title,
    brand,
    feedCategorySlug: null,
  });

  const parent =
    inferredParent ??
    (input.feedCategorySlug
      ? resolveParentSlug(input.feedCategorySlug) ?? input.feedCategorySlug
      : null);

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
