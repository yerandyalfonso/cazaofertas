/**
 * Normaliza y estructura descripciones scrapadas de Amazon
 * (bullets, 【títulos】, separadores ·, etc.).
 */

const MAX_STORED_CHARS = 6000;

export function cleanAmazonDescriptionRaw(raw: string): string {
  return raw
    .replace(/\u3000/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/【\s*([^】]+?)\s*】/g, "\n$1\n")
    .replace(/\s*[·•]\s*/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Partes listas para render (párrafos / bullets). */
export function splitProductDescription(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const cleaned = cleanAmazonDescriptionRaw(raw);
  return cleaned
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 1)
    .filter((line) => !/^(ver más|see more|leer más)$/i.test(line));
}

/** Texto a persistir en BD (saltos de línea entre bloques). */
export function formatDescriptionForStorage(
  bullets: string[],
  longText?: string,
): string | undefined {
  const parts = [
    ...bullets.map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean),
  ];

  if (longText?.trim()) {
    const longParts = splitProductDescription(longText);
    for (const part of longParts) {
      if (!parts.some((p) => p === part || part.includes(p) || p.includes(part))) {
        parts.push(part);
      }
    }
  }

  if (parts.length === 0) return undefined;

  let text = parts.join("\n\n");
  text = cleanAmazonDescriptionRaw(text);
  if (text.length > MAX_STORED_CHARS) {
    text = `${text.slice(0, MAX_STORED_CHARS - 1).trimEnd()}…`;
  }
  return text || undefined;
}
