import type { SiteCategorySlug } from "@/lib/site-categories";

export type { SiteCategorySlug };

export interface AmazonCategoryInferenceInput {
  breadcrumbs?: string[];
  title?: string | null;
  brand?: string | null;
}

interface CategoryRule {
  slug: SiteCategorySlug;
  breadcrumbPatterns: RegExp[];
  titleKeywords: string[];
}

function normalizeCategoryText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    slug: "informatica",
    breadcrumbPatterns: [
      /\binformatica\b/,
      /\bordenadores?\b/,
      /\bportatiles?\b/,
      /\bpc\s+de\s+escritorio\b/,
      /\bcomponentes?\b/,
      /\bperifericos?\b/,
      /\bmonitores?\b/,
      /\balmacenamiento\b/,
      /\bimpr(?:esoras?|esion)\b/,
      /\btarjetas?\s+graficas?\b/,
      /\bmemorias?\s+ram\b/,
      /\bplacas?\s+base\b/,
    ],
    titleKeywords: [
      "portatil",
      "laptop",
      "ordenador",
      "monitor",
      "teclado mecanico",
      "raton gaming",
      "raton inalambrico",
      "ssd",
      "disco duro",
      "tarjeta grafica",
      "rtx ",
      "gtx ",
      "placa base",
      "memoria ram",
      "router wifi",
      "impresora",
      "webcam",
      "dock usb",
    ],
  },
  {
    slug: "tecnologia",
    breadcrumbPatterns: [
      /\belectronica\b/,
      /\btelefonos?\b/,
      /\bmoviles?\b/,
      /\btablets?\b/,
      /\baudio\b/,
      /\btelevision\b/,
      /\btv\b/,
      /\bfoto\b/,
      /\bcamaras?\b/,
      /\bsmart\s*home\b/,
      /\bdomotica\b/,
      /\bdispositivos?\s+amazon\b/,
    ],
    titleKeywords: [
      "smartphone",
      "iphone",
      "samsung galaxy",
      "movil ",
      "tablet",
      "ipad",
      "auriculares",
      "airpods",
      "altavoz",
      "echo dot",
      "fire tv",
      "chromecast",
      "smartwatch",
      "reloj inteligente",
      "cargador",
      "power bank",
      "bateria externa",
      "televisor",
      "tv ",
    ],
  },
  {
    slug: "moda",
    breadcrumbPatterns: [
      /\bmoda\b/,
      /\bropa\b/,
      /\bzapatos?\b/,
      /\bcalzado\b/,
      /\brelojes?\b/,
      /\bjoyeria\b/,
      /\bcomplementos?\b/,
      /\bbolsos?\b/,
      /\bropa\s+de\s+hombre\b/,
      /\bropa\s+de\s+mujer\b/,
      /\bropa\s+infantil\b/,
    ],
    titleKeywords: [
      "pantalon",
      "vaquero",
      "vestido",
      "falda",
      "camiseta",
      "camisa",
      "jersey",
      "abrigo",
      "chaqueta",
      "sandalias",
      "chandal",
      "sudadera",
      "bragas",
      "sujetador",
      "medias",
      "calcetines",
    ],
  },
  {
    slug: "videojuegos",
    breadcrumbPatterns: [
      /\bvideojuegos?\b/,
      /\bjuegos?\s+de\s+pc\b/,
      /\bplaystation\b/,
      /\bxbox\b/,
      /\bnintendo\b/,
      /\bconsolas?\b/,
    ],
    titleKeywords: [
      "playstation",
      "ps5",
      "ps4",
      "xbox",
      "nintendo switch",
      "videojuego",
      "mando ps",
      "mando xbox",
      "dualsense",
      "juego ps5",
      "juego switch",
      "steam deck",
    ],
  },
  {
    slug: "bebe",
    breadcrumbPatterns: [
      /\bbebe\b/,
      /\bbebes?\b/,
      /\bpuericultura\b/,
      /\bprimeros?\s+pasos\b/,
      /\bropa\s+de\s+bebe\b/,
    ],
    titleKeywords: [
      "bebe",
      "recien nacido",
      "cochecito",
      "silla de paseo",
      "trona",
      "pañal",
      "panal",
      "biberon",
      "chupete",
      "bañera bebe",
      "monitor bebe",
      "saco de dormir bebe",
    ],
  },
  {
    slug: "mascotas",
    breadcrumbPatterns: [
      /\bmascotas?\b/,
      /\bperros?\b/,
      /\bgatos?\b/,
      /\bproductos?\s+para\s+mascotas\b/,
    ],
    titleKeywords: [
      "perro",
      "gato",
      "pienso",
      "arena gatos",
      "collar perro",
      "correa perro",
      "rascador",
      "comedero mascota",
      "snack perro",
      "snack gato",
    ],
  },
  {
    slug: "jardin",
    breadcrumbPatterns: [
      /\bjardin\b/,
      /\bjardineria\b/,
      /\bbricolaje\b/,
      /\bherramientas?\s+de\s+jardin\b/,
      /\bexterior\b/,
      /\bplantas?\b/,
      /\bbarbacoa\b/,
    ],
    titleKeywords: [
      "jardin",
      "barbacoa",
      "cesped",
      "manguera",
      "maceta",
      "muebles jardin",
      "toldo",
      "sombrilla",
      "cortacesped",
      "podadora",
      "piscina",
    ],
  },
  {
    slug: "automovil",
    breadcrumbPatterns: [
      /\bcoche\b/,
      /\bautomovil\b/,
      /\bmoto\b/,
      /\bvehiculos?\b/,
      /\bneumaticos?\b/,
      /\baccesorios?\s+para\s+coche\b/,
    ],
    titleKeywords: [
      "coche",
      "automovil",
      "moto",
      "neumatico",
      "llanta",
      "portamoviles coche",
      "alfombrilla coche",
      "cargador coche",
      "dash cam",
      "gps coche",
      "aceite motor",
    ],
  },
  {
    slug: "hogar",
    breadcrumbPatterns: [
      /\bhogar\b/,
      /\bcocina\b/,
      /\bmuebles?\b/,
      /\bdecoracion\b/,
      /\btextil\s+hogar\b/,
      /\bropa\s+de\s+cama\b/,
      /\borganizacion\b/,
      /\blimpieza\b/,
      /\belectrodomesticos?\b/,
    ],
    titleKeywords: [
      "sabana",
      "funda nordica",
      "almohada",
      "edredon",
      "toalla",
      "olla",
      "sarten",
      "cuchillo",
      "aspirador",
      "robot aspirador",
      "freidora",
      "cafetera",
      "lampara",
      "cortina",
      "alfombra",
      "organizador",
      "cesta",
    ],
  },
  {
    slug: "belleza",
    breadcrumbPatterns: [
      /\bbelleza\b/,
      /\bcuidado\s+personal\b/,
      /\bcosmetica\b/,
      /\bperfumes?\b/,
      /\bmaquillaje\b/,
      /\bpeluqueria\b/,
      /\bsalud\s+y\s+cuidado\b/,
    ],
    titleKeywords: [
      "crema facial",
      "serum",
      "maquillaje",
      "labial",
      "rimel",
      "perfume",
      "colonia",
      "champu",
      "acondicionador",
      "mascarilla capilar",
      "afeitadora",
      "depiladora",
      "hidratante",
    ],
  },
  {
    slug: "deportes",
    breadcrumbPatterns: [
      /\bdeportes?\b/,
      /\bfitness\b/,
      /\bciclismo\b/,
      /\brunning\b/,
      /\boutdoor\b/,
      /\bcamping\b/,
      /\bequipamiento\s+deportivo\b/,
    ],
    titleKeywords: [
      "bicicleta",
      "bici ",
      "cinta de correr",
      "pesas",
      "mancuernas",
      "yoga",
      "colchoneta",
      "raqueta",
      "pelota",
      "gimnasio",
      "running",
      "senderismo",
      "mochila trekking",
      "zapatillas running",
      "zapatillas deportivas",
      "zapatillas trail",
      "zapatillas de running",
      "zapatillas",
      "sneakers",
    ],
  },
  {
    slug: "juguetes",
    breadcrumbPatterns: [
      /\bjuguetes?\b/,
      /\bjuegos?\s+y\s+juguetes\b/,
      /\bconstruccion\b/,
    ],
    titleKeywords: [
      "juguete",
      "lego",
      "puzzle",
      "peluche",
      "muneca",
      "figura",
      "playmobil",
      "juego de mesa",
      "coche teledirigido",
    ],
  },
];

function scoreBreadcrumbs(
  breadcrumbs: string[],
  patterns: RegExp[],
): number {
  let score = 0;
  breadcrumbs.forEach((crumb, index) => {
    const normalized = normalizeCategoryText(crumb);
    if (!normalized) return;
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        score += 12 + index;
        break;
      }
    }
  });
  return score;
}

function scoreTitle(title: string, keywords: string[]): number {
  const normalized = normalizeCategoryText(title);
  if (!normalized) return 0;

  let score = 0;
  for (const keyword of keywords) {
    if (normalized.includes(keyword)) {
      score += 4;
    }
  }
  return score;
}

/**
 * Infiere la categoría del catálogo a partir de breadcrumbs Amazon y/o título.
 * Prioriza breadcrumbs; el título actúa como respaldo.
 */
export function inferAmazonCategorySlug(
  input: AmazonCategoryInferenceInput,
): SiteCategorySlug | null {
  const breadcrumbs = (input.breadcrumbs ?? [])
    .map((crumb) => crumb.trim())
    .filter(Boolean);
  const title = input.title?.trim() ?? "";

  if (breadcrumbs.length === 0 && !title) return null;

  let bestSlug: SiteCategorySlug | null = null;
  let bestScore = 0;

  for (const rule of CATEGORY_RULES) {
    const score =
      scoreBreadcrumbs(breadcrumbs, rule.breadcrumbPatterns) +
      scoreTitle(title, rule.titleKeywords);

    if (score > bestScore) {
      bestScore = score;
      bestSlug = rule.slug;
    }
  }

  return bestScore > 0 ? bestSlug : null;
}
