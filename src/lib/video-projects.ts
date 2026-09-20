import type {
  SocialCardFormatId,
  SocialCardImageFit,
  SocialCardLayoutId,
  SocialCardStyleId,
} from "@/lib/social-card-projects";
import type { PulseThemeId } from "@/lib/pulse-themes";

const STORAGE_KEY = "cazaofertas.video.projects.v1";

export type VideoSourceMode = "products" | "cards";
export type VideoTransitionId =
  | "fade"
  | "slide"
  | "slide-up"
  | "zoom"
  | "wipe"
  | "none";

export interface VideoCardStyle {
  formatId: SocialCardFormatId;
  layoutId: SocialCardLayoutId;
  styleId: SocialCardStyleId;
  colorTone: number;
  pulseThemeId: PulseThemeId;
  imageFit: SocialCardImageFit;
  imagePadX: number;
  imagePadY: number;
  cardRadius: number;
  cardSurfaceColor: string;
  floatRotate: number;
  floatOffsetX: number;
  floatOffsetY: number;
  floatZoom: number;
  textPadX: number;
  textPadY: number;
}

export interface VideoProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceMode: VideoSourceMode;
  /** Product IDs in slide order (products mode). */
  productIds: string[];
  /** Social card project IDs in slide order (cards mode). */
  cardProjectIds: string[];
  slideSeconds: number;
  transition: VideoTransitionId;
  transitionMs: number;
  /** Estilo de tarjeta; solo aplica en modo products. */
  cardStyle: VideoCardStyle;
}

export interface VideoProjectSnapshot {
  name: string;
  sourceMode: VideoSourceMode;
  productIds: string[];
  cardProjectIds: string[];
  slideSeconds: number;
  transition: VideoTransitionId;
  transitionMs: number;
  cardStyle: VideoCardStyle;
}

export const DEFAULT_VIDEO_CARD_STYLE: VideoCardStyle = {
  formatId: "story",
  layoutId: "minimal",
  styleId: "sunset",
  colorTone: 58,
  pulseThemeId: "amber",
  imageFit: "contain",
  imagePadX: 40,
  imagePadY: 40,
  cardRadius: 40,
  cardSurfaceColor: "#ffffff",
  floatRotate: -3,
  floatOffsetX: 0,
  floatOffsetY: 0,
  floatZoom: 1,
  textPadX: 44,
  textPadY: 40,
};

export function loadVideoProjects(): VideoProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VideoProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.id && item?.name)
      .map((item) => ({
        ...item,
        cardStyle: { ...DEFAULT_VIDEO_CARD_STYLE, ...item.cardStyle },
        productIds: item.productIds ?? [],
        cardProjectIds: item.cardProjectIds ?? [],
        sourceMode:
          item.sourceMode === "cards"
            ? ("cards" as const)
            : ("products" as const),
        transition: (item.transition ?? "fade") as VideoTransitionId,
        transitionMs: item.transitionMs ?? 500,
        slideSeconds: item.slideSeconds ?? 3,
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function getVideoProject(id: string): VideoProject | null {
  return loadVideoProjects().find((item) => item.id === id) ?? null;
}

export function upsertVideoProject(project: VideoProject): VideoProject[] {
  const all = loadVideoProjects();
  const exists = all.some((item) => item.id === project.id);
  const next = exists
    ? all.map((item) => (item.id === project.id ? project : item))
    : [project, ...all];
  saveVideoProjects(next);
  return next;
}

export function removeVideoProject(id: string): VideoProject[] {
  const next = loadVideoProjects().filter((item) => item.id !== id);
  saveVideoProjects(next);
  return next;
}

export function saveVideoProjects(projects: VideoProject[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function createEmptyVideoProject(name = "Nuevo vídeo"): VideoProject {
  const now = new Date().toISOString();
  return {
    id: `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    sourceMode: "products",
    productIds: [],
    cardProjectIds: [],
    slideSeconds: 3,
    transition: "fade",
    transitionMs: 500,
    cardStyle: { ...DEFAULT_VIDEO_CARD_STYLE },
  };
}

export function projectFromVideoSnapshot(
  snapshot: VideoProjectSnapshot,
  existing?: Pick<VideoProject, "id" | "createdAt">,
): VideoProject {
  const now = new Date().toISOString();
  return {
    id:
      existing?.id ??
      `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: snapshot.name.trim() || "Vídeo sin título",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sourceMode: snapshot.sourceMode,
    productIds: snapshot.productIds,
    cardProjectIds: snapshot.cardProjectIds,
    slideSeconds: snapshot.slideSeconds,
    transition: snapshot.transition,
    transitionMs: snapshot.transitionMs,
    cardStyle: { ...DEFAULT_VIDEO_CARD_STYLE, ...snapshot.cardStyle },
  };
}

export function formatVideoProjectDate(iso: string): string {
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
