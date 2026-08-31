/**
 * Taxonomía de productos: 14 categorías de blog (padre) + subcategorías internas
 * (bot, Telegram, scoring, inferencia).
 */

export interface BlogCategoryDefinition {
  name: string;
  slug: string;
  telegramLabel: string;
  description: string;
  image_url: string;
}

export interface SubcategoryDefinition {
  slug: string;
  name: string;
  parentSlug: string;
  /** Tema Telegram; por defecto hereda del padre si no se define. */
  telegramTopicSlug?: string;
}

export const BLOG_CATEGORIES: BlogCategoryDefinition[] = [
  {
    name: "Bebé y puericultura",
    slug: "bebe",
    telegramLabel: "Bebé",
    description: "Pañales, cochecitos, ropa bebé y primeros años.",
    image_url:
      "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Belleza y cuidado personal",
    slug: "belleza",
    telegramLabel: "Belleza",
    description: "Cosmética, perfumería, salud y cuidado personal.",
    image_url:
      "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Coche y moto",
    slug: "automovil",
    telegramLabel: "Coche",
    description: "Accesorios, neumáticos y electrónica para vehículos.",
    image_url:
      "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Deportes y aire libre",
    slug: "deportes",
    telegramLabel: "Deportes",
    description: "Fitness, running, ciclismo y outdoor.",
    image_url:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Hogar y cocina",
    slug: "hogar",
    telegramLabel: "Hogar",
    description: "Cocina, decoración, organización y electrodomésticos.",
    image_url:
      "https://images.unsplash.com/photo-1484101403633-562f891dc89a?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Informática",
    slug: "informatica",
    telegramLabel: "Informática",
    description: "Portátiles, PC, periféricos y componentes.",
    image_url:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Jardín y exterior",
    slug: "jardin",
    telegramLabel: "Jardín",
    description: "Muebles de exterior, barbacoas, plantas y herramientas.",
    image_url:
      "https://images.unsplash.com/photo-1416879595882-3373a0488b5b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Juguetes",
    slug: "juguetes",
    telegramLabel: "Juguetes",
    description: "Juegos, construcción y entretenimiento infantil.",
    image_url:
      "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Mascotas",
    slug: "mascotas",
    telegramLabel: "Mascotas",
    description: "Comida, higiene y accesorios para perros y gatos.",
    image_url:
      "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Moda",
    slug: "moda",
    telegramLabel: "Moda",
    description: "Ropa, calzado y complementos.",
    image_url:
      "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Tecnología",
    slug: "tecnologia",
    telegramLabel: "Electrónica",
    description: "Móviles, TV, audio, foto y gadgets.",
    image_url:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Videojuegos",
    slug: "videojuegos",
    telegramLabel: "Videojuegos",
    description: "Consolas, juegos y entretenimiento.",
    image_url:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Oficina y Papelera",
    slug: "oficina",
    telegramLabel: "Oficina",
    description: "Material escolar, papelería y suministros de oficina.",
    image_url:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Otros",
    slug: "otros",
    telegramLabel: "Otros",
    description:
      "Todo lo que no encaja en las categorías principales: libros, viajes, supermercado, etc.",
    image_url:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80",
  },
];

/** Subcategorías internas (clasificación fina + temas Telegram). */
export const PRODUCT_SUBCATEGORIES: SubcategoryDefinition[] = [
  { slug: "bebe-bebes", name: "Bebés", parentSlug: "bebe" },
  { slug: "bebe-ninos", name: "Niños", parentSlug: "bebe" },
  { slug: "belleza-belleza", name: "Belleza", parentSlug: "belleza" },
  { slug: "belleza-cuidado-personal", name: "Cuidado personal", parentSlug: "belleza" },
  { slug: "belleza-perfumes", name: "Perfumes", parentSlug: "belleza" },
  { slug: "belleza-salud", name: "Salud", parentSlug: "belleza" },
  { slug: "automovil-coches", name: "Coches", parentSlug: "automovil" },
  { slug: "automovil-motos", name: "Motos", parentSlug: "automovil" },
  { slug: "automovil-seguridad", name: "Seguridad", parentSlug: "automovil" },
  { slug: "deportes-deportes", name: "Deportes", parentSlug: "deportes" },
  { slug: "deportes-aire-libre", name: "Aire libre", parentSlug: "deportes" },
  { slug: "deportes-camping", name: "Camping", parentSlug: "deportes" },
  { slug: "deportes-movilidad", name: "Movilidad", parentSlug: "deportes" },
  { slug: "hogar-hogar", name: "Hogar", parentSlug: "hogar" },
  { slug: "hogar-cocina", name: "Cocina", parentSlug: "hogar" },
  { slug: "hogar-bano", name: "Baño", parentSlug: "hogar" },
  { slug: "hogar-climatizacion", name: "Climatización", parentSlug: "hogar" },
  { slug: "hogar-decoracion", name: "Decoración", parentSlug: "hogar" },
  { slug: "hogar-descanso", name: "Descanso", parentSlug: "hogar" },
  { slug: "hogar-electrodomesticos", name: "Electrodomésticos", parentSlug: "hogar" },
  { slug: "hogar-iluminacion", name: "Iluminación", parentSlug: "hogar" },
  { slug: "hogar-limpieza", name: "Limpieza", parentSlug: "hogar" },
  { slug: "hogar-muebles", name: "Muebles", parentSlug: "hogar" },
  { slug: "hogar-bricolaje", name: "Bricolaje", parentSlug: "hogar" },
  { slug: "hogar-herramientas", name: "Herramientas", parentSlug: "hogar" },
  { slug: "hogar-ventilacion", name: "Ventilación", parentSlug: "hogar" },
  { slug: "informatica-informatica", name: "Informática", parentSlug: "informatica" },
  { slug: "informatica-perifericos", name: "Periféricos y componentes", parentSlug: "informatica" },
  { slug: "jardin-jardin", name: "Jardín", parentSlug: "jardin" },
  { slug: "juguetes-juguetes", name: "Juguetes", parentSlug: "juguetes" },
  { slug: "juguetes-manualidades", name: "Manualidades", parentSlug: "juguetes" },
  { slug: "juguetes-modelismo", name: "Modelismo", parentSlug: "juguetes" },
  { slug: "mascotas-mascotas", name: "Mascotas", parentSlug: "mascotas" },
  { slug: "moda-moda", name: "Moda", parentSlug: "moda" },
  { slug: "moda-calzado", name: "Calzado", parentSlug: "moda" },
  { slug: "moda-bolsos-mujer", name: "Bolsos de mujer", parentSlug: "moda" },
  { slug: "moda-complementos", name: "Complementos de ropa", parentSlug: "moda" },
  { slug: "moda-joyeria", name: "Joyería", parentSlug: "moda" },
  { slug: "moda-relojes", name: "Relojes", parentSlug: "moda" },
  { slug: "moda-equipaje", name: "Equipaje", parentSlug: "moda" },
  { slug: "tecnologia-electronica", name: "Electrónica", parentSlug: "tecnologia" },
  { slug: "tecnologia-moviles", name: "Móviles", parentSlug: "tecnologia" },
  { slug: "tecnologia-audio", name: "Audio", parentSlug: "tecnologia" },
  { slug: "tecnologia-hifi", name: "Sonido HI-FI", parentSlug: "tecnologia" },
  { slug: "tecnologia-fotografia", name: "Fotografía", parentSlug: "tecnologia" },
  { slug: "tecnologia-televisores", name: "Televisores", parentSlug: "tecnologia" },
  { slug: "tecnologia-accesorios-movil", name: "Accesorios para móvil", parentSlug: "tecnologia" },
  { slug: "videojuegos-videojuegos", name: "Videojuegos", parentSlug: "videojuegos" },
  { slug: "videojuegos-entretenimiento", name: "Entretenimiento", parentSlug: "videojuegos" },
  { slug: "oficina-material-escolar", name: "Material escolar", parentSlug: "oficina" },
  { slug: "oficina-papelera", name: "Papelera", parentSlug: "oficina" },
  { slug: "oficina-oficina", name: "Oficina", parentSlug: "oficina" },
  { slug: "otros-general", name: "Otros", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-actualidad", name: "Actualidad", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-cupones", name: "Códigos de descuento", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-supermercado", name: "Supermercado", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-libros", name: "Libros", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-musica", name: "Música", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-cine", name: "Cine", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-viajes", name: "Viajes", parentSlug: "otros", telegramTopicSlug: "otros" },
];

export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]["slug"];

const BLOG_BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c] as const));
const SUB_BY_SLUG = new Map(
  PRODUCT_SUBCATEGORIES.map((s) => [s.slug, s] as const),
);

/** Subcategoría por defecto cuando solo conocemos el padre. */
export const DEFAULT_SUBCATEGORY_BY_PARENT: Record<BlogCategorySlug, string> = {
  bebe: "bebe-bebes",
  belleza: "belleza-belleza",
  automovil: "automovil-coches",
  deportes: "deportes-deportes",
  hogar: "hogar-hogar",
  informatica: "informatica-informatica",
  jardin: "jardin-jardin",
  juguetes: "juguetes-juguetes",
  mascotas: "mascotas-mascotas",
  moda: "moda-moda",
  tecnologia: "tecnologia-electronica",
  videojuegos: "videojuegos-videojuegos",
  oficina: "oficina-oficina",
  otros: "otros-general",
};

/** Slugs de padre legacy (antes de subcategorías) → subcategoría por defecto. */
export const LEGACY_PARENT_SLUG_TO_SUBCATEGORY: Record<string, string> = {
  ...DEFAULT_SUBCATEGORY_BY_PARENT,
};

export function isBlogCategorySlug(slug: string | null | undefined): slug is BlogCategorySlug {
  if (!slug?.trim()) return false;
  return BLOG_BY_SLUG.has(slug.trim().toLowerCase() as BlogCategorySlug);
}

export function getBlogCategory(
  slug: string | null | undefined,
): BlogCategoryDefinition | null {
  if (!slug?.trim()) return null;
  return BLOG_BY_SLUG.get(slug.trim().toLowerCase() as BlogCategorySlug) ?? null;
}

export function getSubcategory(
  slug: string | null | undefined,
): SubcategoryDefinition | null {
  if (!slug?.trim()) return null;
  return SUB_BY_SLUG.get(slug.trim().toLowerCase()) ?? null;
}

export function resolveParentSlug(
  slug: string | null | undefined,
): BlogCategorySlug | null {
  if (!slug?.trim()) return null;
  const normalized = slug.trim().toLowerCase();
  if (isBlogCategorySlug(normalized)) return normalized;
  const sub = getSubcategory(normalized);
  if (sub && isBlogCategorySlug(sub.parentSlug)) {
    return sub.parentSlug as BlogCategorySlug;
  }
  return null;
}

export function resolveSubcategorySlug(
  slug: string | null | undefined,
): string | null {
  if (!slug?.trim()) return null;
  const normalized = slug.trim().toLowerCase();
  if (getSubcategory(normalized)) return normalized;
  if (isBlogCategorySlug(normalized)) {
    return DEFAULT_SUBCATEGORY_BY_PARENT[normalized] ?? null;
  }
  return null;
}

export function telegramTopicSlugForCategory(
  subcategorySlug: string | null | undefined,
): string {
  const sub = getSubcategory(subcategorySlug);
  if (sub?.telegramTopicSlug && isBlogCategorySlug(sub.telegramTopicSlug)) {
    return sub.telegramTopicSlug;
  }
  if (sub && isBlogCategorySlug(sub.parentSlug)) {
    if (sub.parentSlug === "otros") return "otros";
    return sub.parentSlug;
  }
  const parent = resolveParentSlug(subcategorySlug);
  if (parent) return parent;
  return "otros";
}

export interface CategoryDisplayMeta {
  subcategorySlug: string;
  subcategoryName: string;
  parentSlug: BlogCategorySlug;
  parentName: string;
}

export function resolveCategoryDisplayMeta(
  slug: string | null | undefined,
): CategoryDisplayMeta | null {
  const subSlug =
    resolveSubcategorySlug(slug) ?? DEFAULT_SUBCATEGORY_BY_PARENT.otros;
  const sub = getSubcategory(subSlug);
  if (!sub) return null;
  const parent = getBlogCategory(sub.parentSlug);
  if (!parent) return null;
  return {
    subcategorySlug: sub.slug,
    subcategoryName: sub.name,
    parentSlug: parent.slug,
    parentName: parent.name,
  };
}
