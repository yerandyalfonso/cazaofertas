"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { CarouselSlideFrame } from "@/components/admin/carousel/CarouselSlideFrame";
import { useAdminToast } from "@/components/admin/AdminToast";
import type { BlogBlock } from "@/lib/blog";
import {
  CAROUSEL_FORMATS,
  CAROUSEL_PALETTES,
  CAROUSEL_TEMPLATES,
  CAROUSEL_TITLE_SCALE_OPTIONS,
  DEFAULT_CAROUSEL_DISPLAY,
  applySourceToSlide,
  buildArticleSectionSources,
  generateCarouselSlidesFromArticle,
  previewScaleFor,
  renumberCarouselSlides,
  slugifyCarouselFilename,
  type CarouselDisplayOptions,
  type CarouselFormatId,
  type CarouselPaletteId,
  type CarouselSlide,
  type CarouselTemplateId,
} from "@/lib/carousel-slides";
import { getSocialHandle } from "@/lib/site";
import {
  formatProjectDate,
  getCarouselProject,
  projectFromSnapshot,
  upsertCarouselProject,
  type CarouselProject,
} from "@/lib/carousel-projects";

interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  status: string;
  featuredImage: string | null;
  updatedAt: string;
}

interface ArticleDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  blocks: BlogBlock[];
  pullQuote: string;
}

function slideLabel(slide: CarouselSlide): string {
  switch (slide.kind) {
    case "cover":
      return "Portada";
    case "quote":
      return "Cita";
    case "engagement":
      return "Engagement";
    case "cta":
      return "CTA";
    default:
      return `Contenido ${slide.slideNumber}`;
  }
}

export function CarouselEditorClient({
  projectId,
}: {
  projectId: string | null;
}) {
  const router = useRouter();
  const toast = useAdminToast();
  const exportRef = useRef<HTMLDivElement>(null);
  const baselineSlidesRef = useRef<CarouselSlide[]>([]);
  const hydratingRef = useRef(false);
  const skipRegenerateOnceRef = useRef(false);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    projectId,
  );
  const [projectName, setProjectName] = useState("Nuevo carrusel");
  const [editorReady, setEditorReady] = useState(false);

  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [autoMode, setAutoMode] = useState(true);
  const [templateId, setTemplateId] = useState<CarouselTemplateId>("editorial");
  const [paletteId, setPaletteId] = useState<CarouselPaletteId>("ivory");
  const [formatId, setFormatId] = useState<CarouselFormatId>("story");
  const [display, setDisplay] = useState<CarouselDisplayOptions>(
    DEFAULT_CAROUSEL_DISPLAY,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportSlideIndex, setExportSlideIndex] = useState<number | null>(null);

  const format =
    CAROUSEL_FORMATS.find((item) => item.id === formatId) ?? CAROUSEL_FORMATS[0];
  const palette =
    CAROUSEL_PALETTES.find((item) => item.id === paletteId) ??
    CAROUSEL_PALETTES[0];
  const scale = previewScaleFor(format);
  const activeSlide = slides[activeIndex] ?? null;

  const socialHandle = getSocialHandle();

  const sectionSources = useMemo(() => {
    if (!article) return [];
    return buildArticleSectionSources({
      title: article.title,
      excerpt: article.excerpt,
      featuredImage: article.featuredImage,
      blocks: article.blocks,
      pullQuote: article.pullQuote,
      socialHandle,
    });
  }, [article, socialHandle]);

  const storeBaseline = useCallback((next: CarouselSlide[]) => {
    baselineSlidesRef.current = next.map((slide) => ({ ...slide }));
  }, []);

  const buildSnapshot = useCallback(
    () => ({
      name: projectName.trim() || "Carrusel sin título",
      articleId: selectedId || null,
      articleTitle: article?.title ?? null,
      autoMode,
      templateId,
      paletteId,
      formatId,
      display,
      slides: slides.map((slide) => ({ ...slide })),
      baselineSlides: baselineSlidesRef.current.map((slide) => ({ ...slide })),
      activeIndex,
    }),
    [
      projectName,
      selectedId,
      article?.title,
      autoMode,
      templateId,
      paletteId,
      formatId,
      display,
      slides,
      activeIndex,
    ],
  );

  const applyProject = useCallback((project: CarouselProject) => {
    skipRegenerateOnceRef.current = true;
    hydratingRef.current = true;
    setCurrentProjectId(project.id);
    setProjectName(project.name);
    setSelectedId(project.articleId ?? "");
    setAutoMode(project.autoMode);
    setTemplateId(project.templateId);
    setPaletteId(project.paletteId);
    setFormatId(project.formatId);
    setDisplay({ ...project.display });
    setSlides(project.slides.map((slide) => ({ ...slide })));
    baselineSlidesRef.current = project.baselineSlides.map((slide) => ({ ...slide }));
    setActiveIndex(project.activeIndex);
    window.setTimeout(() => {
      hydratingRef.current = false;
    }, 0);
  }, []);

  const persistCurrentProject = useCallback(
    (options?: { silent?: boolean }) => {
      const id = currentProjectId ?? projectId;
      if (!id) return;

      const existing = getCarouselProject(id);
      if (!existing) return;

      upsertCarouselProject(projectFromSnapshot(buildSnapshot(), existing));

      if (!options?.silent) {
        toast.success("Carrusel guardado.");
      }
    },
    [buildSnapshot, currentProjectId, projectId, toast],
  );

  const regenerateSlides = useCallback(
    (source: ArticleDetail) => {
      const generated = generateCarouselSlidesFromArticle({
        title: source.title,
        excerpt: source.excerpt,
        featuredImage: source.featuredImage,
        blocks: source.blocks,
        pullQuote: source.pullQuote,
        socialHandle,
      });
      storeBaseline(generated);
      setSlides(generated);
      setActiveIndex(0);
    },
    [socialHandle, storeBaseline],
  );

  const loadArticles = useCallback(async () => {
    setLoadingArticles(true);
    try {
      const response = await fetch("/api/admin/articles");
      const data = (await response.json()) as {
        ok?: boolean;
        articles?: ArticleListItem[];
        error?: string;
      };
      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "No se pudieron cargar artículos.");
        return;
      }
      const published = (data.articles ?? []).filter(
        (item) => item.status === "published" || item.status === "draft",
      );
      setArticles(published);
      setSelectedId((prev) => {
        if (prev && published.some((a) => a.id === prev)) return prev;
        return "";
      });
    } catch {
      toast.error("Error de red al cargar artículos.");
    } finally {
      setLoadingArticles(false);
    }
  }, [toast]);

  const loadArticle = useCallback(
    async (id: string) => {
      if (!id) {
        setArticle(null);
        setSlides([]);
        return;
      }
      setLoadingArticle(true);
      try {
        const response = await fetch(`/api/admin/articles/${id}`);
        const data = (await response.json()) as {
          ok?: boolean;
          article?: ArticleDetail;
          error?: string;
        };
        if (!response.ok || !data.ok || !data.article) {
          toast.error(data.error ?? "No se pudo cargar el artículo.");
          return;
        }
        setArticle(data.article);
        if (autoMode && !skipRegenerateOnceRef.current) {
          regenerateSlides(data.article);
        }
        skipRegenerateOnceRef.current = false;
      } catch {
        toast.error("Error de red al cargar el artículo.");
      } finally {
        setLoadingArticle(false);
      }
    },
    [autoMode, regenerateSlides, toast],
  );

  useEffect(() => {
    if (projectId) {
      const project = getCarouselProject(projectId);
      if (!project) {
        toast.error("Carrusel no encontrado.");
        router.replace("/admin/carousels");
        return;
      }
      applyProject(project);
      setEditorReady(true);
      return;
    }

    setCurrentProjectId(null);
    setProjectName("Nuevo carrusel");
    setSelectedId("");
    setArticle(null);
    setSlides([]);
    baselineSlidesRef.current = [];
    setAutoMode(true);
    setTemplateId("editorial");
    setPaletteId("ivory");
    setFormatId("story");
    setDisplay({ ...DEFAULT_CAROUSEL_DISPLAY });
    setActiveIndex(0);
    setEditorReady(true);
  }, [applyProject, projectId, router, toast]);

  useEffect(() => {
    if (!editorReady) return;
    void loadArticles();
  }, [editorReady, loadArticles]);

  useEffect(() => {
    if (!editorReady) return;
    void loadArticle(selectedId);
  }, [selectedId, loadArticle, editorReady]);

  useEffect(() => {
    if (skipRegenerateOnceRef.current) return;
    if (hydratingRef.current) return;
    if (autoMode && article) regenerateSlides(article);
  }, [autoMode, article, regenerateSlides]);

  useEffect(() => {
    const id = currentProjectId ?? projectId;
    if (!id || !editorReady) return;
    const timer = window.setTimeout(() => {
      persistCurrentProject({ silent: true });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    activeIndex,
    autoMode,
    currentProjectId,
    display,
    editorReady,
    formatId,
    paletteId,
    persistCurrentProject,
    projectId,
    projectName,
    selectedId,
    slides,
    templateId,
  ]);

  const publishedOptions = useMemo(
    () =>
      articles.map((item) => ({
        id: item.id,
        label: `${item.status === "draft" ? "[Borrador] " : ""}${item.title}`,
      })),
    [articles],
  );

  function updateSlide(id: string, patch: Partial<CarouselSlide>) {
    setSlides((prev) =>
      prev.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    );
  }

  function applySourceToActiveSlide(sourceId: string) {
    const source = sectionSources.find((item) => item.id === sourceId);
    const slide = slides[activeIndex];
    if (!source || !slide) return;
    setSlides((prev) =>
      prev.map((item) =>
        item.id === slide.id ? applySourceToSlide(item, source) : item,
      ),
    );
  }

  function resetActiveSlideFromBaseline() {
    const baseline = baselineSlidesRef.current[activeIndex];
    const slide = slides[activeIndex];
    if (!baseline || !slide) {
      toast.error("No hay versión base para esta slide.");
      return;
    }
    setSlides((prev) =>
      prev.map((item) => (item.id === slide.id ? { ...baseline } : item)),
    );
    toast.success("Slide restaurada desde el artículo.");
  }

  function refillActiveSlideFromSource() {
    const slide = slides[activeIndex];
    if (!slide?.sourceId) {
      toast.error("Esta slide no tiene sección vinculada.");
      return;
    }
    applySourceToActiveSlide(slide.sourceId);
    toast.success("Contenido rellenado desde la sección.");
  }

  function addSlide() {
    const next: CarouselSlide = {
      id: `custom-${Date.now()}`,
      kind: "content",
      sourceId: null,
      title: "Nueva slide",
      body: "",
      slideNumber: slides.length + 1,
    };
    setSlides((prev) => renumberCarouselSlides([...prev, next]));
    setActiveIndex(slides.length);
  }

  function removeActiveSlide() {
    if (slides.length <= 1) {
      toast.error("El carrusel necesita al menos una slide.");
      return;
    }
    setSlides((prev) => {
      const next = renumberCarouselSlides(
        prev.filter((_, index) => index !== activeIndex),
      );
      baselineSlidesRef.current = baselineSlidesRef.current.filter(
        (_, index) => index !== activeIndex,
      );
      return next;
    });
    setActiveIndex((index) => Math.max(0, index - 1));
  }

  function moveActiveSlide(direction: -1 | 1) {
    const target = activeIndex + direction;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      const [moved] = next.splice(activeIndex, 1);
      next.splice(target, 0, moved);
      const renumbered = renumberCarouselSlides(next);

      const baseline = [...baselineSlidesRef.current];
      const [movedBaseline] = baseline.splice(activeIndex, 1);
      baseline.splice(target, 0, movedBaseline);
      baselineSlidesRef.current = baseline;

      return renumbered;
    });
    setActiveIndex(target);
  }

  function onRegenerate() {
    if (!article) return;
    regenerateSlides(article);
    toast.success("Slides regeneradas desde el artículo.");
  }

  function saveCurrentProject() {
    const existingId = projectId ?? currentProjectId;
    const existing = existingId ? getCarouselProject(existingId) : undefined;
    const saved = projectFromSnapshot(buildSnapshot(), existing ?? undefined);

    upsertCarouselProject(saved);
    setCurrentProjectId(saved.id);

    if (!projectId) {
      router.replace(`/admin/carousels/${saved.id}`);
    }

    toast.success("Carrusel guardado.");
  }

  async function waitForImages(root: HTMLElement): Promise<void> {
    const images = [...root.querySelectorAll("img")];
    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
      ),
    );
    await new Promise((r) => setTimeout(r, 120));
  }

  async function downloadZip() {
    if (!exportRef.current || slides.length === 0) {
      toast.error("Genera o carga un carrusel con slides primero.");
      return;
    }

    const exportLabel =
      projectName.trim() ||
      article?.title ||
      "carrusel";

    setExporting(true);
    const zip = new JSZip();
    const folder = zip.folder(slugifyCarouselFilename(exportLabel) || "carrusel");

    try {
      for (let index = 0; index < slides.length; index += 1) {
        setExportSlideIndex(index);
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        await waitForImages(exportRef.current);

        const dataUrl = await toPng(exportRef.current, {
          cacheBust: true,
          pixelRatio: 1,
          width: format.width,
          height: format.height,
          style: {
            transform: "none",
            transformOrigin: "top left",
            left: "0",
            top: "0",
            margin: "0",
          },
        });

        const base64 = dataUrl.split(",")[1];
        if (!base64) continue;
        folder?.file(
          `slide-${String(index + 1).padStart(2, "0")}-${slides[index].kind}.png`,
          base64,
          { base64: true },
        );
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `carrusel-${slugifyCarouselFilename(exportLabel)}-${format.ratio.replace(":", "x")}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(
        `ZIP descargado · ${slides.length} slides · ${format.width}×${format.height}`,
      );
    } catch (error) {
      console.error(error);
      toast.error(
        "No se pudo exportar el carrusel. Revisa que las imágenes carguen.",
      );
    } finally {
      setExportSlideIndex(null);
      setExporting(false);
    }
  }

  const previewSlide = exportSlideIndex != null ? slides[exportSlideIndex] : activeSlide;

  if (!editorReady) {
    return (
      <div className="flex h-80 items-center justify-center border border-dashed border-stone-300 bg-white text-stone-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando editor…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/carousels"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 hover:underline"
            >
              ← Volver a carruseles
            </Link>
            <h1 className="mt-3 font-display text-4xl tracking-tight text-ink">
              {projectId ? "Editar carrusel" : "Nuevo carrusel"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              {projectId && currentProjectId
                ? `Última actualización: ${formatProjectDate(
                    getCarouselProject(currentProjectId)?.updatedAt ??
                      new Date().toISOString(),
                  )}`
                : "Configura el carrusel y guárdalo para añadirlo a tu lista."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveCurrentProject}
              disabled={slides.length === 0}
              className="inline-flex h-11 items-center gap-2 border border-stone-300 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink hover:bg-stone-50 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              Guardar
            </button>
            <button
              type="button"
              onClick={() => void downloadZip()}
              disabled={exporting || slides.length === 0}
              className="inline-flex h-11 items-center gap-2 bg-ink px-4 text-xs font-semibold uppercase tracking-[0.12em] text-paper disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exportar ZIP
            </button>
          </div>
        </div>
        <label className="mt-4 block max-w-md text-sm font-medium text-ink">
          Nombre del carrusel
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="mt-1.5 w-full border border-stone-300 bg-paper px-3 py-2 text-sm"
          />
        </label>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
        <aside className="space-y-5">
          <section className="border border-stone-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Fuente
            </h2>
            <label className="mt-3 block text-sm font-medium text-ink">
              Artículo del blog
              <select
                value={selectedId}
                disabled={loadingArticles}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1.5 w-full border border-stone-300 bg-paper px-3 py-2 text-sm"
              >
                {publishedOptions.length === 0 ? (
                  <option value="">Sin artículos</option>
                ) : (
                  publishedOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={autoMode}
                onChange={(e) => setAutoMode(e.target.checked)}
                className="h-4 w-4"
              />
              <Sparkles className="h-4 w-4 text-teal-800" />
              Modo automático (4–7 slides)
            </label>

            <button
              type="button"
              onClick={onRegenerate}
              disabled={!article || loadingArticle}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium hover:bg-stone-100 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Rellenar todo desde artículo
            </button>
            {!autoMode ? (
              <p className="mt-2 text-[11px] leading-relaxed text-stone-500">
                Modo manual: el artículo no sobrescribe tus slides al cambiar
                opciones.
              </p>
            ) : null}
          </section>

          <section className="border border-stone-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Apariencia
            </h2>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={display.showPagination}
                onChange={(e) =>
                  setDisplay((prev) => ({
                    ...prev,
                    showPagination: e.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              Mostrar paginación (No. · Desliza →)
            </label>
            <p className="mt-3 text-xs font-medium text-stone-600">
              Tamaño de títulos y texto
            </p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {CAROUSEL_TITLE_SCALE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.hint}
                  onClick={() =>
                    setDisplay((prev) => ({ ...prev, titleScale: item.id }))
                  }
                  className={`border px-2 py-2 text-xs font-medium transition ${
                    display.titleScale === item.id
                      ? "border-ink bg-ink text-paper"
                      : "border-stone-300 hover:border-stone-500"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="border border-stone-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Plantilla
            </h2>
            <div className="mt-3 space-y-2">
              {CAROUSEL_TEMPLATES.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer gap-3 border p-3 transition ${
                    templateId === item.id
                      ? "border-ink bg-stone-50"
                      : "border-stone-200 hover:border-stone-400"
                  }`}
                >
                  <input
                    type="radio"
                    name="carousel-template"
                    checked={templateId === item.id}
                    onChange={() => setTemplateId(item.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {item.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="border border-stone-200 bg-white p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              Formato y color
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {CAROUSEL_FORMATS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFormatId(item.id)}
                  className={`border px-3 py-2 text-left text-sm transition ${
                    formatId === item.id
                      ? "border-ink bg-ink text-paper"
                      : "border-stone-300 hover:border-stone-500"
                  }`}
                >
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-[11px] opacity-80">{item.hint}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {CAROUSEL_PALETTES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => setPaletteId(item.id)}
                  className={`h-10 w-full rounded-md border-2 transition ${
                    paletteId === item.id
                      ? "border-ink scale-105"
                      : "border-stone-300"
                  }`}
                  style={{
                    background: item.bgGradient ?? item.bg,
                  }}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Paleta: {palette.label}
              {palette.bgGradient ? " · degradado" : " · sólido"}
            </p>
          </section>
        </aside>

        <section className="min-w-0">
          {loadingArticle ? (
            <div className="flex h-80 items-center justify-center border border-dashed border-stone-300 bg-white text-stone-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando artículo…
            </div>
          ) : slides.length === 0 ? (
            <div className="flex h-80 items-center justify-center border border-dashed border-stone-300 bg-white text-stone-500">
              Elige un artículo y pulsa «Rellenar todo desde artículo», o añade
              slides manualmente.
            </div>
          ) : !previewSlide ? (
            <div className="flex h-80 items-center justify-center border border-dashed border-stone-300 bg-white text-stone-500">
              Selecciona una slide para previsualizar.
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Slide anterior"
                    disabled={activeIndex <= 0 || exporting}
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex h-9 w-9 items-center justify-center border border-stone-300 bg-white disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Slide siguiente"
                    disabled={
                      activeIndex >= slides.length - 1 || exporting
                    }
                    onClick={() =>
                      setActiveIndex((i) => Math.min(slides.length - 1, i + 1))
                    }
                    className="inline-flex h-9 w-9 items-center justify-center border border-stone-300 bg-white disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-stone-600">
                    {activeIndex + 1} / {slides.length}
                    {exporting && exportSlideIndex != null
                      ? ` · exportando ${exportSlideIndex + 1}…`
                      : ""}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={`Ir a slide ${index + 1}`}
                      onClick={() => setActiveIndex(index)}
                      className={`h-2.5 w-2.5 rounded-full transition ${
                        index === activeIndex ? "bg-ink" : "bg-stone-300"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto pb-4">
                <div
                  className="flex gap-4 transition-transform duration-300"
                  style={{
                    transform: `translateX(-${activeIndex * (format.width * scale + 16)}px)`,
                    width: slides.length * (format.width * scale + 16),
                  }}
                >
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setActiveIndex(index)}
                      className={`shrink-0 overflow-hidden border text-left transition ${
                        index === activeIndex
                          ? "border-ink shadow-md"
                          : "border-stone-200 opacity-80 hover:opacity-100"
                      }`}
                      style={{
                        width: format.width * scale,
                        height: format.height * scale,
                      }}
                    >
                      <div
                        style={{
                          width: format.width,
                          height: format.height,
                          transform: `scale(${scale})`,
                          transformOrigin: "top left",
                        }}
                      >
                        <CarouselSlideFrame
                          slide={slide}
                          templateId={templateId}
                          palette={palette}
                          format={format}
                          totalSlides={slides.length}
                          display={display}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {activeSlide ? (
                <section className="mt-2 border border-stone-200 bg-white p-4 lg:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Editar slide activa
                      </h2>
                      <p className="mt-1 text-sm font-medium text-ink">
                        {slideLabel(activeSlide)} · No. {activeSlide.slideNumber}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => moveActiveSlide(-1)}
                        disabled={activeIndex <= 0}
                        className="border border-stone-300 px-2 py-1 text-xs disabled:opacity-40"
                      >
                        ↑ Subir
                      </button>
                      <button
                        type="button"
                        onClick={() => moveActiveSlide(1)}
                        disabled={activeIndex >= slides.length - 1}
                        className="border border-stone-300 px-2 py-1 text-xs disabled:opacity-40"
                      >
                        ↓ Bajar
                      </button>
                      <button
                        type="button"
                        onClick={addSlide}
                        className="inline-flex items-center gap-1 border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50"
                      >
                        <Plus className="h-3 w-3" />
                        Añadir slide
                      </button>
                      <button
                        type="button"
                        onClick={removeActiveSlide}
                        className="inline-flex items-center gap-1 border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block text-xs font-medium text-stone-600">
                      Sección del artículo
                      <select
                        value={activeSlide.sourceId ?? ""}
                        disabled={sectionSources.length === 0}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!value) return;
                          applySourceToActiveSlide(value);
                        }}
                        className="mt-1 w-full border border-stone-300 bg-paper px-2 py-2 text-sm"
                      >
                        <option value="">Elegir sección…</option>
                        {sectionSources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-wrap items-end gap-2">
                      <button
                        type="button"
                        onClick={refillActiveSlideFromSource}
                        disabled={!activeSlide.sourceId}
                        className="inline-flex items-center gap-1 border border-stone-300 px-3 py-2 text-xs hover:bg-stone-50 disabled:opacity-40"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Rellenar sección
                      </button>
                      <button
                        type="button"
                        onClick={resetActiveSlideFromBaseline}
                        className="inline-flex items-center gap-1 border border-stone-300 px-3 py-2 text-xs hover:bg-stone-50"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restaurar slide
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {activeSlide.kind !== "quote" ? (
                      <label className="block text-xs text-stone-600">
                        Título
                        <input
                          value={activeSlide.title}
                          onChange={(e) =>
                            updateSlide(activeSlide.id, { title: e.target.value })
                          }
                          className="mt-1 w-full border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    ) : null}

                    {activeSlide.kind === "cover" ? (
                      <label className="block text-xs text-stone-600">
                        Gancho / eyebrow
                        <input
                          value={activeSlide.eyebrow ?? ""}
                          onChange={(e) =>
                            updateSlide(activeSlide.id, {
                              eyebrow: e.target.value,
                            })
                          }
                          className="mt-1 w-full border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    ) : null}

                    <label
                      className={`block text-xs text-stone-600 ${
                        activeSlide.kind === "cover" ? "lg:col-span-2" : ""
                      }`}
                    >
                      URL imagen (opcional)
                      <input
                        value={activeSlide.imageUrl ?? ""}
                        onChange={(e) =>
                          updateSlide(activeSlide.id, {
                            imageUrl: e.target.value || null,
                          })
                        }
                        placeholder="https://…"
                        className="mt-1 w-full border border-stone-300 px-2 py-1.5 text-sm"
                      />
                    </label>

                    {activeSlide.kind !== "cover" ? (
                      <label className="block text-xs text-stone-600 lg:col-span-2">
                        Texto
                        <textarea
                          value={activeSlide.body}
                          rows={5}
                          onChange={(e) =>
                            updateSlide(activeSlide.id, { body: e.target.value })
                          }
                          className="mt-1 w-full border border-stone-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    ) : null}
                  </div>

                  {slides.length > 1 ? (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                      {slides.map((slide, index) => (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() => setActiveIndex(index)}
                          className={`border px-2.5 py-1.5 text-xs ${
                            index === activeIndex
                              ? "border-ink bg-stone-50 font-medium"
                              : "border-stone-200 text-stone-600"
                          }`}
                        >
                          {index + 1}. {slideLabel(slide)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <div
                aria-hidden={exporting}
                className="pointer-events-none fixed left-[-10000px] top-0"
              >
                <div
                  ref={exportRef}
                  style={{
                    width: format.width,
                    height: format.height,
                    overflow: "hidden",
                  }}
                >
                  {previewSlide ? (
                    <CarouselSlideFrame
                      slide={previewSlide}
                      templateId={templateId}
                      palette={palette}
                      format={format}
                      totalSlides={slides.length}
                      display={display}
                    />
                  ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
