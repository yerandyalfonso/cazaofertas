import type { ReactNode } from "react";

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const ITALIC_RE = /\*([^*]+)\*/g;

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, "https://cazaofertas.local");
    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** Convierte markdown inline ligero (enlaces, negrita, cursiva) a nodos React. */
export function renderArticleInlineText(text: string): ReactNode[] {
  if (!text) return [];

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  const combined = new RegExp(
    `${LINK_RE.source}|${BOLD_RE.source}|${ITALIC_RE.source}`,
    "g",
  );
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[0].startsWith("[")) {
      const label = match[1] ?? "";
      const href = match[2] ?? "";
      if (isSafeUrl(href)) {
        nodes.push(
          <a
            key={`link-${key++}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-teal-800 underline decoration-teal-800/40 underline-offset-2 hover:decoration-teal-800"
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(match[0]);
      }
    } else if (match[0].startsWith("**")) {
      nodes.push(
        <strong key={`bold-${key++}`} className="font-semibold text-ink">
          {match[1]}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={`italic-${key++}`} className="italic">
          {match[1]}
        </em>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

export function applyTipTapMarks(
  text: string,
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>,
): string {
  if (!marks?.length) return text;
  let out = text;
  for (const mark of marks) {
    if (mark.type === "link" && typeof mark.attrs?.href === "string") {
      out = `[${out}](${mark.attrs.href})`;
    } else if (mark.type === "bold") {
      out = `**${out}**`;
    } else if (mark.type === "italic") {
      out = `*${out}*`;
    }
  }
  return out;
}

/** Parsea párrafo con markdown inline a nodos TipTap JSON. */
export function markdownInlineToTipTapNodes(
  text: string,
): Array<{ type: string; text?: string; marks?: unknown[] }> {
  const nodes: Array<{ type: string; text?: string; marks?: unknown[] }> = [];
  const combined = new RegExp(
    `${LINK_RE.source}|${BOLD_RE.source}|${ITALIC_RE.source}`,
    "g",
  );
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  function pushPlain(slice: string) {
    if (slice) nodes.push({ type: "text", text: slice });
  }

  while ((match = combined.exec(text)) !== null) {
    pushPlain(text.slice(lastIndex, match.index));
    if (match[0].startsWith("[")) {
      const label = match[1] ?? "";
      const href = match[2] ?? "";
      if (label && isSafeUrl(href)) {
        nodes.push({
          type: "text",
          text: label,
          marks: [
            {
              type: "link",
              attrs: { href, target: "_blank", rel: "noopener noreferrer" },
            },
          ],
        });
      } else {
        pushPlain(match[0]);
      }
    } else if (match[0].startsWith("**")) {
      nodes.push({
        type: "text",
        text: match[1] ?? "",
        marks: [{ type: "bold" }],
      });
    } else {
      nodes.push({
        type: "text",
        text: match[1] ?? "",
        marks: [{ type: "italic" }],
      });
    }
    lastIndex = match.index + match[0].length;
  }

  pushPlain(text.slice(lastIndex));
  return nodes;
}
