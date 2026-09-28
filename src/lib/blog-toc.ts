import type { BlogBlock } from "@/lib/blog";

export interface TocEntry {
  id: string;
  text: string;
}

function slugifyHeading(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "seccion"
  );
}

/** Quita el markdown inline (negrita, cursiva, enlaces) de un título. */
function plainInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function uniqueIdFactory() {
  const seen = new Map<string, number>();
  return (text: string) => {
    const base = slugifyHeading(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };
}

/** Ids de los H2 de bloques, en orden (índice del bloque → id). */
export function headingIdsForBlocks(blocks: BlogBlock[]): Map<number, string> {
  const nextId = uniqueIdFactory();
  const ids = new Map<number, string>();
  blocks.forEach((block, index) => {
    if (block.type === "heading" && block.level === 2) {
      ids.set(index, nextId(plainInline(block.text)));
    }
  });
  return ids;
}

/** Añade `id` a los <h2> del HTML editorial que no lo tengan. */
export function withHeadingIds(html: string): string {
  const nextId = uniqueIdFactory();
  return html.replace(
    /<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi,
    (match, attrs: string | undefined, inner: string) => {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, "")).trim();
      const id = nextId(text);
      if (attrs && /\sid\s*=/.test(attrs)) return match;
      return `<h2 id="${id}"${attrs ?? ""}>${inner}</h2>`;
    },
  );
}

/** Entradas del índice del artículo a partir de los H2 (HTML primero, luego bloques). */
export function buildToc(blocks: BlogBlock[], html?: string): TocEntry[] {
  const entries: TocEntry[] = [];
  if (html?.trim()) {
    const withIds = withHeadingIds(html);
    for (const match of withIds.matchAll(
      /<h2\s[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/gi,
    )) {
      const text = decodeEntities(match[2]!.replace(/<[^>]+>/g, "")).trim();
      if (text) entries.push({ id: match[1]!, text });
    }
  }
  const ids = headingIdsForBlocks(blocks);
  blocks.forEach((block, index) => {
    const id = ids.get(index);
    if (id && block.type === "heading") {
      entries.push({ id, text: plainInline(block.text) });
    }
  });
  return entries;
}
