import type { SiteCategorySlug } from "@/lib/site-categories";

/**
 * Temas del grupo Telegram (message_thread_id).
 * Clave = slug de `categories` en BD (estable si solo cambias el nombre).
 *
 * Enlaces del grupo: https://t.me/c/4351769316/{threadId}
 * Chat id del grupo: -1004351769316
 */
export const DEFAULT_TELEGRAM_TOPIC_BY_SLUG: Record<SiteCategorySlug, number> = {
  tecnologia: 5,
  moda: 6,
  bebe: 7,
  belleza: 8,
  automovil: 9,
  deportes: 10,
  hogar: 11,
  informatica: 12,
  jardin: 13,
  juguetes: 14,
  mascotas: 15,
  videojuegos: 16,
};

/** Chat id del grupo con temas (t.me/c/4351769316 → -1004351769316). */
export const DEFAULT_TELEGRAM_GROUP_CHAT_ID = "-1004351769316";

/**
 * Override opcional: TELEGRAM_TOPIC_MAP=tecnologia:5,moda:6,hogar:11
 * o TELEGRAM_TOPIC_FALLBACK=1 para categorías sin mapa (tema General).
 */
export function parseTelegramTopicMap(
  raw: string | undefined | null,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const [slug, threadId] of Object.entries(DEFAULT_TELEGRAM_TOPIC_BY_SLUG)) {
    map.set(slug, threadId);
  }
  const extra = raw?.trim();
  if (!extra) return map;

  for (const part of extra.split(/[,;\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const sep = trimmed.includes("=") ? "=" : ":";
    const [slugRaw, idRaw] = trimmed.split(sep);
    const slug = slugRaw?.trim().toLowerCase();
    const threadId = Number(idRaw?.trim());
    if (!slug || !Number.isFinite(threadId) || threadId <= 0) continue;
    map.set(slug, threadId);
  }
  return map;
}

export function getTelegramTopicFallback(): number | null {
  const raw = process.env.TELEGRAM_TOPIC_FALLBACK?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Resuelve el tema por slug de categoría (no por nombre visible).
 * Si no hay match → TELEGRAM_TOPIC_FALLBACK o null (General / sin thread).
 */
export function resolveTelegramTopicId(
  categorySlug: string | null | undefined,
): number | null {
  const map = parseTelegramTopicMap(process.env.TELEGRAM_TOPIC_MAP);
  const slug = categorySlug?.trim().toLowerCase();
  if (slug && map.has(slug)) {
    return map.get(slug)!;
  }
  return getTelegramTopicFallback();
}
