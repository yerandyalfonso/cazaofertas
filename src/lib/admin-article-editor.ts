import type { BlogBlock, BlogHeadingLevel } from "@/lib/blog";
import type { BlogTemplate } from "@/lib/blog-templates";

/** Documento editorial guardado en articles.content (jsonb). */
export interface ArticleDocument {
  version: 1;
  template: BlogTemplate;
  blocks: BlogBlock[];
  pullQuote?: string;
  pros?: string[];
  cons?: string[];
}

export interface ArticleTemplateOption {
  id: BlogTemplate;
  label: string;
  description: string;
  defaultCategory: string;
  seedBlocks: () => BlogBlock[];
  seedPullQuote?: string;
  seedPros?: string[];
  seedCons?: string[];
}

export const ARTICLE_TEMPLATE_OPTIONS: ArticleTemplateOption[] = [
  {
    id: "flash-deal",
    label: "Chollo Flash",
    description:
      "Oferta urgente: gancho, por qué es chollo, ficha de compra y aviso de stock.",
    defaultCategory: "Ofertas",
    seedPullQuote: "Si el score es alto y el precio toca mínimo, actúa rápido.",
    seedBlocks: () => [
      {
        type: "heading",
        level: 2,
        text: "Por qué es un chollo ahora",
      },
      {
        type: "paragraph",
        text: "Describe la bajada real frente al precio reciente, no solo el cartel de descuento de Amazon.",
      },
      {
        type: "heading",
        level: 2,
        text: "Qué mirar antes de comprar",
      },
      {
        type: "paragraph",
        text: "Stock, vendedor, envío Prime y si el precio se acerca al mínimo histórico.",
      },
      {
        type: "blockquote",
        text: "Las ofertas flash pueden agotarse en minutos: verifica disponibilidad al entrar.",
      },
      {
        type: "heading",
        level: 3,
        text: "Resumen rápido",
      },
      {
        type: "paragraph",
        text: "Una frase clara con el beneficio principal y el rango de precio recomendado.",
      },
    ],
  },
  {
    id: "product-analysis",
    label: "Review / Análisis",
    description:
      "Análisis de producto con pros, contras y veredicto de compra.",
    defaultCategory: "Análisis",
    seedPros: [
      "Punto fuerte 1",
      "Punto fuerte 2",
      "Buen momento de precio",
    ],
    seedCons: [
      "Limitación 1",
      "Limitación 2",
      "Alternativa a valorar",
    ],
    seedPullQuote: "Compra por señal de precio, no por el reclamo de marketing.",
    seedBlocks: () => [
      {
        type: "heading",
        level: 2,
        text: "Primera impresión",
      },
      {
        type: "paragraph",
        text: "Contexto del producto y a quién va dirigido.",
      },
      {
        type: "heading",
        level: 2,
        text: "Rendimiento en el día a día",
      },
      {
        type: "paragraph",
        text: "Detalla uso real, autonomía, calidad o capacidad según la categoría.",
      },
      {
        type: "prosCons",
        title: "Pros y contras",
        pros: [
          "Punto fuerte 1",
          "Punto fuerte 2",
          "Buen momento de precio",
        ],
        cons: [
          "Limitación 1",
          "Limitación 2",
          "Alternativa a valorar",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Veredicto",
      },
      {
        type: "paragraph",
        text: "¿Merece la pena a este precio? Condiciones claras para comprar o esperar.",
      },
    ],
  },
  {
    id: "deep-guide",
    label: "Guía de Compra",
    description:
      "Guía estructurada con criterios, errores habituales y recomendación final.",
    defaultCategory: "Guías",
    seedPullQuote: "Define el uso real antes de mirar el cartel de descuento.",
    seedBlocks: () => [
      {
        type: "heading",
        level: 2,
        text: "Para quién es esta guía",
      },
      {
        type: "paragraph",
        text: "Perfil de comprador y problema que resolvemos.",
      },
      {
        type: "heading",
        level: 2,
        text: "Criterios que importan",
      },
      {
        type: "list",
        style: "number",
        items: [
          "Factor decisivo 1 (ej. capacidad)",
          "Factor decisivo 2 (ej. compatibilidad)",
          "Factor decisivo 3 (ej. autonomía)",
        ],
      },
      {
        type: "heading",
        level: 3,
        text: "Detalle por criterio",
      },
      {
        type: "paragraph",
        text: "Amplía cada punto si hace falta; usa H4 para subapartados cortos.",
      },
      {
        type: "heading",
        level: 4,
        text: "Ejemplo de subapartado",
      },
      {
        type: "paragraph",
        text: "Una frase concreta sobre ese criterio.",
      },
      {
        type: "heading",
        level: 2,
        text: "Errores frecuentes",
      },
      {
        type: "list",
        style: "bullet",
        items: [
          "Comprar solo por el % del cartel",
          "Ignorar vendedor / envío",
          "No contrastar con el mínimo histórico",
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Preguntas frecuentes",
      },
      {
        type: "faq",
        title: "Preguntas frecuentes",
        items: [
          {
            question: "¿Cuál es el error más común al comprar?",
            answer:
              "Fijarse solo en el porcentaje del cartel sin contrastar con el precio de las últimas semanas.",
          },
          {
            question: "¿Merece la pena esperar a una rebaja mayor?",
            answer:
              "Si el precio ya está cerca del mínimo histórico y el producto encaja con tu uso, suele ser buen momento.",
          },
        ],
      },
      {
        type: "heading",
        level: 2,
        text: "Recomendación final",
      },
      {
        type: "paragraph",
        text: "Cierra con una recomendación accionable y el rango de precio objetivo.",
      },
    ],
  },
  {
    id: "quick-compare",
    label: "Comparativa rápida",
    description:
      "Tabla mental de opciones: tres candidatos y cuándo elegir cada uno.",
    defaultCategory: "Comparativas",
    seedBlocks: () => [
      {
        type: "heading",
        level: 2,
        text: "Cómo comparamos",
      },
      {
        type: "paragraph",
        text: "Precio, bajada real y uso previsto — no el marketing de la ficha.",
      },
      {
        type: "heading",
        level: 2,
        text: "Opción A",
      },
      {
        type: "paragraph",
        text: "Perfil, ventajas y precio objetivo.",
      },
      {
        type: "heading",
        level: 2,
        text: "Opción B",
      },
      {
        type: "paragraph",
        text: "Perfil, ventajas y precio objetivo.",
      },
      {
        type: "heading",
        level: 2,
        text: "Opción C",
      },
      {
        type: "paragraph",
        text: "Perfil, ventajas y precio objetivo.",
      },
      {
        type: "heading",
        level: 2,
        text: "Cuál elegir",
      },
      {
        type: "paragraph",
        text: "Resumen: para quién cada opción y cuándo esperar.",
      },
    ],
  },
];

export type EditorBlockKind =
  | "heading"
  | "paragraph"
  | "listBullet"
  | "listNumber"
  | "blockquote"
  | "divider"
  | "image"
  | "prosCons"
  | "faq"
  | "product"
  | "productGrid";

export interface EditorBlockBase {
  id: string;
}

export type EditorBlock =
  | (EditorBlockBase & {
      type: "heading";
      level: BlogHeadingLevel;
      text: string;
    })
  | (EditorBlockBase & { type: "paragraph"; text: string })
  | (EditorBlockBase & {
      type: "list";
      style: "bullet" | "number";
      items: string[];
    })
  | (EditorBlockBase & { type: "blockquote"; text: string; cite?: string })
  | (EditorBlockBase & { type: "divider" })
  | (EditorBlockBase & {
      type: "image";
      src: string;
      alt: string;
      caption?: string;
    })
  | (EditorBlockBase & {
      type: "prosCons";
      title?: string;
      pros: string[];
      cons: string[];
    })
  | (EditorBlockBase & {
      type: "faq";
      title?: string;
      items: Array<{ question: string; answer: string }>;
    })
  | (EditorBlockBase & { type: "product"; slug: string })
  | (EditorBlockBase & { type: "productGrid"; slugs: string[] });

let blockSeq = 0;
export function newBlockId(): string {
  blockSeq += 1;
  return `b-${Date.now()}-${blockSeq}`;
}

export function blogBlocksToEditor(blocks: BlogBlock[]): EditorBlock[] {
  return blocks.map((block) => {
    const id = newBlockId();
    switch (block.type) {
      case "heading":
        return { id, type: "heading", level: block.level, text: block.text };
      case "paragraph":
        return { id, type: "paragraph", text: block.text };
      case "list":
        return {
          id,
          type: "list",
          style: block.style,
          items: [...block.items],
        };
      case "blockquote":
        return {
          id,
          type: "blockquote",
          text: block.text,
          cite: block.cite,
        };
      case "divider":
        return { id, type: "divider" };
      case "image":
        return {
          id,
          type: "image",
          src: block.src,
          alt: block.alt,
          caption: block.caption,
        };
      case "prosCons":
        return {
          id,
          type: "prosCons",
          title: block.title,
          pros: [...block.pros],
          cons: [...block.cons],
        };
      case "faq":
        return {
          id,
          type: "faq",
          title: block.title,
          items: block.items.map((item) => ({
            question: item.question,
            answer: item.answer,
          })),
        };
      case "product":
        return { id, type: "product", slug: block.slug };
      case "productGrid":
        return { id, type: "productGrid", slugs: [...block.slugs] };
      default:
        return { id, type: "paragraph", text: "" };
    }
  });
}

export function editorBlocksToBlog(blocks: EditorBlock[]): BlogBlock[] {
  const result: BlogBlock[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        if (block.text.trim()) {
          result.push({
            type: "heading",
            level: block.level,
            text: block.text.trim(),
          });
        }
        break;
      case "paragraph":
        if (block.text.trim()) {
          result.push({ type: "paragraph", text: block.text.trim() });
        }
        break;
      case "list": {
        const items = block.items.map((item) => item.trim()).filter(Boolean);
        if (items.length > 0) {
          result.push({ type: "list", style: block.style, items });
        }
        break;
      }
      case "blockquote":
        if (block.text.trim()) {
          result.push({
            type: "blockquote",
            text: block.text.trim(),
            cite: block.cite?.trim() || undefined,
          });
        }
        break;
      case "divider":
        result.push({ type: "divider" });
        break;
      case "image":
        if (block.src.trim()) {
          result.push({
            type: "image",
            src: block.src.trim(),
            alt: block.alt.trim() || "Imagen del artículo",
            caption: block.caption?.trim() || undefined,
          });
        }
        break;
      case "prosCons": {
        const pros = block.pros.map((p) => p.trim()).filter(Boolean);
        const cons = block.cons.map((c) => c.trim()).filter(Boolean);
        if (pros.length > 0 || cons.length > 0) {
          result.push({
            type: "prosCons",
            title: block.title?.trim() || "Pros y contras",
            pros,
            cons,
          });
        }
        break;
      }
      case "faq": {
        const items = block.items
          .map((item) => ({
            question: item.question.trim(),
            answer: item.answer.trim(),
          }))
          .filter((item) => item.question && item.answer);
        if (items.length > 0) {
          result.push({
            type: "faq",
            title: block.title?.trim() || "Preguntas frecuentes",
            items,
          });
        }
        break;
      }
      case "product":
        if (block.slug.trim()) {
          result.push({ type: "product", slug: block.slug.trim() });
        }
        break;
      case "productGrid": {
        const slugs = block.slugs.map((s) => s.trim()).filter(Boolean);
        if (slugs.length > 0) {
          result.push({ type: "productGrid", slugs });
        }
        break;
      }
    }
  }
  return result;
}

export function createSeedEditorBlocks(template: BlogTemplate): EditorBlock[] {
  const option =
    ARTICLE_TEMPLATE_OPTIONS.find((item) => item.id === template) ??
    ARTICLE_TEMPLATE_OPTIONS[0]!;
  return blogBlocksToEditor(option.seedBlocks());
}

export function emptyEditorBlock(kind: EditorBlockKind): EditorBlock {
  const id = newBlockId();
  switch (kind) {
    case "heading":
      return { id, type: "heading", level: 2, text: "" };
    case "paragraph":
      return { id, type: "paragraph", text: "" };
    case "listBullet":
      return { id, type: "list", style: "bullet", items: [""] };
    case "listNumber":
      return { id, type: "list", style: "number", items: [""] };
    case "blockquote":
      return { id, type: "blockquote", text: "" };
    case "divider":
      return { id, type: "divider" };
    case "image":
      return { id, type: "image", src: "", alt: "" };
    case "prosCons":
      return { id, type: "prosCons", title: "Pros y contras", pros: [""], cons: [""] };
    case "faq":
      return {
        id,
        type: "faq",
        title: "Preguntas frecuentes",
        items: [{ question: "", answer: "" }],
      };
    case "product":
      return { id, type: "product", slug: "" };
    case "productGrid":
      return { id, type: "productGrid", slugs: [""] };
  }
}

/** Arranque limpio: un párrafo vacío para redactar a mano. */
export function createBlankEditorBlocks(): EditorBlock[] {
  return [emptyEditorBlock("paragraph")];
}

/** Resumen estático de la estructura recomendada (solo consulta). */
export function getTemplateStyleOutline(template: BlogTemplate): {
  label: string;
  category: string;
  pullQuoteExample?: string;
  sections: Array<{ kind: string; text: string }>;
} {
  const option =
    ARTICLE_TEMPLATE_OPTIONS.find((item) => item.id === template) ??
    ARTICLE_TEMPLATE_OPTIONS[0]!;
  const sections = option.seedBlocks().map((block) => {
    switch (block.type) {
      case "heading":
        return {
          kind: `H${block.level}`,
          text: block.text,
        };
      case "paragraph":
        return { kind: "Párrafo", text: block.text };
      case "list":
        return {
          kind: block.style === "number" ? "Lista numerada" : "Lista",
          text: block.items.join(" · "),
        };
      case "blockquote":
        return { kind: "Destacado", text: block.text };
      case "prosCons":
        return {
          kind: "Pros / Contras",
          text: `Pros: ${block.pros.join(" · ")} / Contras: ${block.cons.join(" · ")}`,
        };
      case "faq":
        return {
          kind: "FAQ",
          text: block.items.map((item) => item.question).join(" · "),
        };
      case "divider":
        return { kind: "Separador", text: "—" };
      case "image":
        return { kind: "Imagen", text: block.alt || block.caption || "Figura" };
      default:
        return { kind: "Bloque", text: "" };
    }
  });
  return {
    label: option.label,
    category: option.defaultCategory,
    pullQuoteExample: option.seedPullQuote,
    sections,
  };
}

export function isArticleDocument(value: unknown): value is ArticleDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const doc = value as ArticleDocument;
  return (
    doc.version === 1 &&
    typeof doc.template === "string" &&
    Array.isArray(doc.blocks)
  );
}

export function buildArticleDocument(options: {
  template: BlogTemplate;
  blocks: EditorBlock[];
  pullQuote?: string;
  pros?: string[];
  cons?: string[];
}): ArticleDocument {
  return {
    version: 1,
    template: options.template,
    blocks: editorBlocksToBlog(options.blocks),
    pullQuote: options.pullQuote?.trim() || undefined,
    pros: options.pros?.map((p) => p.trim()).filter(Boolean),
    cons: options.cons?.map((c) => c.trim()).filter(Boolean),
  };
}

export function estimateBlocksReadingTime(blocks: BlogBlock[]): number {
  const text = blocks
    .map((block) => {
      if (block.type === "paragraph" || block.type === "heading") return block.text;
      if (block.type === "blockquote") return block.text;
      if (block.type === "list") return block.items.join(" ");
      if (block.type === "prosCons") {
        return [...block.pros, ...block.cons].join(" ");
      }
      return "";
    })
    .join(" ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
