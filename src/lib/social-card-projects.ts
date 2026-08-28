const STORAGE_KEY = "cazaofertas.social-card.projects.v1";

export type SocialCardFormatId = "square" | "story" | "landscape" | "classic";
export type SocialCardLayoutId = "minimal" | "split" | "banner" | "seal";
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
}

export function loadSocialCardProjects(): SocialCardProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SocialCardProject[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.id && item?.name)
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
    formatId: "square",
    layoutId: "minimal",
    styleId: "pastel",
    colorTone: 50,
    imageFit: "blur",
    imagePadX: 0,
    imagePadY: 0,
    cardRadius: 40,
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
    layoutId: snapshot.layoutId,
    styleId: snapshot.styleId,
    colorTone: snapshot.colorTone,
    imageFit: snapshot.imageFit,
    imagePadX: snapshot.imagePadX,
    imagePadY: snapshot.imagePadY,
    cardRadius: snapshot.cardRadius,
  };
}
