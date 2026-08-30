import type { BlogBlock } from "@/lib/blog";

export type CarouselSlideKind =
  | "cover"
  | "content"
  | "quote"
  | "engagement"
  | "cta";

export type CarouselTemplateId =
  | "editorial"
  | "split"
  | "quote"
  | "fullimage";

export type CarouselFormatId = "square" | "story";

export type CarouselPaletteId =
  | "ivory"
  | "sand"
  | "pearl"
  | "taupe"
  | "blush"
  | "sage"
  | "pastel-glow"
  | "sunset-warm"
  | "cream-dawn"
  | "lavender-mist";

export type CarouselTitleScaleId = "compact" | "standard" | "large";

export interface CarouselDisplayOptions {
  showPagination: boolean;
  titleScale: CarouselTitleScaleId;
}

export const CAROUSEL_TITLE_SCALE_OPTIONS: Array<{
  id: CarouselTitleScaleId;
  label: string;
  hint: string;
}> = [
  { id: "compact", label: "Compacto", hint: "Más texto en pantalla" },
  { id: "standard", label: "Estándar", hint: "Equilibrio lectura / espacio" },
  { id: "large", label: "Grande", hint: "Máxima legibilidad móvil" },
];

export const TITLE_SCALE_MULTIPLIER: Record<CarouselTitleScaleId, number> = {
  compact: 0.88,
  standard: 1,
  large: 1.14,
};

export const DEFAULT_CAROUSEL_DISPLAY: CarouselDisplayOptions = {
  showPagination: true,
  titleScale: "standard",
};

export interface CarouselPalette {
  id: CarouselPaletteId;
  label: string;
  bg: string;
  text: string;
  muted: string;
  accent: string;
  line: string;
  badge: string;
  ctaBg: string;
  ctaText: string;
  /** Degradado de fondo (sustituye bg si está definido). */
  bgGradient?: string;
  /** Capa radial suave encima del degradado. */
  bgOverlay?: string;
  ctaBgGradient?: string;
}

export interface CarouselFormat {
  id: CarouselFormatId;
  label: string;
  ratio: string;
  hint: string;
  width: number;
  height: number;
}

export interface CarouselSlide {
  id: string;
  kind: CarouselSlideKind;
  /** Título principal o encabezado de slide. */
  title: string;
  /** Cuerpo / párrafo / cita. */
  body: string;
  /** Línea superior (portada). */
  eyebrow?: string;
  imageUrl?: string | null;
  secondaryImageUrl?: string | null;
  slideNumber: number;
  /** Referencia local a la sección del artículo (no se guarda en BD). */
  sourceId?: string | null;
}

export const CAROUSEL_FORMATS: CarouselFormat[] = [
  {
    id: "square",
    label: "Cuadrado 1:1",
    ratio: "1:1",
    hint: "Instagram Feed",
    width: 1080,
    height: 1080,
  },
  {
    id: "story",
    label: "Vertical 9:16",
    ratio: "9:16",
    hint: "Reels · TikTok · Pinterest",
    width: 1080,
    height: 1920,
  },
];

export const CAROUSEL_PALETTES: CarouselPalette[] = [
  {
    id: "ivory",
    label: "Marfil",
    bg: "#FBFBFA",
    text: "#2C2926",
    muted: "#7A746C",
    accent: "#B8A99A",
    line: "#E8E4DE",
    badge: "#F0EBE3",
    ctaBg: "#5C534E",
    ctaText: "#F7F4EF",
  },
  {
    id: "sand",
    label: "Beige arena",
    bg: "#F5F0E8",
    text: "#3A342E",
    muted: "#8A8076",
    accent: "#C4B5A0",
    line: "#E5DDD2",
    badge: "#EDE6DA",
    ctaBg: "#6B625A",
    ctaText: "#FAF7F2",
  },
  {
    id: "pearl",
    label: "Gris perla",
    bg: "#EDEAE6",
    text: "#2E2C2A",
    muted: "#76726C",
    accent: "#A8A29C",
    line: "#D9D5CF",
    badge: "#E4E0DA",
    ctaBg: "#585550",
    ctaText: "#F5F3F0",
  },
  {
    id: "taupe",
    label: "Topo cálido",
    bg: "#E8E4DE",
    text: "#322F2B",
    muted: "#6F6A63",
    accent: "#9C8F7E",
    line: "#D4CEC6",
    badge: "#DDD7CE",
    ctaBg: "#4F4842",
    ctaText: "#F3EFE9",
  },
  {
    id: "blush",
    label: "Rosa empolvado",
    bg: "#F3ECEA",
    text: "#3A3230",
    muted: "#8A7A76",
    accent: "#C9A9A0",
    line: "#E6D8D4",
    badge: "#EDDED9",
    ctaBg: "#6E5650",
    ctaText: "#FBF6F4",
  },
  {
    id: "sage",
    label: "Verde salvia",
    bg: "#ECEEE8",
    text: "#2E322C",
    muted: "#6F7568",
    accent: "#9DAA92",
    line: "#D6DCD2",
    badge: "#E0E6DA",
    ctaBg: "#4F5648",
    ctaText: "#F4F6F1",
  },
  {
    id: "pastel-glow",
    label: "Pastel degradado",
    bg: "#FDEEE4",
    text: "#3A2F2C",
    muted: "#7A6A66",
    accent: "#E8A598",
    line: "#F0D8D0",
    badge: "#FBE8E2",
    ctaBg: "#6E5650",
    ctaText: "#FBF6F4",
    bgGradient:
      "linear-gradient(145deg, #fdeee4 0%, #f6d9cf 38%, #e9d8f4 70%, #dde8f7 100%)",
    bgOverlay:
      "radial-gradient(ellipse 50% 40% at 12% 18%, rgba(255,255,255,0.82) 0%, transparent 55%), radial-gradient(ellipse 45% 35% at 88% 12%, rgba(244,163,148,0.32) 0%, transparent 50%)",
    ctaBgGradient: "linear-gradient(145deg, #fb923c 0%, #e11d48 100%)",
  },
  {
    id: "sunset-warm",
    label: "Atardecer",
    bg: "#FFF4E6",
    text: "#3A2A22",
    muted: "#8A6F62",
    accent: "#F97316",
    line: "#F5D5C0",
    badge: "#FFE8D6",
    ctaBg: "#7C2D12",
    ctaText: "#FFF7ED",
    bgGradient:
      "linear-gradient(145deg, #fff4e6 0%, #fdba74 26%, #d8b4fe 64%, #a78bfa 100%)",
    bgOverlay:
      "radial-gradient(ellipse 55% 45% at 10% 15%, rgba(255,247,237,0.88) 0%, transparent 55%), radial-gradient(ellipse 48% 40% at 92% 18%, rgba(249,115,22,0.28) 0%, transparent 50%)",
    ctaBgGradient: "linear-gradient(145deg, #f97316 0%, #7c3aed 100%)",
  },
  {
    id: "cream-dawn",
    label: "Amanecer crema",
    bg: "#FFFAF3",
    text: "#342E28",
    muted: "#8A7F74",
    accent: "#D4A574",
    line: "#EDE4D8",
    badge: "#F5EDE3",
    ctaBg: "#5C534E",
    ctaText: "#F7F4EF",
    bgGradient:
      "linear-gradient(135deg, #fffaf3 0%, #fef3c7 30%, #fce7f3 62%, #e0f2fe 100%)",
    bgOverlay:
      "radial-gradient(ellipse 50% 40% at 20% 15%, rgba(255,255,255,0.92) 0%, transparent 55%), radial-gradient(ellipse 45% 35% at 90% 20%, rgba(251,146,60,0.2) 0%, transparent 50%)",
    ctaBgGradient: "linear-gradient(145deg, #6B625A 0%, #4F4842 100%)",
  },
  {
    id: "lavender-mist",
    label: "Lavanda suave",
    bg: "#F3EFF8",
    text: "#2E2A35",
    muted: "#726B7A",
    accent: "#A78BFA",
    line: "#E4DCEF",
    badge: "#EDE6F5",
    ctaBg: "#4C3D6B",
    ctaText: "#F8F5FF",
    bgGradient:
      "linear-gradient(145deg, #f8f4ff 0%, #ede4ff 35%, #e8f0ff 68%, #f0fdf4 100%)",
    bgOverlay:
      "radial-gradient(ellipse 48% 42% at 15% 20%, rgba(255,255,255,0.9) 0%, transparent 55%), radial-gradient(ellipse 40% 38% at 85% 80%, rgba(167,139,250,0.22) 0%, transparent 52%)",
    ctaBgGradient: "linear-gradient(145deg, #7c3aed 0%, #4c3d6b 100%)",
  },
];

export const CAROUSEL_TEMPLATES: Array<{
  id: CarouselTemplateId;
  label: string;
  hint: string;
}> = [
  {
    id: "editorial",
    label: "Minimal editorial",
    hint: "Portada + marco fino, No. 1 y pie «Desliza →»",
  },
  {
    id: "split",
    label: "Split / collage",
    hint: "Foto + bloque asimétrico, numeración 001 y aire revista",
  },
  {
    id: "quote",
    label: "Quote / destacado",
    hint: "Cita centrada, comillas serif y badge sutil",
  },
  {
    id: "fullimage",
    label: "Full image background",
    hint: "Foto a pantalla completa + tarjeta translúcida de alto impacto",
  },
];

const MAX_BODY_CHARS = 200;
const MAX_TITLE_CHARS = 44;
const MAX_EYEBROW_CHARS = 72;

function splitAtSentences(text: string, maxLen: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const chunks: string[] = [];
  let rest = normalized;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf(". ", maxLen);
    if (cut < maxLen * 0.45) cut = rest.lastIndexOf(" ", maxLen);
    if (cut < maxLen * 0.35) cut = maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim().replace(/^\.\s*/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function blockText(block: BlogBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "blockquote":
      return block.text.trim();
    case "list":
      return block.items.join(". ").trim();
    case "prosCons":
      return [...block.pros, ...block.cons].join(". ").trim();
    default:
      return "";
  }
}

function collectImages(
  featuredImage: string | null | undefined,
  blocks: BlogBlock[],
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const push = (url?: string | null) => {
    const trimmed = url?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    urls.push(trimmed);
  };
  push(featuredImage);
  for (const block of blocks) {
    if (block.type === "image") push(block.src);
  }
  return urls;
}

interface ContentSection {
  heading: string;
  paragraphs: string[];
  imageUrl?: string;
}

export interface ArticleSectionSource {
  id: string;
  label: string;
  kind: CarouselSlideKind;
  title: string;
  body: string;
  eyebrow?: string;
  imageUrl?: string | null;
  secondaryImageUrl?: string | null;
}

export function extractArticleSections(blocks: BlogBlock[]): ContentSection[] {
  return extractSections(blocks);
}

function extractSections(blocks: BlogBlock[]): ContentSection[] {
  const sections: ContentSection[] = [];
  let current: ContentSection = { heading: "", paragraphs: [] };

  const flush = () => {
    if (current.paragraphs.length > 0 || current.heading) {
      sections.push(current);
    }
    current = { heading: "", paragraphs: [] };
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      if (current.paragraphs.length > 0 || current.heading) flush();
      current.heading = block.text.trim();
      continue;
    }
    if (block.type === "image") {
      if (!current.imageUrl) current.imageUrl = block.src;
      continue;
    }
    if (block.type === "divider" || block.type === "product" || block.type === "productGrid") {
      continue;
    }
    const text = blockText(block);
    if (text) current.paragraphs.push(text);
  }
  flush();

  if (sections.length === 0) {
    const fallback = blocks.map(blockText).filter(Boolean).join(" ");
    if (fallback) {
      sections.push({ heading: "", paragraphs: [fallback] });
    }
  }

  return sections;
}

function truncateText(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.lastIndexOf(" ", maxLen - 1);
  const end = cut > maxLen * 0.5 ? cut : maxLen - 1;
  return `${trimmed.slice(0, end).trim()}…`;
}

function deriveContentSlideTitle(
  section: ContentSection,
  articleTitle: string,
  contentOrdinal: number,
  partIndex: number,
  body: string,
): string {
  const heading = section.heading.trim();
  const normalizedArticle = articleTitle.trim().toLowerCase();

  if (
    heading &&
    heading.toLowerCase() !== normalizedArticle &&
    partIndex === 0
  ) {
    return truncateText(heading, MAX_TITLE_CHARS);
  }

  const source = section.paragraphs[partIndex] ?? section.paragraphs[0] ?? "";
  const firstSentence = source.split(/[.!?]/)[0]?.trim() ?? "";
  const normalizedBody = body.trim().toLowerCase();

  if (
    firstSentence.length >= 14 &&
    firstSentence.length <= MAX_TITLE_CHARS &&
    !normalizedBody.startsWith(firstSentence.toLowerCase())
  ) {
    return firstSentence;
  }

  return `Punto ${String(contentOrdinal).padStart(2, "0")}`;
}

function buildContentSlides(
  sections: ContentSection[],
  images: string[],
  startNumber: number,
  maxSlides: number,
  articleTitle: string,
): CarouselSlide[] {
  const slides: CarouselSlide[] = [];
  let slideNumber = startNumber;
  let imageIndex = 1;
  let contentOrdinal = 1;

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    if (slides.length >= maxSlides) break;
    const combined = section.paragraphs.join(" ");
    const chunks = splitAtSentences(combined, MAX_BODY_CHARS);
    const parts = chunks.length > 0 ? chunks : [combined].filter(Boolean);

    for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
      const part = parts[partIndex];
      if (slides.length >= maxSlides || !part) break;
      slides.push({
        id: `content-${slideNumber}`,
        kind: "content",
        sourceId: `section-${sectionIndex}`,
        title: deriveContentSlideTitle(
          section,
          articleTitle,
          contentOrdinal,
          partIndex,
          part,
        ),
        body: part,
        imageUrl: section.imageUrl ?? images[imageIndex] ?? null,
        secondaryImageUrl: images[imageIndex + 1] ?? null,
        slideNumber: slideNumber++,
      });
      contentOrdinal += 1;
      imageIndex += 1;
    }
  }

  return slides;
}

export function buildArticleSectionSources(input: {
  title: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  blocks: BlogBlock[];
  pullQuote?: string | null;
  socialHandle?: string;
}): ArticleSectionSource[] {
  const images = collectImages(input.featuredImage, input.blocks);
  const sections = extractSections(input.blocks);
  const articleTitle = input.title.trim() || "Sin título";
  const socialHandle = input.socialHandle?.trim() || "@cazaoferta";
  const sources: ArticleSectionSource[] = [];

  sources.push({
    id: "cover",
    label: "Portada del artículo",
    kind: "cover",
    title: articleTitle,
    eyebrow: truncateText(
      input.excerpt?.trim() || "Lectura editorial",
      MAX_EYEBROW_CHARS,
    ),
    body: "",
    imageUrl: images[0] ?? null,
  });

  sections.forEach((section, index) => {
    const combined = section.paragraphs.join(" ");
    const body = truncateText(combined, MAX_BODY_CHARS);
    if (!body && !section.heading) return;

    sources.push({
      id: `section-${index}`,
      label: section.heading.trim()
        ? `§ ${truncateText(section.heading, 48)}`
        : `Sección ${index + 1}`,
      kind: "content",
      title: deriveContentSlideTitle(
        section,
        articleTitle,
        index + 1,
        0,
        body,
      ),
      body,
      imageUrl: section.imageUrl ?? images[index + 1] ?? null,
      secondaryImageUrl: images[index + 2] ?? null,
    });
  });

  const quoteBody =
    input.pullQuote?.trim() ||
    sections
      .flatMap((s) => s.paragraphs)
      .find((p) => p.length >= 60 && p.length <= 180);

  if (quoteBody) {
    sources.push({
      id: "quote",
      label: "Cita destacada",
      kind: "quote",
      title: "",
      body: quoteBody.trim(),
    });
  }

  sources.push({
    id: "engagement",
    label: "Engagement (guardar post)",
    kind: "engagement",
    title: "¿Te ha resultado útil?",
    body: "Guarda el post para volver cuando lo necesites.",
  });

  sources.push({
    id: "cta",
    label: "CTA final",
    kind: "cta",
    title: "Lee el artículo completo",
    body: `Síguenos en ${socialHandle} · enlace en bio`,
  });

  return sources;
}

export function applySourceToSlide(
  slide: CarouselSlide,
  source: ArticleSectionSource,
): CarouselSlide {
  return {
    ...slide,
    kind: source.kind,
    sourceId: source.id,
    title: source.title,
    body: source.body,
    eyebrow: source.eyebrow,
    imageUrl: source.imageUrl ?? null,
    secondaryImageUrl: source.secondaryImageUrl ?? null,
  };
}

export function renumberCarouselSlides(slides: CarouselSlide[]): CarouselSlide[] {
  return slides.map((slide, index) => ({
    ...slide,
    slideNumber: index + 1,
  }));
}

export function generateCarouselSlidesFromArticle(input: {
  title: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  blocks: BlogBlock[];
  pullQuote?: string | null;
  socialHandle?: string;
}): CarouselSlide[] {
  const images = collectImages(input.featuredImage, input.blocks);
  const sections = extractSections(input.blocks);
  const articleTitle = input.title.trim() || "Sin título";
  const socialHandle = input.socialHandle?.trim() || "@cazaoferta";

  const slides: CarouselSlide[] = [
    {
      id: "cover",
      kind: "cover",
      sourceId: "cover",
      eyebrow: truncateText(
        input.excerpt?.trim() || "Lectura editorial",
        MAX_EYEBROW_CHARS,
      ),
      title: articleTitle,
      body: "",
      imageUrl: images[0] ?? null,
      slideNumber: 1,
    },
  ];

  const contentSlides = buildContentSlides(
    sections,
    images,
    2,
    3,
    articleTitle,
  );
  slides.push(...contentSlides);

  let nextNumber = slides.length + 1;

  if (input.pullQuote?.trim()) {
    slides.push({
      id: "quote",
      kind: "quote",
      sourceId: "quote",
      title: "",
      body: input.pullQuote.trim(),
      slideNumber: nextNumber++,
    });
  } else {
    const quoteCandidate = sections
      .flatMap((s) => s.paragraphs)
      .find((p) => p.length >= 60 && p.length <= 180);
    if (quoteCandidate && slides.length < 5) {
      slides.push({
        id: "quote",
        kind: "quote",
        sourceId: "quote",
        title: "",
        body: quoteCandidate,
        slideNumber: nextNumber++,
      });
    }
  }

  slides.push({
    id: "engagement",
    kind: "engagement",
    sourceId: "engagement",
    title: "¿Te ha resultado útil?",
    body: "Guarda el post para volver cuando lo necesites.",
    slideNumber: nextNumber++,
  });

  slides.push({
    id: "cta",
    kind: "cta",
    sourceId: "cta",
    title: "Lee el artículo completo",
    body: `Síguenos en ${socialHandle} · enlace en bio`,
    slideNumber: nextNumber,
  });

  return slides.slice(0, 7);
}

export function previewScaleFor(format: CarouselFormat): number {
  const maxPreviewWidth = 520;
  const maxPreviewHeight = 640;
  return Math.min(
    maxPreviewWidth / format.width,
    maxPreviewHeight / format.height,
    0.52,
  );
}

export function proxiedCarouselImage(url: string): string {
  return `/api/admin/image-proxy?url=${encodeURIComponent(url)}`;
}

export function slugifyCarouselFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}
