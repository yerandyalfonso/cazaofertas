const STORAGE_KEY = "cazaofertas.social-card.projects.v1";

export type SocialCardFormatId = "square" | "story" | "landscape" | "classic";
/** `split` se migra a `float` al cargar proyectos antiguos. */
export type SocialCardLayoutId =
  | "minimal"
  | "float"
  | "banner"
  | "seal"
  | "pulse";
export type SocialCardStyleId = "cream" | "border" | "pastel" | "sunset";
export type SocialCardImageFit =
  | "contain"
  | "cover"
  | "cover-top"
  | "blur"
  | "smart";

export interface SocialCardProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  productId: string | null;
  productTitle: string | null;
  formatId: SocialCardFormatId;
  layoutId: SocialCardLayoutId;
  styleId: SocialCardStyleId;
  colorTone: number;
  imageFit: SocialCardImageFit;
  imagePadX: number;
  imagePadY: number;
  cardRadius: number;
  /** Fondo interior de la tarjeta (independiente del lienzo). */
  cardSurfaceColor: string;
  /** Layout flotante: rotación en grados (p. ej. -3). */
  floatRotate: number;
  /** Layout flotante: desplazamiento horizontal px. */
  floatOffsetX: number;
  /** Layout flotante: desplazamiento vertical px. */
  floatOffsetY: number;
  /** Layout flotante: zoom de la imagen (1 = 100%). */
  floatZoom: number;
  /** Padding horizontal de la zona de texto. */
  textPadX: number;
  /** Padding vertical de la zona de texto. */
  textPadY: number;
}

const DEFAULT_CARD_SURFACE = "#ffffff";

function normalizeLayoutId(raw: unknown): SocialCardLayoutId {
  if (raw === "split") return "float";
  if (
    raw === "minimal" ||
    raw === "float" ||
    raw === "banner" ||
    raw === "seal" ||
    raw === "pulse"
  ) {
    return raw;
  }
  return "minimal";
}

function normalizeProject(raw: Partial<SocialCardProject> & { id?: string; name?: string }): SocialCardProject | null {
  if (!raw?.id || !raw?.name) return null;
  return {
    id: raw.id,
    name: raw.name,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    productId: raw.productId ?? null,
    productTitle: raw.productTitle ?? null,
    formatId: (raw.formatId as SocialCardFormatId) ?? "story",
    layoutId: normalizeLayoutId(raw.layoutId),
    styleId: (raw.styleId as SocialCardStyleId) ?? "sunset",
    colorTone: typeof raw.colorTone === "number" ? raw.colorTone : 58,
    imageFit: (raw.imageFit as SocialCardImageFit) ?? "contain",
    imagePadX: typeof raw.imagePadX === "number" ? raw.imagePadX : 40,
    imagePadY: typeof raw.imagePadY === "number" ? raw.imagePadY : 40,
    cardRadius: typeof raw.cardRadius === "number" ? raw.cardRadius : 40,
    cardSurfaceColor:
      typeof raw.cardSurfaceColor === "string" && raw.cardSurfaceColor.trim()
        ? raw.cardSurfaceColor
        : DEFAULT_CARD_SURFACE,
    floatRotate: typeof raw.floatRotate === "number" ? raw.floatRotate : -3,
    floatOffsetX: typeof raw.floatOffsetX === "number" ? raw.floatOffsetX : 0,
    floatOffsetY: typeof raw.floatOffsetY === "number" ? raw.floatOffsetY : 0,
    floatZoom: typeof raw.floatZoom === "number" ? raw.floatZoom : 1,
    textPadX: typeof raw.textPadX === "number" ? raw.textPadX : 44,
    textPadY: typeof raw.textPadY === "number" ? raw.textPadY : 40,
  };
}

export function loadSocialCardProjects(): SocialCardProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) =>
        normalizeProject(item as Partial<SocialCardProject> & { id?: string; name?: string }),
      )
      .filter((item): item is SocialCardProject => item != null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function getSocialCardProject(id: string): SocialCardProject | null {
  return loadSocialCardProjects().find((item) => item.id === id) ?? null;
}

export function upsertSocialCardProject(
  project: SocialCardProject,
): SocialCardProject[] {
  const all = loadSocialCardProjects();
  const exists = all.some((item) => item.id === project.id);
  const next = exists
    ? all.map((item) => (item.id === project.id ? project : item))
    : [project, ...all];
  saveSocialCardProjects(next);
  return next;
}

export function removeSocialCardProject(id: string): SocialCardProject[] {
  const next = loadSocialCardProjects().filter((item) => item.id !== id);
  saveSocialCardProjects(next);
  return next;
}

export function saveSocialCardProjects(projects: SocialCardProject[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function createEmptySocialCardProject(
  name = "Nueva tarjeta",
): SocialCardProject {
  const now = new Date().toISOString();
  return {
    id: `social-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    productId: null,
    productTitle: null,
    formatId: "story",
    layoutId: "minimal",
    styleId: "sunset",
    colorTone: 58,
    imageFit: "contain",
    imagePadX: 40,
    imagePadY: 40,
    cardRadius: 40,
    cardSurfaceColor: DEFAULT_CARD_SURFACE,
    floatRotate: -3,
    floatOffsetX: 0,
    floatOffsetY: 0,
    floatZoom: 1,
    textPadX: 44,
    textPadY: 40,
  };
}

export function formatSocialProjectDate(iso: string): string {
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

export interface SocialCardProjectSnapshot {
  name: string;
  productId: string | null;
  productTitle: string | null;
  formatId: SocialCardFormatId;
  layoutId: SocialCardLayoutId;
  styleId: SocialCardStyleId;
  colorTone: number;
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

export function projectFromSnapshot(
  snapshot: SocialCardProjectSnapshot,
  existing?: Pick<SocialCardProject, "id" | "createdAt">,
): SocialCardProject {
  const now = new Date().toISOString();
  return {
    id:
      existing?.id ??
      `social-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: snapshot.name.trim() || "Tarjeta sin título",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    productId: snapshot.productId,
    productTitle: snapshot.productTitle,
    formatId: snapshot.formatId,
    layoutId: normalizeLayoutId(snapshot.layoutId),
    styleId: snapshot.styleId,
    colorTone: snapshot.colorTone,
    imageFit: snapshot.imageFit,
    imagePadX: snapshot.imagePadX,
    imagePadY: snapshot.imagePadY,
    cardRadius: snapshot.cardRadius,
    cardSurfaceColor: snapshot.cardSurfaceColor?.trim() || DEFAULT_CARD_SURFACE,
    floatRotate: snapshot.floatRotate ?? -3,
    floatOffsetX: snapshot.floatOffsetX ?? 0,
    floatOffsetY: snapshot.floatOffsetY ?? 0,
    floatZoom: snapshot.floatZoom ?? 1,
    textPadX: snapshot.textPadX ?? 44,
    textPadY: snapshot.textPadY ?? 40,
  };
}
