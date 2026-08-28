import type {
  CarouselDisplayOptions,
  CarouselFormatId,
  CarouselPaletteId,
  CarouselSlide,
  CarouselTemplateId,
} from "@/lib/carousel-slides";
import { DEFAULT_CAROUSEL_DISPLAY } from "@/lib/carousel-slides";

const STORAGE_KEY = "cazaofertas.carousel.projects.v1";

export interface CarouselProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  articleId: string | null;
  articleTitle: string | null;
  autoMode: boolean;
  templateId: CarouselTemplateId;
  paletteId: CarouselPaletteId;
  formatId: CarouselFormatId;
  display: CarouselDisplayOptions;
  slides: CarouselSlide[];
  baselineSlides: CarouselSlide[];
  activeIndex: number;
}

export interface CarouselProjectSnapshot {
  name: string;
  articleId: string | null;
  articleTitle: string | null;
  autoMode: boolean;
  templateId: CarouselTemplateId;
  paletteId: CarouselPaletteId;
  formatId: CarouselFormatId;
  display: CarouselDisplayOptions;
  slides: CarouselSlide[];
  baselineSlides: CarouselSlide[];
  activeIndex: number;
}

function cloneSlides(slides: CarouselSlide[]): CarouselSlide[] {
  return slides.map((slide) => ({ ...slide }));
}

export function loadCarouselProjects(): CarouselProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CarouselProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.id && item?.name)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function getCarouselProject(id: string): CarouselProject | null {
  return loadCarouselProjects().find((item) => item.id === id) ?? null;
}

export function upsertCarouselProject(project: CarouselProject): CarouselProject[] {
  const all = loadCarouselProjects();
  const exists = all.some((item) => item.id === project.id);
  const next = exists
    ? all.map((item) => (item.id === project.id ? project : item))
    : [project, ...all];
  saveCarouselProjects(next);
  return next;
}

export function removeCarouselProject(id: string): CarouselProject[] {
  const next = loadCarouselProjects().filter((item) => item.id !== id);
  saveCarouselProjects(next);
  return next;
}

export function saveCarouselProjects(projects: CarouselProject[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function createEmptyCarouselProject(name = "Nuevo carrusel"): CarouselProject {
  const now = new Date().toISOString();
  return {
    id: `carousel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    articleId: null,
    articleTitle: null,
    autoMode: true,
    templateId: "editorial",
    paletteId: "ivory",
    formatId: "story",
    display: { ...DEFAULT_CAROUSEL_DISPLAY },
    slides: [],
    baselineSlides: [],
    activeIndex: 0,
  };
}

export function projectFromSnapshot(
  snapshot: CarouselProjectSnapshot,
  existing?: Pick<CarouselProject, "id" | "createdAt">,
): CarouselProject {
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? `carousel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: snapshot.name.trim() || "Carrusel sin título",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    articleId: snapshot.articleId,
    articleTitle: snapshot.articleTitle,
    autoMode: snapshot.autoMode,
    templateId: snapshot.templateId,
    paletteId: snapshot.paletteId,
    formatId: snapshot.formatId,
    display: { ...snapshot.display },
    slides: cloneSlides(snapshot.slides),
    baselineSlides: cloneSlides(snapshot.baselineSlides),
    activeIndex: snapshot.activeIndex,
  };
}

export function formatProjectDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
