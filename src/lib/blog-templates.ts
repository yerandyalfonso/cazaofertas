import type { BlogPost } from "@/lib/blog";

/** Plantillas visuales del artículo. */
export type BlogTemplate =
  | "deep-guide"
  | "quick-compare"
  | "product-analysis"
  | "flash-deal";

/** Distribución de cabecera / lectura. */
export type BlogLayout = "classic" | "split-hero" | "asymmetric";

export interface BlogPresentation {
  template: BlogTemplate;
  layout: BlogLayout;
  templateLabel: string;
  reviewedAt: string;
  pros: string[];
  cons: string[];
  pullQuote?: string;
}

const TEMPLATE_LABELS: Record<BlogTemplate, string> = {
  "deep-guide": "Guía de compra",
  "quick-compare": "Comparativa rápida",
  "product-analysis": "Review / Análisis",
  "flash-deal": "Chollo Flash",
};

const TEMPLATE_LAYOUT: Record<BlogTemplate, BlogLayout> = {
  "deep-guide": "classic",
  "quick-compare": "split-hero",
  "product-analysis": "asymmetric",
  "flash-deal": "split-hero",
};

/** Overrides por slug (pros/contras, cita, plantilla). */
const PRESENTATION_BY_SLUG: Record<
  string,
  Partial<BlogPresentation> & { template?: BlogTemplate }
> = {
  "comparativa-auriculares-anc": {
    template: "quick-compare",
    pullQuote:
      "No pagues el precio de lanzamiento: el score importa más que el cartel.",
    pros: [
      "Cancelación usable por debajo de 100 €",
      "Autonomía competitiva en uso diario",
      "Fichas de compra embebidas con precio real",
    ],
    cons: [
      "El ANC no iguala a gamas premium",
      "Los precios pueden rebotar en 48 h",
      "Hay que verificar talla/sellado al recibir",
    ],
  },
  "como-detectar-un-chollo-real": {
    template: "deep-guide",
    pullQuote: "Un −30 % sobre un máximo artificial no es un chollo.",
    pros: [
      "Método replicable con tres filtros",
      "Encaja con alertas de Telegram",
      "Reduce compras por impulso",
    ],
    cons: [
      "Requiere mirar histórico, no solo el %",
      "Algunas categorías tienen más ruido",
      "No sustituye comprobar stock en Amazon",
    ],
  },
  "mejores-categorias-para-alertas": {
    template: "deep-guide",
    pros: [
      "Prioriza categorías con señal clara",
      "Keywords cortas y accionables",
      "Evita saturación de notificaciones",
    ],
    cons: [
      "Moda y belleza son más volátiles",
      "Alertas demasiado amplias generan ruido",
      "Hay que revisar Mis alertas con frecuencia",
    ],
  },
  "guia-ssd-nvme-upgrade-portatil": {
    template: "deep-guide",
    pullQuote: "El upgrade de almacenamiento suele ser el de mejor retorno.",
    pros: [
      "Checklist clara antes de comprar",
      "Enfoque en PCIe y capacidad real",
      "Enlace a ofertas verificadas",
    ],
    cons: [
      "Compatibilidad depende de tu portátil",
      "Instalación no siempre es plug-and-play",
      "Los precios de NAND oscilan rápido",
    ],
  },
  "altavoces-inteligentes-sin-ruido": {
    template: "product-analysis",
    pros: [
      "Formato compacto para cocina o despacho",
      "Buen complemento a auriculares ANC",
      "Fácil de alertar por keyword",
    ],
    cons: [
      "Privacidad del micrófono a valorar",
      "Sonido limitado frente a barras HiFi",
      "Ofertas “fantasma” frecuentes en la categoría",
    ],
  },
  "freidora-aire-guia-compra-hogar": {
    template: "product-analysis",
    pullQuote: "Los litros importan más que el reclamo de “profesional”.",
    pros: [
      "Guía práctica de capacidad 5,5 L",
      "Criterios de limpieza y programas",
      "Señal de compra ligada al mínimo histórico",
    ],
    cons: [
      "Ocupa encimera",
      "Curva de aprendizaje el primer mes",
      "No sustituye al horno en todos los usos",
    ],
  },
  "pequenos-electrodomesticos-chollos-cocina": {
    template: "deep-guide",
    pros: [
      "Tres filtros anti-impulso",
      "Enfoque en uso semanal real",
      "Combina hogar y gadgets con sentido",
    ],
    cons: [
      "Mucho ruido estacional en la categoría",
      "Fácil acumular aparatos de un solo uso",
      "Requiere disciplina con el carrito",
    ],
  },
  "zapatillas-running-asfalto-guia": {
    template: "product-analysis",
    pros: [
      "Criterios de amortiguación y drop",
      "Enlace a calzado + GPS",
      "Énfasis en talla y devolución",
    ],
    cons: [
      "La horma es personal: prueba importa",
      "Precios premium muy volátiles",
      "Un mal ajuste anula cualquier descuento",
    ],
  },
  "reloj-gps-y-esterilla-rutina": {
    template: "quick-compare",
    pros: [
      "Rutina híbrida casa / exterior",
      "Dos productos con uso complementario",
      "Alertas separadas por keyword",
    ],
    cons: [
      "No sustituye un plan de entrenamiento",
      "El GPS no aporta si no sales a correr",
      "Hay que priorizar si solo hay un chollo",
    ],
  },
  "secador-ionico-belleza-compra": {
    template: "product-analysis",
    pros: [
      "Separa vatios de ergonomía",
      "Enfoque en uso diario y peso",
      "Señal clara de compra por mínimo",
    ],
    cons: [
      "Marketing “profesional” engañoso",
      "Más potencia ≠ mejor resultado",
      "Categoría con descuentos ruidosos",
    ],
  },
  "moda-zapatillas-oferta-sin-impulse": {
    template: "quick-compare",
    pullQuote: "Aparca el carrito 24 horas: la mayoría de impulsos no sobreviven.",
    pros: [
      "Método corto anti-impulso",
      "Prioriza score frente al % del cartel",
      "Recuerda talla y política de devolución",
    ],
    cons: [
      "Moda es muy volátil",
      "Stock por talla irregular",
      "Fácil confundir fin de temporada con chollo",
    ],
  },
};

function inferTemplate(post: BlogPost): BlogTemplate {
  if (post.template) return post.template;
  const category = post.category.toLowerCase();
  if (
    category.includes("oferta") ||
    category.includes("flash") ||
    category.includes("chollo")
  ) {
    return "flash-deal";
  }
  if (category.includes("comparativ")) return "quick-compare";
  if (
    category.includes("guía") ||
    category.includes("guia") ||
    category.includes("telegram")
  ) {
    return "deep-guide";
  }
  if (
    category.includes("análisis") ||
    category.includes("analisis") ||
    category.includes("review") ||
    category.includes("tecnolog") ||
    category.includes("hogar") ||
    category.includes("belleza") ||
    category.includes("deporte") ||
    category.includes("moda")
  ) {
    return "product-analysis";
  }
  return "deep-guide";
}

export function resolveBlogPresentation(post: BlogPost): BlogPresentation {
  const override = PRESENTATION_BY_SLUG[post.slug] ?? {};
  const template = override.template ?? inferTemplate(post);
  const layout = override.layout ?? TEMPLATE_LAYOUT[template];

  return {
    template,
    layout,
    templateLabel: TEMPLATE_LABELS[template],
    reviewedAt: override.reviewedAt ?? post.reviewedAt ?? post.publishedAt,
    pros: override.pros ?? post.pros ?? [],
    cons: override.cons ?? post.cons ?? [],
    pullQuote: override.pullQuote ?? post.pullQuote,
  };
}

export function telegramHintForCategory(category: string): string {
  const map: Record<string, string> = {
    Tecnología: "tecnología",
    Hogar: "hogar",
    Deportes: "deportes",
    Belleza: "belleza",
    Modas: "moda",
    Comparativas: "ofertas",
    Guías: "chollos",
    Telegram: "alertas",
    Informática: "informática",
  };
  return map[category] ?? category.toLowerCase();
}
