"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { Blockquote } from "@tiptap/extension-blockquote";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { Trash2, Upload, Loader2 } from "lucide-react";
import { useContext, useState, type ReactNode } from "react";
import { BlogWysiwygContext } from "@/components/admin/blog-wysiwyg/context";

export const BlogBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cite: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-cite") ?? "",
        renderHTML: (attributes) => {
          if (!attributes.cite) return {};
          return { "data-cite": attributes.cite };
        },
      },
    };
  },
});

function AtomChrome({
  label,
  children,
  deleteNode,
}: {
  label: string;
  children: ReactNode;
  deleteNode: () => void;
}) {
  return (
    <NodeViewWrapper className="my-3 border border-stone-300 bg-stone-50/80 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          {label}
        </p>
        <button
          type="button"
          title="Eliminar"
          onClick={deleteNode}
          className="inline-flex h-7 w-7 items-center justify-center text-stone-500 hover:text-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </NodeViewWrapper>
  );
}

function BlogImageView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const ctx = useContext(BlogWysiwygContext);
  const [uploading, setUploading] = useState(false);
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  const caption = String(node.attrs.caption ?? "");

  async function handleFile(file: File) {
    if (!ctx?.onUploadImage) return;
    setUploading(true);
    try {
      const url = await ctx.onUploadImage(file);
      updateAttributes({ src: url });
    } finally {
      setUploading(false);
    }
  }

  return (
    <AtomChrome label="Imagen" deleteNode={deleteNode}>
      <div className="space-y-2" contentEditable={false}>
        <div className="flex flex-wrap gap-2">
          <input
            value={src}
            onChange={(event) => updateAttributes({ src: event.target.value })}
            placeholder="URL de la imagen"
            className="h-10 min-w-[12rem] flex-1 border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
          />
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 border border-stone-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 hover:border-ink">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Subir
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        <input
          value={alt}
          onChange={(event) => updateAttributes({ alt: event.target.value })}
          placeholder="Texto alternativo"
          className="h-9 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
        />
        <input
          value={caption}
          onChange={(event) => updateAttributes({ caption: event.target.value })}
          placeholder="Pie de foto (opcional)"
          className="h-9 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
        />
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt || "Vista previa"}
            className="mt-1 max-h-48 w-auto border border-stone-200 object-cover"
          />
        ) : null}
      </div>
    </AtomChrome>
  );
}

function BlogProductView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const ctx = useContext(BlogWysiwygContext);
  const products = ctx?.products ?? [];
  return (
    <AtomChrome label="Producto embebido" deleteNode={deleteNode}>
      <select
        contentEditable={false}
        value={String(node.attrs.slug ?? "")}
        onChange={(event) => updateAttributes({ slug: event.target.value })}
        className="h-11 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
      >
        <option value="">Selecciona un producto…</option>
        {products.map((product) => (
          <option key={product.slug} value={product.slug}>
            {product.title}
          </option>
        ))}
      </select>
    </AtomChrome>
  );
}

function BlogProductGridView({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const ctx = useContext(BlogWysiwygContext);
  const products = ctx?.products ?? [];
  const slugs: string[] = Array.isArray(node.attrs.slugs)
    ? node.attrs.slugs
    : [""];

  function setSlugs(next: string[]) {
    updateAttributes({ slugs: next.length > 0 ? next : [""] });
  }

  return (
    <AtomChrome label="Grid de productos" deleteNode={deleteNode}>
      <div className="space-y-2" contentEditable={false}>
        {slugs.map((slug, idx) => (
          <div key={`grid-${idx}`} className="flex gap-2">
            <select
              value={slug}
              onChange={(event) => {
                const next = [...slugs];
                next[idx] = event.target.value;
                setSlugs(next);
              }}
              className="h-10 min-w-0 flex-1 border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
            >
              <option value="">Producto…</option>
              {products.map((product) => (
                <option key={product.slug} value={product.slug}>
                  {product.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              title="Quitar"
              onClick={() => setSlugs(slugs.filter((_, i) => i !== idx))}
              className="inline-flex h-10 w-10 items-center justify-center text-stone-500 hover:text-rose-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSlugs([...slugs, ""])}
          className="text-xs font-semibold text-teal-800 hover:underline"
        >
          + Añadir producto al grid
        </button>
      </div>
    </AtomChrome>
  );
}

function BlogProsConsView({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const pros: string[] = Array.isArray(node.attrs.pros) ? node.attrs.pros : [""];
  const cons: string[] = Array.isArray(node.attrs.cons) ? node.attrs.cons : [""];

  return (
    <AtomChrome label="Pros / Contras" deleteNode={deleteNode}>
      <div className="grid gap-4 md:grid-cols-2" contentEditable={false}>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-800">
            Pros
          </p>
          {pros.map((item, idx) => (
            <input
              key={`pro-${idx}`}
              value={item}
              onChange={(event) => {
                const next = [...pros];
                next[idx] = event.target.value;
                updateAttributes({ pros: next });
              }}
              className="mb-2 h-9 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
              placeholder={`Pro ${idx + 1}`}
            />
          ))}
          <button
            type="button"
            onClick={() => updateAttributes({ pros: [...pros, ""] })}
            className="text-xs font-semibold text-teal-800 hover:underline"
          >
            + Añadir pro
          </button>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
            Contras
          </p>
          {cons.map((item, idx) => (
            <input
              key={`con-${idx}`}
              value={item}
              onChange={(event) => {
                const next = [...cons];
                next[idx] = event.target.value;
                updateAttributes({ cons: next });
              }}
              className="mb-2 h-9 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
              placeholder={`Contra ${idx + 1}`}
            />
          ))}
          <button
            type="button"
            onClick={() => updateAttributes({ cons: [...cons, ""] })}
            className="text-xs font-semibold text-amber-900 hover:underline"
          >
            + Añadir contra
          </button>
        </div>
      </div>
    </AtomChrome>
  );
}

function BlogFaqView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const title = String(node.attrs.title ?? "Preguntas frecuentes");
  const items: Array<{ question: string; answer: string }> = Array.isArray(
    node.attrs.items,
  )
    ? node.attrs.items
    : [{ question: "", answer: "" }];

  function setItems(next: Array<{ question: string; answer: string }>) {
    updateAttributes({
      items: next.length > 0 ? next : [{ question: "", answer: "" }],
    });
  }

  return (
    <AtomChrome label="Preguntas frecuentes (FAQ)" deleteNode={deleteNode}>
      <div className="space-y-3" contentEditable={false}>
        <input
          value={title}
          onChange={(event) => updateAttributes({ title: event.target.value })}
          placeholder="Título de la sección"
          className="h-9 w-full border border-stone-300 bg-white px-3 text-sm font-medium outline-none focus:border-ink"
        />
        {items.map((item, idx) => (
          <div
            key={`faq-${idx}`}
            className="space-y-2 border border-stone-200 bg-white p-3"
          >
            <input
              value={item.question}
              onChange={(event) => {
                const next = [...items];
                next[idx] = { ...next[idx]!, question: event.target.value };
                setItems(next);
              }}
              placeholder={`Pregunta ${idx + 1}`}
              className="h-9 w-full border border-stone-300 px-3 text-sm outline-none focus:border-ink"
            />
            <textarea
              value={item.answer}
              onChange={(event) => {
                const next = [...items];
                next[idx] = { ...next[idx]!, answer: event.target.value };
                setItems(next);
              }}
              rows={3}
              placeholder="Respuesta"
              className="w-full border border-stone-300 px-3 py-2 text-sm outline-none focus:border-ink"
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, i) => i !== idx))}
              className="text-xs font-semibold text-rose-700 hover:underline"
            >
              Quitar pregunta
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setItems([...items, { question: "", answer: "" }])
          }
          className="text-xs font-semibold text-teal-800 hover:underline"
        >
          + Añadir pregunta
        </button>
      </div>
    </AtomChrome>
  );
}

export const BlogImage = Node.create({
  name: "blogImage",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      caption: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="blog-image"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "blog-image" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BlogImageView);
  },
});

export const BlogProduct = Node.create({
  name: "blogProduct",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      slug: { default: "" },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="blog-product"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "blog-product" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BlogProductView);
  },
});

export const BlogProductGrid = Node.create({
  name: "blogProductGrid",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      slugs: { default: [""] },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="blog-product-grid"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "blog-product-grid" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BlogProductGridView);
  },
});

export const BlogProsCons = Node.create({
  name: "blogProsCons",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: "Pros y contras" },
      pros: { default: [""] },
      cons: { default: [""] },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="blog-pros-cons"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "blog-pros-cons" }),
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BlogProsConsView);
  },
});

export const BlogFaq = Node.create({
  name: "blogFaq",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      title: { default: "Preguntas frecuentes" },
      items: { default: [{ question: "", answer: "" }] },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="blog-faq"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "blog-faq" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(BlogFaqView);
  },
});
