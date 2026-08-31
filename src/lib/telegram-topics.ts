import {
  PRODUCT_SUBCATEGORIES,
  telegramTopicSlugForCategory,
  type BlogCategorySlug,
} from "@/lib/category-taxonomy";

/**
 * Temas del grupo Telegram (message_thread_id).
 * Clave = slug de subcategoría o categoría padre.
 *
 * Enlaces del grupo: https://t.me/c/4351769316/{threadId}
 * Chat id del grupo: -1004351769316
 */
export const DEFAULT_TELEGRAM_TOPIC_BY_SLUG: Record<string, number> = {
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
  oficina: 17,
  /** Tema dedicado «Otros» — https://t.me/c/4351769316/231 */
  otros: 231,
};

/** Hereda el topic del padre para cada subcategoría (salvo «otros-*» → otros). */
for (const sub of PRODUCT_SUBCATEGORIES) {
  if (DEFAULT_TELEGRAM_TOPIC_BY_SLUG[sub.slug]) continue;
  const topicSlug =
    sub.telegramTopicSlug ??
    (sub.parentSlug === "otros" ? "otros" : sub.parentSlug);
  const threadId = DEFAULT_TELEGRAM_TOPIC_BY_SLUG[topicSlug];
  if (threadId != null) {
    DEFAULT_TELEGRAM_TOPIC_BY_SLUG[sub.slug] = threadId;
  }
}

/** Chat id del grupo con temas (t.me/c/4351769316 → -1004351769316). */
export const DEFAULT_TELEGRAM_GROUP_CHAT_ID = "-1004351769316";

/**
 * Override opcional: TELEGRAM_TOPIC_MAP=tecnologia:5,moda:6,hogar:11
 * TELEGRAM_TOPIC_OTROS=231 — tema estricto para Otros (evita General).
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

export function getTelegramTopicOtros(): number {
  const raw = process.env.TELEGRAM_TOPIC_OTROS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_TELEGRAM_TOPIC_BY_SLUG.otros ?? 231;
}

/**
 * Resuelve el tema por slug de subcategoría (o padre legacy).
 * Sin match → tema «Otros» (nunca el General del foro).
 */
export function resolveTelegramTopicId(
  categorySlug: string | null | undefined,
): number | null {
  const map = parseTelegramTopicMap(process.env.TELEGRAM_TOPIC_MAP);
  const slug = categorySlug?.trim().toLowerCase();
  if (slug && map.has(slug)) {
    return map.get(slug)!;
  }

  const topicSlug = telegramTopicSlugForCategory(slug);
  if (topicSlug === "otros") {
    return getTelegramTopicOtros();
  }
  if (map.has(topicSlug)) {
    return map.get(topicSlug)!;
  }

  return getTelegramTopicOtros();
}

export type { BlogCategorySlug };
