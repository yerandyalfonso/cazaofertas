"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDown, ArrowUp, Plus, Upload, X } from "lucide-react";
import { ArticleBlockEditor } from "@/components/admin/ArticleBlockEditor";
import { ArticleQuickImport } from "@/components/admin/ArticleQuickImport";
import { ArticleStyleGuide } from "@/components/admin/ArticleStyleGuide";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  ARTICLE_TEMPLATE_OPTIONS,
  blogBlocksToEditor,
  buildArticleDocument,
  createBlankEditorBlocks,
  type EditorBlock,
} from "@/lib/admin-article-editor";
import type { QuickImportResult } from "@/lib/article-quick-import";
import type { BlogBlock } from "@/lib/blog";
import type { BlogTemplate } from "@/lib/blog-templates";
import { formatEuro } from "@/lib/money";

interface ProductOption {
  id: string;
  title: string;
  asin: string;
  slug: string;
  imageUrl?: string | null;
  currentPrice?: number;
  previousPrice?: number | null;
}

function productThumb(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return `/api/admin/image-proxy?url=${encodeURIComponent(url.trim())}`;
}

const CATEGORIES = [
  "Comparativas",
  "Guías",
  "Tecnología",
  "Hogar",
  "Ofertas",
  "Análisis",
] as const;

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export function ArticleFormClient({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(articleId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useAdminToast();

  const [template, setTemplate] = useState<BlogTemplate>("flash-deal");
  const [blocks, setBlocks] = useState<EditorBlock[]>(() =>
    createBlankEditorBlocks(),
  );
  const [pullQuote, setPullQuote] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [featuredImage, setFeaturedImage] = useState("");
  const [author, setAuthor] = useState("CazaOferta");
  const [category, setCategory] = useState("Ofertas");
  const [status, setStatus] = useState("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [legacyHtml, setLegacyHtml] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    const response = await fetch("/api/admin/articles");
    const data = (await response.json()) as {
      ok?: boolean;
      products?: ProductOption[];
    };
    if (response.ok && data.ok) {
      setProducts(data.products ?? []);
    }
  }, []);

  const loadArticle = useCallback(async () => {
    if (!articleId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/articles/${articleId}`);
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        article?: {
          title: string;
          slug: string;
          excerpt: string;
          featuredImage: string | null;
          author: string;
          category: string;
          status: string;
          seoTitle: string | null;
          seoDescription: string | null;
          productIds: string[];
          template: BlogTemplate;
          blocks: BlogBlock[];
          pullQuote: string;
          html: string | null;
        };
      };
      if (!response.ok || !data.ok || !data.article) {
        setError(data.error ?? "No se pudo cargar el artículo.");
        return;
      }
      const article = data.article;
      setTitle(article.title);
      setSlug(article.slug);
      setExcerpt(article.excerpt);
      setFeaturedImage(article.featuredImage ?? "");
      setAuthor(article.author);
      setCategory(article.category);
      setStatus(article.status);
      setSeoTitle(article.seoTitle ?? "");
      setSeoDescription(article.seoDescription ?? "");
      setProductIds(article.productIds ?? []);
      setTemplate(article.template ?? "deep-guide");
      setPullQuote(article.pullQuote ?? "");
      setSlugTouched(true);

      if (article.blocks?.length) {
        setBlocks(blogBlocksToEditor(article.blocks));
        setLegacyHtml(null);
      } else if (article.html) {
        setLegacyHtml(article.html);
        setBlocks([
          {
            id: "legacy-note",
            type: "paragraph",
            text: "Este artículo tenía HTML plano. Se ha convertido a un párrafo base: edítalo por secciones o pégalo abajo en bloques nuevos.",
          },
          {
            id: "legacy-html",
            type: "paragraph",
            text: article.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          },
        ]);
      } else {
        setBlocks(createBlankEditorBlocks());
      }
    } catch {
      setError("Error de red al cargar el artículo.");
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    void loadProducts();
    void loadArticle();
  }, [loadProducts, loadArticle]);

  function selectTemplate(next: BlogTemplate) {
    const option = ARTICLE_TEMPLATE_OPTIONS.find((t) => t.id === next);
    if (!option) return;
    setTemplate(next);
    if (!isEdit || !slugTouched) {
      setCategory(option.defaultCategory);
    }
  }

  function applyQuickImport(result: QuickImportResult) {
    selectTemplate(result.template);
    if (result.title) {
      setTitle(result.title);
      if (!slugTouched) setSlug(slugify(result.title));
    }
    if (result.excerpt) setExcerpt(result.excerpt);
    if (result.pullQuote) setPullQuote(result.pullQuote);
    if (result.category) setCategory(result.category);
    setBlocks(result.blocks);
    if (result.featuredImage) {
      setFeaturedImage(result.featuredImage);
    }
    if (!seoTitle && result.title) setSeoTitle(result.title);
    if (!seoDescription && result.excerpt) setSeoDescription(result.excerpt);
    setWarning(
      result.warnings.length > 0 ? result.warnings.join(" ") : null,
    );
  }

  async function uploadImage(file: File): Promise<string> {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/uploads", {
      method: "POST",
      body,
    });
    const data = (await response.json()) as {
      ok?: boolean;
      url?: string;
      error?: string;
      warning?: string;
    };
    if (!response.ok || !data.ok || !data.url) {
      throw new Error(data.error ?? "No se pudo subir la imagen.");
    }
    if (data.warning) setWarning(data.warning);
    return data.url;
  }

  async function onFeaturedFile(file: File) {
    setUploadingImage(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setFeaturedImage(url);
      toast.success("Imagen destacada subida.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al subir imagen.";
      setError(message);
      toast.error(message);
    } finally {
      setUploadingImage(false);
    }
  }

  const selectedProducts = productIds
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is ProductOption => Boolean(product));

  function moveProduct(id: string, direction: -1 | 1) {
    setProductIds((prev) => {
      const index = prev.indexOf(id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item!);
      return copy;
    });
  }

  const filteredProducts = products.filter((product) => {
    if (productIds.includes(product.id)) return false;
    const q = productQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      product.title.toLowerCase().includes(q) ||
      product.asin.toLowerCase().includes(q) ||
      product.slug.toLowerCase().includes(q)
    );
  });

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const document = buildArticleDocument({
        template,
        blocks,
        pullQuote,
      });

      const embedSlugs = new Set<string>();
      for (const block of document.blocks) {
        if (block.type === "product" && block.slug) embedSlugs.add(block.slug);
        if (block.type === "productGrid") {
          for (const slug of block.slugs) if (slug) embedSlugs.add(slug);
        }
      }
      const embedIds = products
        .filter((p) => embedSlugs.has(p.slug))
        .map((p) => p.id);
      const mergedProductIds = [
        ...productIds,
        ...embedIds.filter((id) => !productIds.includes(id)),
      ];

      const payload = {
        title,
        slug: slug || slugify(title),
        excerpt,
        content: document,
        featuredImage: featuredImage || undefined,
        author,
        category,
        status,
        seoTitle: seoTitle || undefined,
        seoDescription: seoDescription || undefined,
        productIds: mergedProductIds,
      };

      const response = await fetch(
        isEdit ? `/api/admin/articles/${articleId}` : "/api/admin/articles",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        const message = data.error ?? "No se pudo guardar.";
        setError(message);
        toast.error(message);
        return;
      }
      toast.success(
        isEdit ? "Artículo actualizado correctamente." : "Artículo creado.",
      );
      router.push("/admin/articles");
      router.refresh();
    } catch {
      const message = "Error de red al guardar.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando artículo…
      </p>
    );
  }

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            Editorial
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
            {isEdit ? "Editar artículo" : "Nuevo artículo"}
          </h1>
        </div>
        <Link
          href="/admin/articles"
          className="text-sm text-stone-500 hover:text-ink"
        >
          ← Volver al listado
        </Link>
      </header>

      {error ? (
        <p className="mt-4 border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="mt-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {warning}
        </p>
      ) : null}
      {legacyHtml ? (
        <p className="mt-4 border border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Artículo legado en HTML convertido a bloques editables.
        </p>
      ) : null}

      <form onSubmit={(event) => void onSave(event)} className="mt-8 space-y-6">
        <ArticleQuickImport
          activeBlogTemplate={template}
          onApply={applyQuickImport}
        />

        <ArticleStyleGuide activeTemplate={template} />

        <section className="border border-stone-300 bg-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
            Tipo de artículo
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Clasifica la plantilla visual. También se actualiza al usar la
            importación rápida de arriba.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ARTICLE_TEMPLATE_OPTIONS.map((option) => {
              const active = template === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => selectTemplate(option.id)}
                  className={`border p-4 text-left transition ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-stone-300 bg-stone-50 hover:border-ink"
                  }`}
                >
                  <p className="font-display text-lg tracking-tight">
                    {option.label}
                  </p>
                  <p
                    className={`mt-2 text-xs leading-relaxed ${
                      active ? "text-paper/80" : "text-stone-600"
                    }`}
                  >
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4 border border-stone-300 bg-white p-6 md:grid-cols-2">
          <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Título
            <input
              required
              value={title}
              onChange={(event) => {
                const next = event.target.value;
                setTitle(next);
                if (!slugTouched) setSlug(slugify(next));
              }}
              className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Slug
            <input
              required
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              className="mt-2 h-11 w-full border border-stone-300 px-3 font-mono text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Estado
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 h-11 w-full border border-stone-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
              <option value="archived">Archivado</option>
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Categoría
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-2 h-11 w-full border border-stone-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Autor
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            />
          </label>

          <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Extracto
            <textarea
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              rows={2}
              className="mt-2 w-full border border-stone-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            />
          </label>

          <div className="md:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Imagen destacada
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={featuredImage}
                onChange={(event) => setFeaturedImage(event.target.value)}
                placeholder="Pega una URL o sube un archivo…"
                className="h-11 min-w-[14rem] flex-1 border border-stone-300 px-3 text-sm outline-none focus:border-ink"
              />
              <button
                type="button"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-11 items-center gap-2 border border-stone-300 bg-stone-50 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-700 hover:border-ink disabled:opacity-60"
              >
                {uploadingImage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Subir archivo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onFeaturedFile(file);
                  event.target.value = "";
                }}
              />
            </div>
            {featuredImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={featuredImage}
                alt="Destacada"
                className="mt-3 max-h-48 border border-stone-200 object-cover"
              />
            ) : null}
          </div>

          <label className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Cita / pull-quote (opcional)
            <textarea
              value={pullQuote}
              onChange={(event) => setPullQuote(event.target.value)}
              rows={2}
              placeholder="Frase editorial que destaca en la cabecera del artículo"
              className="mt-2 w-full border border-stone-300 px-3 py-2 font-display text-lg font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            />
          </label>
        </section>

        <section className="border border-stone-300 bg-white p-6">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              Contenido
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Añade títulos, párrafos, destacados o pros/contras y escribe
              directamente. Consulta la guía de estilo si necesitas el esquema
              recomendado.
            </p>
          </div>
          <ArticleBlockEditor
            blocks={blocks}
            onChange={setBlocks}
            onUploadImage={uploadImage}
            products={products.map((p) => ({ slug: p.slug, title: p.title }))}
          />
        </section>

        <section className="grid gap-4 border border-stone-300 bg-white p-6 md:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            SEO título
            <input
              value={seoTitle}
              onChange={(event) => setSeoTitle(event.target.value)}
              className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            SEO descripción
            <input
              value={seoDescription}
              onChange={(event) => setSeoDescription(event.target.value)}
              className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            />
          </label>
        </section>

        <section className="border border-stone-300 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Productos vinculados
          </p>
          <p className="mt-1 text-sm text-stone-600">
            Asocia productos del catálogo (aparecen en el artículo publicado).
          </p>

          {selectedProducts.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {selectedProducts.map((product, index) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between gap-3 border border-stone-200 px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden border border-stone-200 bg-stone-100">
                      {productThumb(product.imageUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={productThumb(product.imageUrl)!}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] text-stone-400">
                          —
                        </span>
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium leading-snug text-ink">
                        {product.title}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {typeof product.currentPrice === "number" ? (
                          <span className="font-semibold text-ink">
                            {formatEuro(product.currentPrice)}
                          </span>
                        ) : null}
                        <span className="ml-2 font-mono">{product.asin}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="Subir"
                      disabled={index === 0}
                      onClick={() => moveProduct(product.id, -1)}
                      className="inline-flex h-7 w-7 items-center justify-center text-stone-500 hover:text-ink disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Bajar"
                      disabled={index === selectedProducts.length - 1}
                      onClick={() => moveProduct(product.id, 1)}
                      className="inline-flex h-7 w-7 items-center justify-center text-stone-500 hover:text-ink disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Quitar producto"
                      onClick={() =>
                        setProductIds((prev) =>
                          prev.filter((id) => id !== product.id),
                        )
                      }
                      className="text-stone-500 hover:text-rose-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-stone-500">Ningún producto aún.</p>
          )}

          <input
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            placeholder="Buscar por título, ASIN o slug…"
            className="mt-3 h-11 w-full border border-stone-300 px-3 text-sm text-ink outline-none focus:border-ink"
          />
          <div className="mt-2 max-h-48 overflow-y-auto border border-stone-200">
            {filteredProducts.slice(0, 20).map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  setProductIds((prev) => [...prev, product.id]);
                  setProductQuery("");
                }}
                className="flex w-full items-center gap-3 border-b border-stone-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-stone-50"
              >
                <span className="relative h-12 w-12 shrink-0 overflow-hidden border border-stone-200 bg-stone-100">
                  {productThumb(product.imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productThumb(product.imageUrl)!}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-stone-400">
                      —
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block font-medium leading-snug text-ink">
                    {product.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-stone-500">
                    {typeof product.currentPrice === "number" ? (
                      <span className="font-semibold text-ink">
                        {formatEuro(product.currentPrice)}
                      </span>
                    ) : null}
                    <span className="font-mono">{product.asin}</span>
                  </span>
                </span>
                <Plus className="h-3.5 w-3.5 shrink-0 text-teal-800" />
              </button>
            ))}
            {filteredProducts.length === 0 ? (
              <p className="px-3 py-4 text-sm text-stone-500">
                No hay más productos que coincidan.
              </p>
            ) : null}
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link
            href="/admin/articles"
            className="inline-flex h-11 items-center px-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {saving
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : "Crear artículo"}
          </button>
        </div>
      </form>
    </div>
  );
}
