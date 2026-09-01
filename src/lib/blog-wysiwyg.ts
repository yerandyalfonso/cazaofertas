import type { JSONContent } from "@tiptap/core";
import {
  applyTipTapMarks,
  markdownInlineToTipTapNodes,
} from "@/lib/article-inline-markdown";
import {
  newBlockId,
  type EditorBlock,
} from "@/lib/admin-article-editor";
import type { BlogHeadingLevel } from "@/lib/blog";

function textNode(text: string): JSONContent {
  return { type: "text", text };
}

function paragraphNode(text: string): JSONContent {
  const trimmed = text.trim();
  if (!trimmed) return { type: "paragraph" };
  const inline = markdownInlineToTipTapNodes(trimmed);
  return inline.length
    ? { type: "paragraph", content: inline as JSONContent[] }
    : { type: "paragraph" };
}

function inlineText(node: JSONContent | undefined): string {
  if (!node?.content?.length) return "";
  return node.content
    .map((child) => {
      if (child.type === "text") {
        return applyTipTapMarks(child.text ?? "", child.marks);
      }
      if (child.type === "hardBreak") return "\n";
      return inlineText(child);
    })
    .join("");
}

function blockToNode(block: EditorBlock): JSONContent | null {
  switch (block.type) {
    case "heading": {
      const text = block.text.trim();
      const inline = text ? markdownInlineToTipTapNodes(text) : [];
      return {
        type: "heading",
        attrs: { level: block.level },
        content: inline.length > 0 ? (inline as JSONContent[]) : undefined,
      };
    }
    case "paragraph":
      return paragraphNode(block.text);
    case "list": {
      const listType = block.style === "number" ? "orderedList" : "bulletList";
      const items = block.items.length > 0 ? block.items : [""];
      return {
        type: listType,
        content: items.map((item) => ({
          type: "listItem",
          content: [paragraphNode(item)],
        })),
      };
    }
    case "blockquote": {
      const text = block.text.trim();
      return {
        type: "blockquote",
        content: [paragraphNode(text)],
        attrs: { cite: block.cite ?? "" },
      };
    }
    case "divider":
      return { type: "horizontalRule" };
    case "image":
      return {
        type: "blogImage",
        attrs: {
          src: block.src,
          alt: block.alt,
          caption: block.caption ?? "",
        },
      };
    case "prosCons":
      return {
        type: "blogProsCons",
        attrs: {
          title: block.title ?? "Pros y contras",
          pros: block.pros,
          cons: block.cons,
        },
      };
    case "faq":
      return {
        type: "blogFaq",
        attrs: {
          title: block.title ?? "Preguntas frecuentes",
          items: block.items,
        },
      };
    case "product":
      return {
        type: "blogProduct",
        attrs: { slug: block.slug },
      };
    case "productGrid":
      return {
        type: "blogProductGrid",
        attrs: { slugs: block.slugs },
      };
    default:
      return null;
  }
}

/** Convierte bloques del admin al documento TipTap (misma estructura tipada). */
export function editorBlocksToTipTapDoc(blocks: EditorBlock[]): JSONContent {
  const content = blocks
    .map(blockToNode)
    .filter((node): node is JSONContent => Boolean(node));

  if (content.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  return { type: "doc", content };
}

function headingLevel(value: unknown): BlogHeadingLevel {
  if (value === 3 || value === 4) return value;
  return 2;
}

function listItemsFromNode(node: JSONContent): string[] {
  const items: string[] = [];
  for (const child of node.content ?? []) {
    if (child.type !== "listItem") continue;
    const parts = (child.content ?? []).map((part) => inlineText(part).trim());
    items.push(parts.filter(Boolean).join("\n") || "");
  }
  return items.length > 0 ? items : [""];
}

function nodeToBlock(node: JSONContent): EditorBlock | null {
  const id = newBlockId();
  switch (node.type) {
    case "heading":
      return {
        id,
        type: "heading",
        level: headingLevel(node.attrs?.level),
        text: inlineText(node),
      };
    case "paragraph": {
      const text = inlineText(node);
      if (!text.trim()) return null;
      return { id, type: "paragraph", text };
    }
    case "bulletList":
      return {
        id,
        type: "list",
        style: "bullet",
        items: listItemsFromNode(node),
      };
    case "orderedList":
      return {
        id,
        type: "list",
        style: "number",
        items: listItemsFromNode(node),
      };
    case "blockquote": {
      const text = (node.content ?? [])
        .map((child) => inlineText(child).trim())
        .filter(Boolean)
        .join("\n");
      if (!text) return null;
      const cite =
        typeof node.attrs?.cite === "string" ? node.attrs.cite.trim() : "";
      return {
        id,
        type: "blockquote",
        text,
        cite: cite || undefined,
      };
    }
    case "horizontalRule":
      return { id, type: "divider" };
    case "blogImage": {
      const src = String(node.attrs?.src ?? "").trim();
      if (!src) return null;
      return {
        id,
        type: "image",
        src,
        alt: String(node.attrs?.alt ?? "").trim(),
        caption: String(node.attrs?.caption ?? "").trim() || undefined,
      };
    }
    case "blogProsCons": {
      const pros = Array.isArray(node.attrs?.pros)
        ? (node.attrs.pros as string[])
        : [""];
      const cons = Array.isArray(node.attrs?.cons)
        ? (node.attrs.cons as string[])
        : [""];
      return {
        id,
        type: "prosCons",
        title: String(node.attrs?.title ?? "Pros y contras"),
        pros: pros.length > 0 ? pros : [""],
        cons: cons.length > 0 ? cons : [""],
      };
    }
    case "blogFaq": {
      const rawItems = Array.isArray(node.attrs?.items)
        ? (node.attrs.items as Array<{ question?: string; answer?: string }>)
        : [];
      const items =
        rawItems.length > 0
          ? rawItems.map((item) => ({
              question: String(item.question ?? ""),
              answer: String(item.answer ?? ""),
            }))
          : [{ question: "", answer: "" }];
      return {
        id,
        type: "faq",
        title: String(node.attrs?.title ?? "Preguntas frecuentes"),
        items,
      };
    }
    case "blogProduct":
      return {
        id,
        type: "product",
        slug: String(node.attrs?.slug ?? ""),
      };
    case "blogProductGrid": {
      const slugs = Array.isArray(node.attrs?.slugs)
        ? (node.attrs.slugs as string[])
        : [""];
      return {
        id,
        type: "productGrid",
        slugs: slugs.length > 0 ? slugs : [""],
      };
    }
    default:
      return null;
  }
}

/** TipTap → bloques EditorBlock (contrato actual de guardado / BD). */
export function tipTapDocToEditorBlocks(doc: JSONContent): EditorBlock[] {
  const blocks: EditorBlock[] = [];
  for (const node of doc.content ?? []) {
    const block = nodeToBlock(node);
    if (block) blocks.push(block);
  }
  if (blocks.length === 0) {
    return [{ id: newBlockId(), type: "paragraph", text: "" }];
  }
  return blocks;
}
