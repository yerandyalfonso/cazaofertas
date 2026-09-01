"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { HelpCircle, Link2, Unlink } from "lucide-react";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Heading2,
  Heading3,
  Heading4,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Minus,
  Package,
  Quote,
  Scale,
  Type,
} from "lucide-react";
import { useMemo, useRef } from "react";
import {
  BlogBlockquote,
  BlogFaq,
  BlogImage,
  BlogProduct,
  BlogProductGrid,
  BlogProsCons,
} from "@/components/admin/blog-wysiwyg/extensions";
import {
  BlogWysiwygContext,
  type BlogWysiwygProductOption,
} from "@/components/admin/blog-wysiwyg/context";
import type { EditorBlock } from "@/lib/admin-article-editor";
import {
  editorBlocksToTipTapDoc,
  tipTapDocToEditorBlocks,
} from "@/lib/blog-wysiwyg";

export interface BlogWysiwygEditorProps {
  blocks: EditorBlock[];
  onChange: (blocks: EditorBlock[]) => void;
  onUploadImage: (file: File) => Promise<string>;
  products?: BlogWysiwygProductOption[];
  /** Cambia al cargar artículo / import rápido para resetear TipTap. */
  resetKey?: string | number;
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1 border px-2 text-xs font-medium transition ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-stone-300 bg-white text-stone-700 hover:border-ink hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function BlogWysiwygEditor({
  blocks,
  onChange,
  onUploadImage,
  products = [],
  resetKey = 0,
}: BlogWysiwygEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const contextValue = useMemo(
    () => ({ products, onUploadImage }),
    [products, onUploadImage],
  );

  const initialContent = useMemo(
    () => editorBlocksToTipTapDoc(blocks),
    // Solo al montar / resetKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resetKey],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3, 4] },
          blockquote: false,
          code: false,
          codeBlock: false,
          strike: false,
          link: false,
        }),
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: {
            rel: "noopener noreferrer",
            target: "_blank",
            class: "text-teal-800 underline",
          },
        }),
        BlogBlockquote,
        Placeholder.configure({
          placeholder:
            "Escribe aquí… Usa la barra para H2–H4, listas, citas o bloques especiales.",
        }),
        BlogImage,
        BlogProduct,
        BlogProductGrid,
        BlogProsCons,
        BlogFaq,
      ],
      content: initialContent,
      editorProps: {
        attributes: {
          class:
            "blog-wysiwyg min-h-[22rem] px-4 py-3 text-sm leading-relaxed text-ink outline-none focus:outline-none",
        },
      },
      onUpdate: ({ editor: current }) => {
        onChangeRef.current(tipTapDocToEditorBlocks(current.getJSON()));
      },
    },
    [resetKey],
  );

  if (!editor) {
    return (
      <div className="border border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
        Cargando editor…
      </div>
    );
  }

  return (
    <BlogWysiwygContext.Provider value={contextValue}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5 border border-stone-300 bg-stone-50 p-2">
          <ToolbarButton
            label="Párrafo"
            active={editor.isActive("paragraph")}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            <Type className="h-3.5 w-3.5" />
            Texto
          </ToolbarButton>
          <ToolbarButton
            label="H2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="h-3.5 w-3.5" />
            H2
          </ToolbarButton>
          <ToolbarButton
            label="H3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 className="h-3.5 w-3.5" />
            H3
          </ToolbarButton>
          <ToolbarButton
            label="H4"
            active={editor.isActive("heading", { level: 4 })}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 4 }).run()
            }
          >
            <Heading4 className="h-3.5 w-3.5" />
            H4
          </ToolbarButton>
          <ToolbarButton
            label="Negrita"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Cursiva"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Enlace"
            active={editor.isActive("link")}
            onClick={() => {
              const previous = editor.getAttributes("link").href as
                | string
                | undefined;
              const url = window.prompt(
                "URL del enlace",
                previous || "https://",
              );
              if (url === null) return;
              if (url.trim() === "") {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                return;
              }
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url.trim() })
                .run();
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
            Enlace
          </ToolbarButton>
          <ToolbarButton
            label="Quitar enlace"
            onClick={() =>
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            }
          >
            <Unlink className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            label="Lista con viñetas"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
            Viñetas
          </ToolbarButton>
          <ToolbarButton
            label="Lista numerada"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
            Números
          </ToolbarButton>
          <ToolbarButton
            label="Destacado"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="h-3.5 w-3.5" />
            Cita
          </ToolbarButton>
          <ToolbarButton
            label="Separador"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="h-3.5 w-3.5" />
          </ToolbarButton>
          <span className="mx-1 hidden h-8 w-px bg-stone-300 sm:block" />
          <ToolbarButton
            label="Imagen"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "blogImage",
                  attrs: { src: "", alt: "", caption: "" },
                })
                .run()
            }
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Imagen
          </ToolbarButton>
          <ToolbarButton
            label="Pros / Contras"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "blogProsCons",
                  attrs: {
                    title: "Pros y contras",
                    pros: [""],
                    cons: [""],
                  },
                })
                .run()
            }
          >
            <Scale className="h-3.5 w-3.5" />
            Pros/Contras
          </ToolbarButton>
          <ToolbarButton
            label="Preguntas frecuentes"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "blogFaq",
                  attrs: {
                    title: "Preguntas frecuentes",
                    items: [{ question: "", answer: "" }],
                  },
                })
                .run()
            }
          >
            <HelpCircle className="h-3.5 w-3.5" />
            FAQ
          </ToolbarButton>
          <ToolbarButton
            label="Producto"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "blogProduct",
                  attrs: { slug: "" },
                })
                .run()
            }
          >
            <Package className="h-3.5 w-3.5" />
            Producto
          </ToolbarButton>
          <ToolbarButton
            label="Grid productos"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertContent({
                  type: "blogProductGrid",
                  attrs: { slugs: [""] },
                })
                .run()
            }
          >
            <Package className="h-3.5 w-3.5" />
            Grid
          </ToolbarButton>
        </div>

        <div className="border border-stone-300 bg-white [&_.blog-wysiwyg_blockquote]:my-3 [&_.blog-wysiwyg_blockquote]:border-l-4 [&_.blog-wysiwyg_blockquote]:border-teal-800 [&_.blog-wysiwyg_blockquote]:pl-3 [&_.blog-wysiwyg_blockquote]:font-display [&_.blog-wysiwyg_blockquote]:text-lg [&_.blog-wysiwyg_h2]:my-4 [&_.blog-wysiwyg_h2]:font-display [&_.blog-wysiwyg_h2]:text-2xl [&_.blog-wysiwyg_h2]:tracking-tight [&_.blog-wysiwyg_h3]:my-3 [&_.blog-wysiwyg_h3]:font-display [&_.blog-wysiwyg_h3]:text-xl [&_.blog-wysiwyg_h4]:my-2 [&_.blog-wysiwyg_h4]:font-display [&_.blog-wysiwyg_h4]:text-lg [&_.blog-wysiwyg_hr]:my-4 [&_.blog-wysiwyg_hr]:border-stone-300 [&_.blog-wysiwyg_ol]:my-2 [&_.blog-wysiwyg_ol]:list-decimal [&_.blog-wysiwyg_ol]:pl-5 [&_.blog-wysiwyg_p]:my-1.5 [&_.blog-wysiwyg_p.is-editor-empty:first-child::before]:pointer-events-none [&_.blog-wysiwyg_p.is-editor-empty:first-child::before]:float-left [&_.blog-wysiwyg_p.is-editor-empty:first-child::before]:h-0 [&_.blog-wysiwyg_p.is-editor-empty:first-child::before]:text-stone-400 [&_.blog-wysiwyg_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.blog-wysiwyg_ul]:my-2 [&_.blog-wysiwyg_ul]:list-disc [&_.blog-wysiwyg_ul]:pl-5">
          <EditorContent editor={editor} />
        </div>

        <p className="text-xs text-stone-500">
          Editor visual: bloques tipados al guardar. Usa enlace, negrita y cursiva
          en párrafos; inserta bloques FAQ, imagen o producto desde la barra.
        </p>
      </div>
    </BlogWysiwygContext.Provider>
  );
}
