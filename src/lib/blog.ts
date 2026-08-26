import { EXTRA_HTML_BLOG_POSTS } from "@/lib/blog-extra-posts";
import { BLOG_IMAGES } from "@/lib/blog-images";
import type { BlogTemplate } from "@/lib/blog-templates";

export type BlogBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "product"; slug: string }
  | { type: "productGrid"; slugs: string[] }
  | { type: "blockquote"; text: string; cite?: string }
  | { type: "divider" }
  | {
      type: "prosCons";
      pros: string[];
      cons: string[];
      title?: string;
    };

export interface BlogPost {
  /** UUID de Supabase cuando el artículo viene de la BD. */
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readingTime: string;
  publishedAt: string;
  featured?: boolean;
  coverImage: string;
  coverAlt: string;
  /** Bloques estructurados (artículos legacy / embebidos). */
  body: BlogBlock[];
  /** Contenido HTML editorial (prioritario si existe). */
  html?: string;
  /** Productos a enlazar en article_products (además de bloques product*). */
  relatedProductSlugs?: string[];
  /** Plantilla visual (si no se indica, se infiere). */
  template?: BlogTemplate;
  /** Fecha de revisión editorial (ISO date). */
  reviewedAt?: string;
  pros?: string[];
  cons?: string[];
  pullQuote?: string;
}

/** Artículos base + 8 piezas HTML adicionales. */
const CORE_BLOG_POSTS: BlogPost[] = [
  {
    slug: "comparativa-auriculares-anc",
    title: "Comparativa rápida: auriculares ANC por menos de 100 €",
    excerpt:
      "Cancelación de ruido sin pagar el precio de lanzamiento. Tres opciones con bajada real y ficha de compra integrada.",
    category: "Comparativas",
    readingTime: "8 min",
    publishedAt: "2026-08-12",
    featured: true,
    coverImage: BLOG_IMAGES.headphones,
    coverAlt: "Auriculares inalámbricos sobre mesa",
    relatedProductSlugs: [
      "auriculares-anc-wireless",
      "altavoz-inteligente-compacto",
      "monitor-27-qhd-165hz",
    ],
    body: [
      {
        type: "paragraph",
        text: "La cancelación activa de ruido ya no es territorio exclusivo de gamas premium. En Amazon España aparecen bajadas claras por debajo de 100 €, pero conviene mirar autonomía, sellado y si el descuento se acerca al mínimo histórico.",
      },
      {
        type: "blockquote",
        text: "Priorizamos bajada real, proximidad al mínimo histórico y estabilidad — no el cartel de descuento.",
      },
      { type: "divider" },
      {
        type: "heading",
        level: 2,
        text: "Qué miramos antes de recomendar",
      },
      {
        type: "paragraph",
        text: "Priorizamos tres señales: porcentaje de bajada respecto al precio reciente, distancia al mínimo histórico y estabilidad del precio en las últimas semanas. Si un modelo solo cae un día y vuelve a subir, no entra en esta comparativa.",
      },
      {
        type: "image",
        src: BLOG_IMAGES.headphonesDetail,
        alt: "Detalle de auriculares y cable",
        caption: "El confort y el sellado pesan tanto como el marketing de ANC.",
      },
      {
        type: "heading",
        level: 2,
        text: "Nuestra recomendación principal",
      },
      {
        type: "paragraph",
        text: "Si buscas equilibrio entre precio y cancelación, este modelo concentra la mejor puntuación de deal score en la franja sub-100 €. Abajo tienes la ficha con precio actual, tachado y enlace de afiliado.",
      },
      { type: "product", slug: "auriculares-anc-wireless" },
      {
        type: "heading",
        level: 3,
        text: "Alternativas si quieres más pantalla o más portabilidad",
      },
      {
        type: "paragraph",
        text: "Para uso en casa, un altavoz compacto puede complementar los auriculares. Y si trabajas con vídeo o periféricos, el monitor QHD sigue siendo una de las bajadas más limpias del catálogo.",
      },
      {
        type: "productGrid",
        slugs: ["altavoz-inteligente-compacto", "monitor-27-qhd-165hz"],
      },
      {
        type: "heading",
        level: 2,
        text: "Consejo rápido de compra",
      },
      {
        type: "paragraph",
        text: "Activa una alerta por palabra clave (ANC, SoundPeak, auriculares) en el bot de Telegram. Así solo te avisamos si el precio vuelve a bajar o se acerca al mínimo histórico.",
      },
    ],
  },
  {
    slug: "como-detectar-un-chollo-real",
    title: "Cómo detectar un chollo real (y no caer en descuentos fantasma)",
    excerpt:
      "No toda bajada es una oferta. Te explicamos qué miramos: mínimo histórico, estabilidad y porcentaje útil.",
    category: "Guías",
    readingTime: "6 min",
    publishedAt: "2026-08-20",
    featured: true,
    coverImage: BLOG_IMAGES.laptopDeals,
    coverAlt: "Persona revisando precios en un portátil",
    relatedProductSlugs: ["ssd-nvme-1tb-pcie4", "monitor-27-qhd-165hz"],
    body: [
      {
        type: "paragraph",
        text: "Amazon cambia precios a diario. Un cartel de −30 % puede esconder un precio inflado la semana anterior. En CazaOferta no publicamos cualquier caída: puntuamos la oferta antes de empujarla a la web o a Telegram.",
      },
      {
        type: "heading",
        level: 2,
        text: "Los tres filtros del deal score",
      },
      {
        type: "heading",
        level: 3,
        text: "1. Descuento real",
      },
      {
        type: "paragraph",
        text: "Comparamos el precio actual con el precio almacenado recientemente. La fórmula es simple: (precio anterior − actual) / anterior. Si la bajada es mínima, el score no pasa el umbral de buena oferta.",
      },
      {
        type: "heading",
        level: 3,
        text: "2. Distancia al mínimo histórico",
      },
      {
        type: "paragraph",
        text: "Una bajada del 20 % sobre un máximo artificial no es un chollo. Si el precio actual está cerca del mínimo histórico, el sistema lo marca como GREAT_DEAL o HISTORICAL_LOW.",
      },
      {
        type: "image",
        src: BLOG_IMAGES.analytics,
        alt: "Gráfica y análisis de datos",
        caption: "El histórico importa más que el porcentaje del cartel.",
      },
      {
        type: "heading",
        level: 3,
        text: "3. Estabilidad",
      },
      {
        type: "paragraph",
        text: "Productos que suben y bajan cada dos días generan ruido. Preferimos precios que se han mantenido y luego caen de verdad.",
      },
      {
        type: "heading",
        level: 2,
        text: "Ejemplo aplicado: almacenamiento e informática",
      },
      {
        type: "paragraph",
        text: "Componentes como un SSD suelen tener curvas de precio claras. Cuando el descuento coincide con proximidad al mínimo, la ficha se vuelve accionable.",
      },
      {
        type: "productGrid",
        slugs: ["ssd-nvme-1tb-pcie4", "monitor-27-qhd-165hz"],
      },
      {
        type: "paragraph",
        text: "Si ves una de estas tarjetas en verde o ámbar (buena / gran oferta), es porque el scoring ha cruzado umbral. El botón lleva al enlace de afiliado centralizado: nunca construimos URLs de Amazon a mano en la UI.",
      },
    ],
  },
  {
    slug: "mejores-categorias-para-alertas",
    title: "Las mejores categorías para configurar alertas en Telegram",
    excerpt:
      "Tecnología, informática y hogar concentran las caídas más claras. Así priorizamos filtros.",
    category: "Telegram",
    readingTime: "4 min",
    publishedAt: "2026-08-18",
    featured: false,
    coverImage: BLOG_IMAGES.phoneAlerts,
    coverAlt: "Móvil con notificaciones",
    relatedProductSlugs: [
      "freidora-aire-5-5l",
      "reloj-deportivo-gps",
      "esterilla-yoga-antideslizante",
    ],
    body: [
      {
        type: "paragraph",
        text: "Una alerta demasiado amplia satura. Una demasiado estrecha no dispara nunca. Esta guía resume qué categorías suelen devolver mejor señal en Amazon España y cómo combinarlas con palabras clave.",
      },
      {
        type: "heading",
        level: 2,
        text: "Categorías con más movimiento útil",
      },
      {
        type: "paragraph",
        text: "Tecnología e informática lideran el volumen de bajadas verificables. Hogar sigue de cerca con freidoras, aspiradores y pequeños electrodomésticos. Moda y belleza tienen más ruido estacional.",
      },
      {
        type: "image",
        src: BLOG_IMAGES.homeInterior,
        alt: "Interior de hogar moderno",
        caption: "Hogar: buenos chollos si filtras por descuento mínimo.",
      },
      {
        type: "heading",
        level: 2,
        text: "Ejemplos para activar ya",
      },
      {
        type: "paragraph",
        text: "Si te interesa cocina o deporte, empieza con estas fichas y crea una alerta con la marca o una keyword corta (freidora, GPS, yoga).",
      },
      {
        type: "productGrid",
        slugs: [
          "freidora-aire-5-5l",
          "reloj-deportivo-gps",
          "esterilla-yoga-antideslizante",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Cómo configurar el bot",
      },
      {
        type: "paragraph",
        text: "En Telegram: /start → Crear alerta → escribe la keyword. Luego revisa Mis alertas para eliminar las que ya no te interesan. El sistema evita reenviar la misma oferta al mismo precio.",
      },
    ],
  },
];

/** Fallback editorial cuando Supabase no tiene articles publicados. */
export const BLOG_POSTS: BlogPost[] = [
  ...CORE_BLOG_POSTS,
  ...(EXTRA_HTML_BLOG_POSTS as BlogPost[]),
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function getFeaturedBlogPosts(): BlogPost[] {
  const featured = BLOG_POSTS.filter((post) => post.featured);
  return featured.length > 0 ? featured : BLOG_POSTS.slice(0, 2);
}

export function collectProductSlugs(post: BlogPost): string[] {
  const slugs: string[] = [...(post.relatedProductSlugs ?? [])];
  for (const block of post.body) {
    if (block.type === "product") {
      slugs.push(block.slug);
    }
    if (block.type === "productGrid") {
      slugs.push(...block.slugs);
    }
  }
  return [...new Set(slugs)];
}
