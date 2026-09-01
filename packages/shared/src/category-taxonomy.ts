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

export const BLOG_CATEGORIES = [
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
  { slug: "general", name: "General", parentSlug: "belleza" },
  { slug: "belleza-cuidado-personal", name: "Cuidado personal", parentSlug: "belleza" },
  { slug: "belleza-perfumes", name: "Perfumes", parentSlug: "belleza" },
  { slug: "belleza-salud", name: "Salud", parentSlug: "belleza" },
  { slug: "automovil-coches", name: "Coches", parentSlug: "automovil" },
  { slug: "automovil-motos", name: "Motos", parentSlug: "automovil" },
  { slug: "automovil-seguridad", name: "Seguridad", parentSlug: "automovil" },
  { slug: "general", name: "General", parentSlug: "deportes" },
  { slug: "deportes-aire-libre", name: "Aire libre", parentSlug: "deportes" },
  { slug: "deportes-camping", name: "Camping", parentSlug: "deportes" },
  { slug: "deportes-movilidad", name: "Movilidad", parentSlug: "deportes" },
  { slug: "general", name: "General", parentSlug: "hogar" },
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
  { slug: "general", name: "General", parentSlug: "informatica" },
  { slug: "informatica-perifericos", name: "Periféricos y componentes", parentSlug: "informatica" },
  { slug: "general", name: "General", parentSlug: "jardin" },
  { slug: "general", name: "General", parentSlug: "juguetes" },
  { slug: "juguetes-manualidades", name: "Manualidades", parentSlug: "juguetes" },
  { slug: "juguetes-modelismo", name: "Modelismo", parentSlug: "juguetes" },
  { slug: "general", name: "General", parentSlug: "mascotas" },
  { slug: "general", name: "General", parentSlug: "moda" },
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
  { slug: "general", name: "General", parentSlug: "videojuegos" },
  { slug: "videojuegos-entretenimiento", name: "Entretenimiento", parentSlug: "videojuegos" },
  { slug: "oficina-material-escolar", name: "Material escolar", parentSlug: "oficina" },
  { slug: "oficina-papelera", name: "Papelera", parentSlug: "oficina" },
  { slug: "general", name: "General", parentSlug: "oficina" },
  { slug: "general", name: "General", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-actualidad", name: "Actualidad", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-cupones", name: "Códigos de descuento", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-supermercado", name: "Supermercado", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-libros", name: "Libros", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-musica", name: "Música", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-cine", name: "Cine", parentSlug: "otros", telegramTopicSlug: "otros" },
  { slug: "otros-viajes", name: "Viajes", parentSlug: "otros", telegramTopicSlug: "otros" },
] as const;

export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]["slug"];

/** Segmento URL de la subcategoría catch-all en cada padre. */
export const GENERAL_CHILD_SLUG = "general";

const BLOG_BY_SLUG = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c] as const));

/** Clave interna padre-hijo (inferencia, legacy). No es el slug en BD. */
export function composeSubcategorySlug(
  parentSlug: string,
  childSlug: string,
): string {
  return `${parentSlug.trim().toLowerCase()}-${childSlug.trim().toLowerCase()}`;
}

export function subcategoryLookupKey(sub: SubcategoryDefinition): string {
  if (sub.slug === GENERAL_CHILD_SLUG) {
    return composeSubcategorySlug(sub.parentSlug, GENERAL_CHILD_SLUG);
  }
  return sub.slug;
}

const SUB_BY_LOOKUP = new Map(
  PRODUCT_SUBCATEGORIES.map((sub) => [subcategoryLookupKey(sub), sub] as const),
);

const LEGACY_MIRROR_SUBCATEGORY_SLUGS_MAP = {
  "belleza-belleza": composeSubcategorySlug("belleza", GENERAL_CHILD_SLUG),
  "deportes-deportes": composeSubcategorySlug("deportes", GENERAL_CHILD_SLUG),
  "hogar-hogar": composeSubcategorySlug("hogar", GENERAL_CHILD_SLUG),
  "informatica-informatica": composeSubcategorySlug(
    "informatica",
    GENERAL_CHILD_SLUG,
  ),
  "jardin-jardin": composeSubcategorySlug("jardin", GENERAL_CHILD_SLUG),
  "juguetes-juguetes": composeSubcategorySlug("juguetes", GENERAL_CHILD_SLUG),
  "mascotas-mascotas": composeSubcategorySlug("mascotas", GENERAL_CHILD_SLUG),
  "moda-moda": composeSubcategorySlug("moda", GENERAL_CHILD_SLUG),
  "videojuegos-videojuegos": composeSubcategorySlug(
    "videojuegos",
    GENERAL_CHILD_SLUG,
  ),
  "oficina-oficina": composeSubcategorySlug("oficina", GENERAL_CHILD_SLUG),
  "otros-general": composeSubcategorySlug("otros", GENERAL_CHILD_SLUG),
} as const;

export type LegacyMirrorSubcategorySlug =
  keyof typeof LEGACY_MIRROR_SUBCATEGORY_SLUGS_MAP;

/** Slugs legacy (espejo padre-padre o compuesto) → clave de lookup. */
export const LEGACY_MIRROR_SUBCATEGORY_SLUGS: Record<
  LegacyMirrorSubcategorySlug,
  string
> = LEGACY_MIRROR_SUBCATEGORY_SLUGS_MAP;

function lookupLegacyMirrorSlug(slug: string): string | undefined {
  if (!(slug in LEGACY_MIRROR_SUBCATEGORY_SLUGS_MAP)) return undefined;
  return LEGACY_MIRROR_SUBCATEGORY_SLUGS_MAP[
    slug as LegacyMirrorSubcategorySlug
  ];
}

export interface ParsedSubcategorySlug {
  parentSlug: BlogCategorySlug;
  childSlug: string;
  lookupKey: string;
}

export function parseSubcategorySlug(
  slug: string | null | undefined,
  parentSlug?: string | null,
): ParsedSubcategorySlug | null {
  if (!slug?.trim()) return null;

  const normalized: string = slug.trim().toLowerCase();
  const explicitParent = parentSlug?.trim().toLowerCase() || null;

  if (explicitParent && isBlogCategorySlug(explicitParent)) {
    const legacyKey = lookupLegacyMirrorSlug(normalized);
    if (legacyKey) {
      const sub = SUB_BY_LOOKUP.get(legacyKey);
      if (sub) {
        return {
          parentSlug: explicitParent as BlogCategorySlug,
          childSlug: GENERAL_CHILD_SLUG,
          lookupKey: legacyKey,
        };
      }
    }

    if (normalized === GENERAL_CHILD_SLUG) {
      const lookupKey = composeSubcategorySlug(explicitParent, GENERAL_CHILD_SLUG);
      const sub = SUB_BY_LOOKUP.get(lookupKey);
      if (sub) {
        return {
          parentSlug: explicitParent as BlogCategorySlug,
          childSlug: GENERAL_CHILD_SLUG,
          lookupKey,
        };
      }
    }

    const composite = composeSubcategorySlug(explicitParent, normalized);
    const compositeSub = SUB_BY_LOOKUP.get(composite);
    if (compositeSub) {
      const child =
        compositeSub.slug === GENERAL_CHILD_SLUG
          ? GENERAL_CHILD_SLUG
          : normalized;
      return {
        parentSlug: explicitParent as BlogCategorySlug,
        childSlug: child,
        lookupKey: subcategoryLookupKey(compositeSub),
      };
    }
  }

  const legacy = lookupLegacyMirrorSlug(normalized);
  const lookupCandidate = legacy ?? normalized;
  const sub = SUB_BY_LOOKUP.get(lookupCandidate);
  if (sub) {
    const child =
      sub.slug === GENERAL_CHILD_SLUG
        ? GENERAL_CHILD_SLUG
        : lookupCandidate.slice(sub.parentSlug.length + 1);
    return {
      parentSlug: sub.parentSlug as BlogCategorySlug,
      childSlug: child || GENERAL_CHILD_SLUG,
      lookupKey: subcategoryLookupKey(sub),
    };
  }

  return parseCompositeSubcategoryTail(normalized as string);
}

function parseCompositeSubcategoryTail(
  normalized: string,
): ParsedSubcategorySlug | null {
  if (isBlogCategorySlug(normalized)) return null;

  for (const category of BLOG_CATEGORIES) {
    const prefix = `${category.slug}-`;
    if (!normalized.startsWith(prefix)) continue;
    const child = normalized.slice(prefix.length);
    return {
      parentSlug: category.slug,
      childSlug: child || GENERAL_CHILD_SLUG,
      lookupKey: composeSubcategorySlug(
        category.slug,
        child || GENERAL_CHILD_SLUG,
      ),
    };
  }

  return null;
}

export function isGeneralSubcategorySlug(
  slug: string | null | undefined,
  parentSlug?: string | null,
): boolean {
  const parsed = parseSubcategorySlug(slug, parentSlug);
  return parsed?.childSlug === GENERAL_CHILD_SLUG;
}

export function normalizeSubcategorySlug(
  slug: string | null | undefined,
  parentSlug?: string | null,
): string | null {
  const parsed = parseSubcategorySlug(slug, parentSlug);
  return parsed?.lookupKey ?? null;
}

/** Subcategoría por defecto cuando solo conocemos el padre (clave de lookup). */
export const DEFAULT_SUBCATEGORY_BY_PARENT: Record<BlogCategorySlug, string> = {
  bebe: "bebe-bebes",
  belleza: composeSubcategorySlug("belleza", GENERAL_CHILD_SLUG),
  automovil: "automovil-coches",
  deportes: composeSubcategorySlug("deportes", GENERAL_CHILD_SLUG),
  hogar: composeSubcategorySlug("hogar", GENERAL_CHILD_SLUG),
  informatica: composeSubcategorySlug("informatica", GENERAL_CHILD_SLUG),
  jardin: composeSubcategorySlug("jardin", GENERAL_CHILD_SLUG),
  juguetes: composeSubcategorySlug("juguetes", GENERAL_CHILD_SLUG),
  mascotas: composeSubcategorySlug("mascotas", GENERAL_CHILD_SLUG),
  moda: composeSubcategorySlug("moda", GENERAL_CHILD_SLUG),
  tecnologia: "tecnologia-electronica",
  videojuegos: composeSubcategorySlug("videojuegos", GENERAL_CHILD_SLUG),
  oficina: composeSubcategorySlug("oficina", GENERAL_CHILD_SLUG),
  otros: composeSubcategorySlug("otros", GENERAL_CHILD_SLUG),
};

/** Slugs de padre legacy (antes de subcategorías) → subcategoría por defecto. */
export const LEGACY_PARENT_SLUG_TO_SUBCATEGORY: Record<string, string> = {
  ...DEFAULT_SUBCATEGORY_BY_PARENT,
};

export function isBlogCategorySlug(slug: string | null | undefined): boolean {
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
  parentSlug?: string | null,
): SubcategoryDefinition | null {
  const parsed = parseSubcategorySlug(slug, parentSlug);
  if (!parsed) return null;
  return SUB_BY_LOOKUP.get(parsed.lookupKey) ?? null;
}

export function getSubcategoryByPath(
  parentSlug: string,
  childSlug: string,
): SubcategoryDefinition | null {
  const parent = parentSlug.trim().toLowerCase();
  const child = childSlug.trim().toLowerCase();
  if (!isBlogCategorySlug(parent)) return null;

  const legacyKey = lookupLegacyMirrorSlug(`${parent}-${child}`);
  if (legacyKey) return SUB_BY_LOOKUP.get(legacyKey) ?? null;

  const lookupKey = composeSubcategorySlug(parent, child);
  const direct = SUB_BY_LOOKUP.get(lookupKey);
  if (direct) return direct;

  return (
    PRODUCT_SUBCATEGORIES.find(
      (sub) => sub.parentSlug === parent && sub.slug === child,
    ) ?? null
  );
}

export function resolveParentSlug(
  slug: string | null | undefined,
  parentSlug?: string | null,
): BlogCategorySlug | null {
  if (!slug?.trim()) return null;
  const normalized = slug.trim().toLowerCase();
  if (isBlogCategorySlug(normalized)) return normalized as BlogCategorySlug;
  const parsed = parseSubcategorySlug(normalized, parentSlug);
  return parsed?.parentSlug ?? null;
}

export function resolveSubcategorySlug(
  slug: string | null | undefined,
  parentSlug?: string | null,
): string | null {
  if (!slug?.trim()) return null;
  const normalized = slug.trim().toLowerCase();
  const parsed = parseSubcategorySlug(normalized, parentSlug);
  if (parsed) return parsed.lookupKey;
  if (isBlogCategorySlug(normalized)) {
    return DEFAULT_SUBCATEGORY_BY_PARENT[normalized as BlogCategorySlug] ?? null;
  }
  return null;
}

export function telegramTopicSlugForCategory(
  subcategorySlug: string | null | undefined,
  parentSlug?: string | null,
): string {
  const sub = getSubcategory(subcategorySlug, parentSlug);
  if (sub?.telegramTopicSlug && isBlogCategorySlug(sub.telegramTopicSlug)) {
    return sub.telegramTopicSlug;
  }
  if (sub && isBlogCategorySlug(sub.parentSlug)) {
    if (sub.parentSlug === "otros") return "otros";
    return sub.parentSlug;
  }
  const parent = resolveParentSlug(subcategorySlug, parentSlug);
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
  parentSlug?: string | null,
): CategoryDisplayMeta | null {
  const lookupKey =
    resolveSubcategorySlug(slug, parentSlug) ??
    DEFAULT_SUBCATEGORY_BY_PARENT.otros;
  const sub = getSubcategory(lookupKey);
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

/** Segmento hijo en URL: hogar-cocina → cocina, general → general. */
export function childSlugFromSubcategory(
  subcategorySlug: string | null | undefined,
  parentSlug?: string | null,
): string | null {
  const parsed = parseSubcategorySlug(subcategorySlug, parentSlug);
  return parsed?.childSlug ?? null;
}

/** Ruta pública padre/hijo: /categorias/hogar/cocina */
export function categoryPublicPath(
  parentSlug: string,
  subcategorySlug?: string | null,
): string {
  const parent = parentSlug.trim().toLowerCase();
  if (!subcategorySlug?.trim()) {
    return `/categorias/${parent}`;
  }
  const child =
    childSlugFromSubcategory(subcategorySlug, parent) ??
    subcategorySlug.trim().toLowerCase();
  if (!child) return `/categorias/${parent}`;
  return `/categorias/${parent}/${child}`;
}

/** Resuelve subcategoría desde segmentos de URL (/hogar/general). */
export function resolveSubcategoryFromPath(
  parentSlug: string,
  childSlug: string,
): string | null {
  const sub = getSubcategoryByPath(parentSlug, childSlug);
  if (!sub) return null;
  return subcategoryLookupKey(sub);
}

export function productMatchesSubcategory(
  category:
    | {
        slug: string;
        parentSlug?: string | null;
        childSlug?: string | null;
      }
    | null
    | undefined,
  parentSlug: string,
  sub: SubcategoryDefinition,
): boolean {
  if (!category) return false;
  const parent = parentSlug.trim().toLowerCase();
  if (category.parentSlug?.trim().toLowerCase() !== parent) return false;

  const expectedChild = sub.slug;
  const child =
    category.childSlug?.trim().toLowerCase() ??
    category.slug.trim().toLowerCase();
  if (child === expectedChild) return true;

  return category.slug.trim().toLowerCase() === subcategoryLookupKey(sub);
}
