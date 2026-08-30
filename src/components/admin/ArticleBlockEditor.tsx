"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Heading2,
  ImagePlus,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Package,
  Plus,
  Quote,
  Scale,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import {
  emptyEditorBlock,
  type EditorBlock,
  type EditorBlockKind,
  newBlockId,
} from "@/lib/admin-article-editor";
import type { BlogHeadingLevel } from "@/lib/blog";

const ADD_OPTIONS: Array<{ kind: EditorBlockKind; label: string; icon: typeof Type }> =
  [
    { kind: "heading", label: "Título (H2–H4)", icon: Heading2 },
    { kind: "paragraph", label: "Párrafo", icon: Type },
    { kind: "listBullet", label: "Lista · viñetas", icon: List },
    { kind: "listNumber", label: "Lista · números", icon: ListOrdered },
    { kind: "blockquote", label: "Destacado", icon: Quote },
    { kind: "prosCons", label: "Pros / Contras", icon: Scale },
    { kind: "product", label: "Producto", icon: Package },
    { kind: "productGrid", label: "Grid productos", icon: Package },
    { kind: "image", label: "Imagen", icon: ImagePlus },
    { kind: "divider", label: "Separador", icon: Minus },
  ];

export interface ArticleBlockProductOption {
  slug: string;
  title: string;
}

interface ArticleBlockEditorProps {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
  onUploadImage: (file: File) => Promise<string>;
  products?: ArticleBlockProductOption[];
}

export function ArticleBlockEditor({
  blocks,
  onChange,
  onUploadImage,
  products = [],
}: ArticleBlockEditorProps) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  function reorderByDrag(fromId: string, toId: string) {
    if (fromId === toId) return;
    const from = blocks.findIndex((block) => block.id === fromId);
    const to = blocks.findIndex((block) => block.id === toId);
    if (from < 0 || to < 0) return;
    const copy = [...blocks];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item!);
    onChange(copy);
  }

  function updateBlock(id: string, patch: Partial<EditorBlock>) {
    onChange(
      blocks.map((block) =>
        block.id === id ? ({ ...block, ...patch } as EditorBlock) : block,
      ),
    );
  }

  function moveBlock(id: string, direction: -1 | 1) {
    const index = blocks.findIndex((block) => block.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= blocks.length) return;
    const copy = [...blocks];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item!);
    onChange(copy);
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((block) => block.id !== id));
  }

  function addBlock(kind: EditorBlockKind) {
    onChange([...blocks, emptyEditorBlock(kind)]);
  }

  async function handleImageFile(blockId: string, file: File) {
    setUploadingId(blockId);
    try {
      const url = await onUploadImage(file);
      updateBlock(blockId, { src: url } as Partial<EditorBlock>);
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {blocks.length === 0 ? (
        <p className="border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-500">
          Añade secciones para construir el artículo.
        </p>
      ) : null}

      {blocks.map((block, index) => (
        <div
          key={block.id}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (dragId) reorderByDrag(dragId, block.id);
            setDragId(null);
          }}
          className={`border border-stone-300 bg-stone-50/60 p-4 ${
            dragId === block.id ? "opacity-60" : ""
          }`}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              <span
                draggable
                onDragStart={() => setDragId(block.id)}
                onDragEnd={() => setDragId(null)}
                title="Arrastrar para reordenar"
                className="inline-flex cursor-grab text-stone-400 active:cursor-grabbing"
                aria-hidden
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0" />
              </span>
              {block.type === "heading"
                ? `Título · H${block.level}`
                : block.type === "paragraph"
                  ? "Párrafo"
                  : block.type === "list"
                    ? block.style === "number"
                      ? "Lista numerada"
                      : "Lista con viñetas"
                    : block.type === "blockquote"
                      ? "Destacado"
                      : block.type === "prosCons"
                        ? "Pros / Contras"
                        : block.type === "product"
                          ? "Producto embebido"
                          : block.type === "productGrid"
                            ? "Grid de productos"
                            : block.type === "image"
                              ? "Imagen"
                              : "Separador"}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Subir"
                disabled={index === 0}
                onClick={() => moveBlock(block.id, -1)}
                className="inline-flex h-7 w-7 items-center justify-center text-stone-500 hover:text-ink disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Bajar"
                disabled={index === blocks.length - 1}
                onClick={() => moveBlock(block.id, 1)}
                className="inline-flex h-7 w-7 items-center justify-center text-stone-500 hover:text-ink disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Eliminar bloque"
                onClick={() => removeBlock(block.id)}
                className="inline-flex h-7 w-7 items-center justify-center text-stone-500 hover:text-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {block.type === "heading" ? (
            <div className="space-y-2">
              <select
                value={block.level}
                onChange={(event) =>
                  updateBlock(block.id, {
                    level: Number(event.target.value) as BlogHeadingLevel,
                  })
                }
                className="h-9 border border-stone-300 bg-white px-2 text-sm"
              >
                <option value={2}>H2 · Sección principal</option>
                <option value={3}>H3 · Subsección</option>
                <option value={4}>H4 · Apartado</option>
              </select>
              <input
                value={block.text}
                onChange={(event) =>
                  updateBlock(block.id, { text: event.target.value })
                }
                placeholder="Título de la sección"
                className="h-11 w-full border border-stone-300 bg-white px-3 font-display text-lg text-ink outline-none focus:border-ink"
              />
            </div>
          ) : null}

          {block.type === "paragraph" ? (
            <textarea
              value={block.text}
              onChange={(event) =>
                updateBlock(block.id, { text: event.target.value })
              }
              rows={4}
              placeholder="Escribe el párrafo…"
              className="w-full border border-stone-300 bg-white px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-ink"
            />
          ) : null}

          {block.type === "list" ? (
            <div className="space-y-2">
              <select
                value={block.style}
                onChange={(event) =>
                  updateBlock(block.id, {
                    style: event.target.value as "bullet" | "number",
                  })
                }
                className="h-9 border border-stone-300 bg-white px-2 text-sm"
              >
                <option value="bullet">Viñetas (•)</option>
                <option value="number">Números (1, 2, 3…)</option>
              </select>
              {block.items.map((item, idx) => (
                <div key={`${block.id}-item-${idx}`} className="flex gap-2">
                  <span className="flex h-9 w-7 shrink-0 items-center justify-center text-xs text-stone-400">
                    {block.style === "number" ? `${idx + 1}.` : "•"}
                  </span>
                  <input
                    value={item}
                    onChange={(event) => {
                      const items = [...block.items];
                      items[idx] = event.target.value;
                      updateBlock(block.id, { items });
                    }}
                    placeholder={`Ítem ${idx + 1}`}
                    className="h-9 min-w-0 flex-1 border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    title="Quitar ítem"
                    onClick={() => {
                      const items = block.items.filter((_, i) => i !== idx);
                      updateBlock(block.id, {
                        items: items.length > 0 ? items : [""],
                      });
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center text-stone-500 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateBlock(block.id, { items: [...block.items, ""] })
                }
                className="text-xs font-semibold text-teal-800 hover:underline"
              >
                + Añadir ítem
              </button>
            </div>
          ) : null}

          {block.type === "blockquote" ? (
            <div className="space-y-2">
              <textarea
                value={block.text}
                onChange={(event) =>
                  updateBlock(block.id, { text: event.target.value })
                }
                rows={3}
                placeholder="Frase destacada o pull-quote…"
                className="w-full border border-l-4 border-stone-300 border-l-teal-800 bg-white px-3 py-2 font-display text-lg text-ink outline-none focus:border-ink"
              />
              <input
                value={block.cite ?? ""}
                onChange={(event) =>
                  updateBlock(block.id, { cite: event.target.value })
                }
                placeholder="Cita / atribución (opcional)"
                className="h-9 w-full border border-stone-300 bg-white px-3 text-sm text-ink outline-none focus:border-ink"
              />
            </div>
          ) : null}

          {block.type === "divider" ? (
            <div className="py-4">
              <hr className="border-stone-300" />
            </div>
          ) : null}

          {block.type === "image" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  value={block.src}
                  onChange={(event) =>
                    updateBlock(block.id, { src: event.target.value })
                  }
                  placeholder="URL de la imagen"
                  className="h-10 min-w-[12rem] flex-1 border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
                />
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 border border-stone-300 bg-white px-3 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 hover:border-ink">
                  {uploadingId === block.id ? (
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
                      if (file) void handleImageFile(block.id, file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <input
                value={block.alt}
                onChange={(event) =>
                  updateBlock(block.id, { alt: event.target.value })
                }
                placeholder="Texto alternativo"
                className="h-9 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
              />
              {block.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={block.src}
                  alt={block.alt || "Vista previa"}
                  className="mt-2 max-h-48 w-auto border border-stone-200 object-cover"
                />
              ) : null}
            </div>
          ) : null}

          {block.type === "prosCons" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-teal-800">
                  Pros
                </p>
                {block.pros.map((item, idx) => (
                  <input
                    key={`${block.id}-pro-${idx}`}
                    value={item}
                    onChange={(event) => {
                      const pros = [...block.pros];
                      pros[idx] = event.target.value;
                      updateBlock(block.id, { pros });
                    }}
                    className="mb-2 h-9 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
                    placeholder={`Pro ${idx + 1}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateBlock(block.id, { pros: [...block.pros, ""] })
                  }
                  className="text-xs font-semibold text-teal-800 hover:underline"
                >
                  + Añadir pro
                </button>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
                  Contras
                </p>
                {block.cons.map((item, idx) => (
                  <input
                    key={`${block.id}-con-${idx}`}
                    value={item}
                    onChange={(event) => {
                      const cons = [...block.cons];
                      cons[idx] = event.target.value;
                      updateBlock(block.id, { cons });
                    }}
                    className="mb-2 h-9 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
                    placeholder={`Contra ${idx + 1}`}
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateBlock(block.id, { cons: [...block.cons, ""] })
                  }
                  className="text-xs font-semibold text-amber-900 hover:underline"
                >
                  + Añadir contra
                </button>
              </div>
            </div>
          ) : null}

          {block.type === "product" ? (
            <select
              value={block.slug}
              onChange={(event) =>
                updateBlock(block.id, { slug: event.target.value })
              }
              className="h-11 w-full border border-stone-300 bg-white px-3 text-sm outline-none focus:border-ink"
            >
              <option value="">Selecciona un producto…</option>
              {products.map((product) => (
                <option key={product.slug} value={product.slug}>
                  {product.title}
                </option>
              ))}
            </select>
          ) : null}

          {block.type === "productGrid" ? (
            <div className="space-y-2">
              {block.slugs.map((slug, idx) => (
                <div key={`${block.id}-slug-${idx}`} className="flex gap-2">
                  <select
                    value={slug}
                    onChange={(event) => {
                      const slugs = [...block.slugs];
                      slugs[idx] = event.target.value;
                      updateBlock(block.id, { slugs });
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
                    onClick={() => {
                      const slugs = block.slugs.filter((_, i) => i !== idx);
                      updateBlock(block.id, {
                        slugs: slugs.length > 0 ? slugs : [""],
                      });
                    }}
                    className="inline-flex h-10 w-10 items-center justify-center text-stone-500 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateBlock(block.id, { slugs: [...block.slugs, ""] })
                }
                className="text-xs font-semibold text-teal-800 hover:underline"
              >
                + Añadir producto al grid
              </button>
            </div>
          ) : null}
        </div>
      ))}

      <div className="flex flex-wrap gap-2 border border-dashed border-stone-300 bg-white p-3">
        <span className="mr-1 self-center text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500">
          Añadir
        </span>
        {ADD_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.kind}
              type="button"
              onClick={() => addBlock(option.kind)}
              className="inline-flex h-9 items-center gap-1.5 border border-stone-300 bg-stone-50 px-3 text-xs font-medium text-stone-700 transition hover:border-ink hover:text-ink"
            >
              <Icon className="h-3.5 w-3.5" />
              {option.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() =>
            onChange([
              ...blocks,
              {
                id: newBlockId(),
                type: "heading",
                level: 2,
                text: "Nueva sección",
              },
              { id: newBlockId(), type: "paragraph", text: "" },
            ])
          }
          className="inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-xs font-semibold uppercase tracking-[0.12em] text-paper"
        >
          <Plus className="h-3.5 w-3.5" />
          Sección + párrafo
        </button>
      </div>
    </div>
  );
}
