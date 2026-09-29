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

function isShouting(value: string): boolean {
  const letters = value.replace(/[^\p{L}]/gu, "");
  return letters.length >= 4 && letters === letters.toUpperCase();
}

function sentenceCase(value: string): string {
  const lower = value.toLocaleLowerCase("es-ES");
  return lower.charAt(0).toLocaleUpperCase("es-ES") + lower.slice(1);
}

/**
 * Separa el título en MAYÚSCULAS que Amazon pone al inicio de cada punto
 * («MOCHILA ERGONÓMICA – 3 posiciones…») y lo pasa a formato frase.
 */
export function splitDescriptionLead(part: string): {
  lead: string | null;
  text: string;
} {
  const match = part.match(/^(.{3,80}?)\s*[–—:|]\s*(.+)$/u) ??
    part.match(/^(.{3,80}?)\s+-\s+(.+)$/u);
  if (match && isShouting(match[1]!)) {
    return { lead: sentenceCase(match[1]!.trim()), text: match[2]!.trim() };
  }
  return { lead: null, text: isShouting(part) ? sentenceCase(part) : part };
}

export type DescriptionBlock =
  | { type: "item"; lead: string | null; text: string }
  | { type: "heading"; text: string }
  | { type: "checks"; items: string[] };

const EMOJI =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

function stripEmoji(value: string): string {
  return value.replace(EMOJI, "").replace(/\s{2,}/g, " ").trim();
}

/**
 * Agrupa los puntos de la descripción: sin emojis, las líneas que acaban en
 * «:» o «?» pasan a subtítulo y las líneas cortas seguidas a una lista compacta.
 */
export function buildDescriptionBlocks(parts: string[]): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  for (const raw of parts) {
    const part = stripEmoji(raw);
    if (part.length < 2) continue;

    if (/[:?]$/.test(part) && part.length <= 90) {
      blocks.push({ type: "heading", text: part.replace(/:$/, "") });
      continue;
    }

    const { lead, text } = splitDescriptionLead(part);
    if (!lead && text.length <= 60) {
      const last = blocks[blocks.length - 1];
      const item = text.replace(/\.$/, "");
      if (last?.type === "checks") last.items.push(item);
      else blocks.push({ type: "checks", items: [item] });
      continue;
    }
    blocks.push({ type: "item", lead, text });
  }
  // Una «lista» de un solo elemento se muestra como punto normal.
  return blocks.map((block) =>
    block.type === "checks" && block.items.length === 1
      ? { type: "item", lead: null, text: block.items[0]! }
      : block,
  );
}
