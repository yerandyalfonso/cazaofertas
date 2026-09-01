/** Parsea URLs de feeds (una por línea o separadas por coma). */
export function parseFeedUrlsText(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const urls = raw
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.startsWith("http"));
  return [...new Set(urls)];
}

export function formatFeedUrlsText(urls: string[]): string {
  return urls.filter(Boolean).join("\n");
}

const DEFAULT_SLOT_MS = 3 * 60 * 1000;

/**
 * Rota una lista de feeds: en cada slot de tiempo devuelve `perRun` URLs distintas.
 */
export function rotateFeedUrls(
  urls: string[],
  options?: {
    now?: number;
    perRun?: number;
    slotMs?: number;
  },
): string[] {
  if (urls.length === 0) return [];
  const perRun = Math.min(
    Math.max(1, options?.perRun ?? 1),
    urls.length,
  );
  if (urls.length <= perRun) return [...urls];

  const slotMs = options?.slotMs ?? DEFAULT_SLOT_MS;
  const slot = Math.floor((options?.now ?? Date.now()) / slotMs);
  const picked: string[] = [];
  let cursor = 0;
  while (picked.length < perRun && cursor < urls.length * 2) {
    const url = urls[(slot * perRun + cursor) % urls.length]!;
    cursor += 1;
    if (!picked.includes(url)) picked.push(url);
  }
  return picked;
}
