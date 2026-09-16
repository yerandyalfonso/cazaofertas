/** Lista de keywords: comas / ; / saltos de línea. Espacios dentro de la frase se conservan. */

export function normalizeKeywordList(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    const normalized = word.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function parseKeywordList(
  raw: string | string[] | null | undefined,
): string[] {
  if (Array.isArray(raw)) return normalizeKeywordList(raw);
  if (!raw?.trim()) return [];
  return normalizeKeywordList(raw.split(/[,;\n]+/));
}

export function formatKeywordList(keywords: string[]): string {
  return normalizeKeywordList(keywords).join(", ");
}
