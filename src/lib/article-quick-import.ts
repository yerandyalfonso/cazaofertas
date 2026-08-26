import {
  emptyEditorBlock,
  newBlockId,
  type EditorBlock,
} from "@/lib/admin-article-editor";
import type { BlogTemplate } from "@/lib/blog-templates";

/** Plantillas de pegado rápido (subset orientado a redacción externa). */
export type QuickImportTemplateId = "review" | "guide" | "flash";

export interface QuickImportTemplate {
  id: QuickImportTemplateId;
  blogTemplate: BlogTemplate;
  label: string;
  description: string;
  defaultCategory: string;
  /** Texto de ejemplo listo para copiar/pegar. */
  sample: string;
  /** Líneas de ayuda visual (formato de etiquetas). */
  guideLines: string[];
}

export const QUICK_IMPORT_TEMPLATES: QuickImportTemplate[] = [
  {
    id: "review",
    blogTemplate: "product-analysis",
    label: "Review / Análisis",
    description: "Título, extracto, H2s, pros/contras y veredicto.",
    defaultCategory: "Análisis",
    guideLines: [
      "[TÍTULO]: …",
      "[EXTRACTO]: …",
      "[CITA]: … (opcional, pull-quote)",
      "[IMAGEN]: https://…/foto.jpg | Texto alternativo",
      "[H2]: Primera impresión",
      "[PÁRRAFO]: …",
      "[H2]: Rendimiento",
      "[PÁRRAFO]: …",
      "[PROS]",
      "- Punto fuerte 1",
      "- Punto fuerte 2",
      "[CONTRAS]",
      "- Limitación 1",
      "- Limitación 2",
      "[VEREDICTO]: …",
    ],
    sample: `[TÍTULO]: Análisis: auriculares ANC por menos de 100 €
[EXTRACTO]: Cancelación usable sin pagar precio de lanzamiento. Cuándo comprar y cuándo esperar.
[CITA]: Compra por señal de precio, no por el reclamo de marketing.
[IMAGEN]: https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200 | Auriculares inalámbricos sobre mesa
[H2]: Primera impresión
[PÁRRAFO]: Contexto del producto, a quién va dirigido y qué problema resuelve en el uso diario.
[H2]: Rendimiento en el día a día
[PÁRRAFO]: Detalla autonomía, sellado, app y calidad de sonido con ejemplos concretos.
[PROS]
- Cancelación usable en transporte
- Autonomía competitiva
- Buen momento de precio
[CONTRAS]
- ANC no iguala a gamas premium
- Hay que verificar talla/sellado
- El precio puede rebotar en 48 h
[VEREDICTO]: Merece la pena si el score es alto y el precio se acerca al mínimo histórico; si no, espera.`,
  },
  {
    id: "guide",
    blogTemplate: "deep-guide",
    label: "Guía / Listado",
    description: "Título, extracto, introducción y puntos clave numerados.",
    defaultCategory: "Guías",
    guideLines: [
      "[TÍTULO]: …",
      "[EXTRACTO]: …",
      "[CITA]: … (opcional)",
      "[IMAGEN]: https://…/foto.jpg | Texto alternativo",
      "[INTRODUCCIÓN]: …",
      "[H2]: Criterios (opcional)",
      "[PÁRRAFO]: …",
      "[PUNTOS CLAVE]",
      "1. Punto uno",
      "2. Punto dos",
      "3. Punto tres",
      "[H2]: Recomendación final (opcional)",
      "[PÁRRAFO]: …",
    ],
    sample: `[TÍTULO]: Guía rápida: cómo elegir una freidora de aire
[EXTRACTO]: Capacidad, limpieza y programas que sí importan antes de mirar el cartel de descuento.
[CITA]: Define el uso real antes de mirar el porcentaje de oferta.
[IMAGEN]: https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200 | Freidora de aire en encimera
[INTRODUCCIÓN]: Esta guía resume los criterios que usamos en CazaOferta para no comprar por impulso en Amazon.
[H2]: Criterios que importan
[PÁRRAFO]: Prioriza litros útiles, facilidad de limpieza y programas que uses cada semana.
[PUNTOS CLAVE]
1. Mide el espacio real de encimera
2. Elige capacidad según comensales habituales
3. Revisa cesta antiadherente y facilidad de lavado
4. Fija un precio objetivo ligado al mínimo histórico
[H2]: Recomendación final
[PÁRRAFO]: Si cumples los cuatro puntos y el precio toca mínimo, compra; si no, crea una alerta y espera.`,
  },
  {
    id: "flash",
    blogTemplate: "flash-deal",
    label: "Noticia / Chollo Flash",
    description: "Título, extracto, precios y llamada a la acción.",
    defaultCategory: "Ofertas",
    guideLines: [
      "[TÍTULO]: …",
      "[EXTRACTO]: …",
      "[CITA]: … (opcional)",
      "[IMAGEN]: https://…/foto.jpg | Texto alternativo",
      "[PRECIO ANTERIOR]: 79,99 €",
      "[PRECIO OFERTA]: 49,99 €",
      "[H2]: Por qué es un chollo (opcional)",
      "[PÁRRAFO]: …",
      "[CTA]: …",
    ],
    sample: `[TÍTULO]: Chollo flash: monitor 27" QHD a mínimo reciente
[EXTRACTO]: Bajada clara frente al precio de las últimas semanas. Stock limitado y conviene actuar rápido.
[CITA]: Si el score es alto y el precio toca mínimo, actúa rápido.
[IMAGEN]: https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=1200 | Monitor gaming sobre escritorio
[PRECIO ANTERIOR]: 279,00 €
[PRECIO OFERTA]: 199,00 €
[H2]: Por qué es un chollo ahora
[PÁRRAFO]: La bajada se sostiene respecto al precio reciente, no solo frente a un máximo artificial del cartel.
[H2]: Qué mirar antes de comprar
[PÁRRAFO]: Comprueba vendedor, envío Prime y que el ASIN coincide con el modelo que buscas.
[CTA]: Entra ya a la ficha, verifica disponibilidad y compra si el precio sigue en el mínimo.`,
  },
];

export function getQuickImportTemplate(
  id: QuickImportTemplateId,
): QuickImportTemplate {
  return (
    QUICK_IMPORT_TEMPLATES.find((item) => item.id === id) ??
    QUICK_IMPORT_TEMPLATES[0]!
  );
}

export function quickImportIdForBlogTemplate(
  template: BlogTemplate,
): QuickImportTemplateId {
  if (template === "product-analysis") return "review";
  if (template === "flash-deal") return "flash";
  return "guide";
}

export interface QuickImportResult {
  template: BlogTemplate;
  category: string;
  title: string;
  excerpt: string;
  pullQuote: string;
  /** Primera [IMAGEN] del texto, para usar como destacada si falta. */
  featuredImage: string;
  blocks: EditorBlock[];
  warnings: string[];
  matchedTags: string[];
}

interface RawSection {
  tag: string;
  content: string;
}

function normalizeTag(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function classifyTag(normalized: string): string {
  if (normalized === "titulo" || normalized === "title") return "title";
  if (normalized === "extracto" || normalized === "excerpt" || normalized === "resumen") {
    return "excerpt";
  }
  if (
    normalized === "cita" ||
    normalized === "pull-quote" ||
    normalized === "pull quote" ||
    normalized === "pullquote"
  ) {
    return "pullQuote";
  }
  if (normalized === "h2" || normalized === "titulo h2" || normalized === "subtitulo") {
    return "h2";
  }
  if (normalized === "h3") return "h3";
  if (
    normalized === "parrafo" ||
    normalized === "texto" ||
    normalized === "cuerpo"
  ) {
    return "paragraph";
  }
  if (normalized === "introduccion" || normalized === "intro") return "intro";
  if (normalized === "pros" || normalized === "ventajas") return "pros";
  if (normalized === "contras" || normalized === "desventajas") return "cons";
  if (normalized === "veredicto" || normalized === "conclusion") return "verdict";
  if (
    normalized === "precio anterior" ||
    normalized === "precio antes" ||
    normalized === "antes"
  ) {
    return "priceBefore";
  }
  if (
    normalized === "precio oferta" ||
    normalized === "precio actual" ||
    normalized === "ahora" ||
    normalized === "oferta"
  ) {
    return "priceNow";
  }
  if (
    normalized === "cta" ||
    normalized === "llamada a la accion" ||
    normalized === "call to action"
  ) {
    return "cta";
  }
  if (
    normalized === "imagen" ||
    normalized === "image" ||
    normalized === "img" ||
    normalized === "foto"
  ) {
    return "image";
  }
  if (
    normalized === "puntos clave" ||
    normalized === "items" ||
    normalized === "listado" ||
    normalized === "puntos"
  ) {
    return "keyPoints";
  }
  if (normalized === "destacado" || normalized === "blockquote") {
    return "blockquote";
  }
  return "unknown";
}

function splitTaggedSections(raw: string): RawSection[] {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  const tagRe = /\[([^\]]+)\]\s*:?\s*/gi;
  const matches = [...text.matchAll(tagRe)];
  if (matches.length === 0) {
    return [{ tag: "paragraph", content: text }];
  }

  const sections: RawSection[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const start = match.index ?? 0;
    const contentStart = start + match[0].length;
    const nextStart =
      index + 1 < matches.length
        ? (matches[index + 1]!.index ?? text.length)
        : text.length;
    const content = text.slice(contentStart, nextStart).trim();
    const kind = classifyTag(normalizeTag(match[1] ?? ""));
    sections.push({ tag: kind, content });
  }
  return sections;
}

function parseListItems(content: string): string[] {
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .replace(/^[-*•]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .trim(),
    )
    .filter(Boolean);
}

/** Formato: `url | alt` o `url | alt | pie de foto`. */
function parseImageTag(content: string): {
  src: string;
  alt: string;
  caption?: string;
} | null {
  const line = content
    .split(/\n/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!line) return null;

  const parts = line.split("|").map((part) => part.trim());
  const src = parts[0] ?? "";
  if (!src || !/^https?:\/\//i.test(src)) return null;

  const alt = parts[1]?.trim() || "Imagen del artículo";
  const caption = parts[2]?.trim() || undefined;
  return { src, alt, caption };
}

function paragraphBlock(text: string): EditorBlock {
  return { id: newBlockId(), type: "paragraph", text };
}

function headingBlock(level: 2 | 3, text: string): EditorBlock {
  return { id: newBlockId(), type: "heading", level, text };
}

function blockquoteBlock(text: string): EditorBlock {
  return { id: newBlockId(), type: "blockquote", text };
}

function imageBlock(
  src: string,
  alt: string,
  caption?: string,
): EditorBlock {
  return {
    id: newBlockId(),
    type: "image",
    src,
    alt,
    caption,
  };
}

/**
 * Interpreta texto etiquetado según la plantilla activa y genera
 * título, extracto, pull-quote y bloques del editor.
 */
export function parseQuickImport(
  raw: string,
  templateId: QuickImportTemplateId,
): QuickImportResult {
  const preset = getQuickImportTemplate(templateId);
  const sections = splitTaggedSections(raw);
  const warnings: string[] = [];
  const matchedTags = [
    ...new Set(sections.map((section) => section.tag).filter((t) => t !== "unknown")),
  ];

  let title = "";
  let excerpt = "";
  let pullQuote = "";
  let featuredImage = "";
  let priceBefore = "";
  let priceNow = "";
  const pendingPros: string[] = [];
  const pendingCons: string[] = [];
  const blocks: EditorBlock[] = [];

  const flushProsCons = () => {
    if (pendingPros.length === 0 && pendingCons.length === 0) return;
    blocks.push({
      id: newBlockId(),
      type: "prosCons",
      title: "Pros y contras",
      pros: pendingPros.length > 0 ? [...pendingPros] : [""],
      cons: pendingCons.length > 0 ? [...pendingCons] : [""],
    });
    pendingPros.length = 0;
    pendingCons.length = 0;
  };

  for (const section of sections) {
    const content = section.content.trim();
    if (!content && section.tag !== "pros" && section.tag !== "cons") {
      continue;
    }

    switch (section.tag) {
      case "title":
        title = content.split(/\n/)[0]?.trim() ?? content;
        break;
      case "excerpt":
        excerpt = content.replace(/\s+/g, " ").trim();
        break;
      case "pullQuote":
        pullQuote = content.replace(/\s+/g, " ").trim();
        break;
      case "priceBefore":
        priceBefore = content.split(/\n/)[0]?.trim() ?? content;
        break;
      case "priceNow":
        priceNow = content.split(/\n/)[0]?.trim() ?? content;
        break;
      case "h2":
        flushProsCons();
        blocks.push(headingBlock(2, content.split(/\n/)[0]?.trim() || content));
        {
          const rest = content.split(/\n/).slice(1).join("\n").trim();
          if (rest) blocks.push(paragraphBlock(rest));
        }
        break;
      case "h3":
        flushProsCons();
        blocks.push(headingBlock(3, content.split(/\n/)[0]?.trim() || content));
        {
          const rest = content.split(/\n/).slice(1).join("\n").trim();
          if (rest) blocks.push(paragraphBlock(rest));
        }
        break;
      case "intro":
      case "paragraph":
        flushProsCons();
        blocks.push(paragraphBlock(content));
        break;
      case "pros":
        pendingPros.push(...parseListItems(content));
        break;
      case "cons":
        pendingCons.push(...parseListItems(content));
        break;
      case "verdict":
        flushProsCons();
        blocks.push(headingBlock(2, "Veredicto"));
        blocks.push(paragraphBlock(content));
        break;
      case "keyPoints": {
        flushProsCons();
        blocks.push(headingBlock(2, "Puntos clave"));
        const items = parseListItems(content);
        if (items.length === 0) {
          blocks.push(paragraphBlock(content));
        } else {
          for (let i = 0; i < items.length; i += 1) {
            blocks.push(paragraphBlock(`${i + 1}. ${items[i]}`));
          }
        }
        break;
      }
      case "cta":
        flushProsCons();
        blocks.push(blockquoteBlock(content));
        break;
      case "blockquote":
        flushProsCons();
        blocks.push(blockquoteBlock(content));
        break;
      case "image": {
        flushProsCons();
        const parsed = parseImageTag(content);
        if (!parsed) {
          warnings.push(
            "Etiqueta [IMAGEN] inválida. Usa: [IMAGEN]: https://…/foto.jpg | Texto alternativo",
          );
          break;
        }
        blocks.push(imageBlock(parsed.src, parsed.alt, parsed.caption));
        if (!featuredImage) featuredImage = parsed.src;
        break;
      }
      case "unknown":
        warnings.push(
          `Etiqueta no reconocida; se ignoró un bloque. Revisa la guía de la plantilla.`,
        );
        break;
      default:
        break;
    }
  }

  flushProsCons();

  if (templateId === "flash" && (priceBefore || priceNow)) {
    const priceBlocks: EditorBlock[] = [
      headingBlock(2, "Precio de la oferta"),
    ];
    const lines: string[] = [];
    if (priceBefore) lines.push(`Precio anterior: ${priceBefore}`);
    if (priceNow) lines.push(`Precio oferta: ${priceNow}`);
    priceBlocks.push(paragraphBlock(lines.join("\n")));
    blocks.unshift(...priceBlocks);
  }

  if (!title) {
    warnings.push("No se encontró [TÍTULO].");
  }
  if (!excerpt) {
    warnings.push("No se encontró [EXTRACTO].");
  }
  if (blocks.length === 0) {
    warnings.push("No se generaron bloques de contenido.");
    blocks.push(emptyEditorBlock("paragraph"));
  }

  if (templateId === "review") {
    const hasProsCons = blocks.some((block) => block.type === "prosCons");
    if (!hasProsCons) {
      warnings.push("No se detectaron [PROS]/[CONTRAS]; puedes añadirlos en el editor.");
    }
  }

  return {
    template: preset.blogTemplate,
    category: preset.defaultCategory,
    title,
    excerpt,
    pullQuote,
    featuredImage,
    blocks,
    warnings,
    matchedTags,
  };
}
