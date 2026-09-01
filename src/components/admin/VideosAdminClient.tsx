"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { toPng } from "html-to-image";
import { Download, Loader2, Play, Save, Square } from "lucide-react";
import {
  SocialCardStyleControls,
} from "@/components/admin/SocialCardStyleControls";
import { useAdminToast } from "@/components/admin/AdminToast";
import {
  SocialCardPreview,
  socialCardFormatSize,
  type SocialCardPreviewProduct,
} from "@/components/admin/SocialCardPreview";
import {
  getSocialCardProject,
  loadSocialCardProjects,
  type SocialCardProject,
} from "@/lib/social-card-projects";
import { formatEuro } from "@/lib/money";
import {
  createEmptyVideoProject,
  DEFAULT_VIDEO_CARD_STYLE,
  getVideoProject,
  projectFromVideoSnapshot,
  upsertVideoProject,
  type VideoCardStyle,
  type VideoSourceMode,
  type VideoTransitionId,
} from "@/lib/video-projects";

type ExportFormat = "webm" | "mp4";

function pickRecorderMime(prefer: ExportFormat): string | undefined {
  const candidates =
    prefer === "mp4"
      ? [
          "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
          "video/mp4;codecs=avc1",
          "video/mp4",
          "video/webm;codecs=h264",
        ]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function proxiedThumb(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return `/api/admin/image-proxy?url=${encodeURIComponent(url.trim())}`;
}

interface AdminProduct extends SocialCardPreviewProduct {
  dealLabel: string;
  dealScore: number;
  dealLevel?: string;
  isActive: boolean;
  availability?: string;
}

function styleFromSocialCard(card: SocialCardProject): VideoCardStyle {
  return {
    formatId: card.formatId,
    layoutId: card.layoutId,
    styleId: card.styleId,
    colorTone: card.colorTone,
    imageFit: card.imageFit,
    imagePadX: card.imagePadX,
    imagePadY: card.imagePadY,
    cardRadius: card.cardRadius,
    cardSurfaceColor: card.cardSurfaceColor,
    floatRotate: card.floatRotate ?? -3,
    floatOffsetX: card.floatOffsetX ?? 0,
    floatOffsetY: card.floatOffsetY ?? 0,
    floatZoom: card.floatZoom ?? 1,
    textPadX: card.textPadX ?? 44,
    textPadY: card.textPadY ?? 40,
  };
}

interface CaptureSlide {
  key: string;
  product: AdminProduct;
  style: VideoCardStyle;
}

const TRANSITIONS: Array<{ id: VideoTransitionId; label: string }> = [
  { id: "fade", label: "Fade / opacidad" },
  { id: "slide", label: "Deslizar horizontal" },
  { id: "slide-up", label: "Deslizar vertical" },
  { id: "zoom", label: "Zoom suave" },
  { id: "wipe", label: "Wipe lateral" },
  { id: "none", label: "Sin transición" },
];

function isOfferProduct(product: AdminProduct): boolean {
  if (!product.isActive) return false;
  if (product.availability === "OUT_OF_STOCK") return false;
  if (product.dealLevel && product.dealLevel !== "NORMAL") return true;
  return product.discountPercentage >= 5;
}

export function VideosAdminClient({
  projectId,
}: {
  projectId: string | null;
}) {
  const router = useRouter();
  const toast = useAdminToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const hydratingRef = useRef(false);

  const [currentId, setCurrentId] = useState<string | null>(projectId);
  const [projectName, setProjectName] = useState("Nuevo vídeo");
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [cardProjects, setCardProjects] = useState<SocialCardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceMode, setSourceMode] = useState<VideoSourceMode>("products");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [onlyOffers, setOnlyOffers] = useState(true);
  const [slideSeconds, setSlideSeconds] = useState(3);
  const [transition, setTransition] = useState<VideoTransitionId>("fade");
  const [transitionMs, setTransitionMs] = useState(500);
  const [cardStyle, setCardStyle] = useState<VideoCardStyle>({
    ...DEFAULT_VIDEO_CARD_STYLE,
  });
  const [previewProduct, setPreviewProduct] =
    useState<SocialCardPreviewProduct | null>(null);
  const [captureStyle, setCaptureStyle] = useState<VideoCardStyle | null>(null);
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("webm");
  const [timelineStatus, setTimelineStatus] = useState<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/products");
        if (!response.ok) throw new Error("No se pudieron cargar productos");
        const data = (await response.json()) as { products?: AdminProduct[] };
        if (!cancelled) {
          setProducts(data.products ?? []);
          setCardProjects(loadSocialCardProjects());
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Error al cargar",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (loading) return;
    if (projectId) {
      const project = getVideoProject(projectId);
      if (!project) {
        toast.error("Vídeo no encontrado.");
        router.replace("/admin/videos");
        return;
      }
      hydratingRef.current = true;
      setCurrentId(project.id);
      setProjectName(project.name);
      setSourceMode(project.sourceMode);
      setSelectedProductIds(project.productIds);
      setSelectedCardIds(project.cardProjectIds);
      setSlideSeconds(project.slideSeconds);
      setTransition(project.transition);
      setTransitionMs(project.transitionMs);
      setCardStyle({ ...DEFAULT_VIDEO_CARD_STYLE, ...project.cardStyle });
      setReady(true);
      window.setTimeout(() => {
        hydratingRef.current = false;
      }, 0);
      return;
    }
    const empty = createEmptyVideoProject();
    setCurrentId(null);
    setProjectName(empty.name);
    setSourceMode("products");
    setSelectedProductIds([]);
    setSelectedCardIds([]);
    setSlideSeconds(3);
    setTransition("fade");
    setTransitionMs(500);
    setCardStyle({ ...DEFAULT_VIDEO_CARD_STYLE });
    setReady(true);
  }, [loading, projectId, router, toast]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyOffers && !isOfferProduct(p)) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.brand ?? "").toLowerCase().includes(q)
      );
    });
  }, [onlyOffers, products, query]);

  const orderedSlides = useMemo((): CaptureSlide[] => {
    if (sourceMode === "cards") {
      return selectedCardIds
        .map((cardId) => {
          const card = getSocialCardProject(cardId);
          if (!card?.productId) return null;
          const product = productById.get(card.productId);
          if (!product) return null;
          return {
            key: cardId,
            product,
            style: styleFromSocialCard(card),
          };
        })
        .filter((item): item is CaptureSlide => item != null);
    }
    return selectedProductIds
      .map((id) => {
        const product = productById.get(id);
        if (!product) return null;
        return { key: id, product, style: cardStyle };
      })
      .filter((item): item is CaptureSlide => item != null);
  }, [
    cardStyle,
    productById,
    selectedCardIds,
    selectedProductIds,
    sourceMode,
  ]);

  const orderedProducts = useMemo(
    () => orderedSlides.map((slide) => slide.product),
    [orderedSlides],
  );

  useEffect(() => {
    setPreviewProduct(orderedSlides[0]?.product ?? null);
    setCaptureStyle(null);
  }, [orderedSlides]);

  const buildSnapshot = useCallback(
    () => ({
      name: projectName.trim() || "Vídeo sin título",
      sourceMode,
      productIds: selectedProductIds,
      cardProjectIds: selectedCardIds,
      slideSeconds,
      transition,
      transitionMs,
      cardStyle,
    }),
    [
      cardStyle,
      projectName,
      selectedCardIds,
      selectedProductIds,
      slideSeconds,
      sourceMode,
      transition,
      transitionMs,
    ],
  );

  const persist = useCallback(
    (options?: { silent?: boolean; navigate?: boolean }) => {
      const snapshot = buildSnapshot();
      if (
        (snapshot.sourceMode === "products" &&
          snapshot.productIds.length === 0) ||
        (snapshot.sourceMode === "cards" && snapshot.cardProjectIds.length === 0)
      ) {
        if (!options?.silent) {
          toast.error("Selecciona al menos un slide.");
        }
        return;
      }

      let id = currentId;
      if (!id) {
        const created = createEmptyVideoProject(snapshot.name);
        id = created.id;
        setCurrentId(id);
        upsertVideoProject(projectFromVideoSnapshot(snapshot, created));
        if (options?.navigate !== false) {
          router.replace(`/admin/videos/${id}`);
        }
      } else {
        const existing = getVideoProject(id);
        upsertVideoProject(
          projectFromVideoSnapshot(snapshot, existing ?? undefined),
        );
      }
      if (!options?.silent) toast.success("Vídeo guardado.");
    },
    [buildSnapshot, currentId, router, toast],
  );

  useEffect(() => {
    if (!ready || !currentId || hydratingRef.current) return;
    const timer = window.setTimeout(() => persist({ silent: true }), 800);
    return () => window.clearTimeout(timer);
  }, [buildSnapshot, currentId, persist, ready]);

  function patchStyle(patch: Partial<VideoCardStyle>) {
    setCardStyle((prev) => ({ ...prev, ...patch }));
  }

  function toggleProduct(id: string) {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCard(id: string) {
    setSelectedCardIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function waitForCaptureReady(productId: string): Promise<void> {
    // Espera a que el nodo offscreen exista con el producto correcto.
    for (let i = 0; i < 50; i++) {
      const root = captureRef.current;
      if (root?.getAttribute("data-product-id") === productId) break;
      await new Promise((r) => window.setTimeout(r, 40));
    }

    const root = captureRef.current;
    if (!root) return;

    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            window.setTimeout(done, 2500);
          }),
      ),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await new Promise((r) => window.setTimeout(r, 80));
  }

  async function captureSlides(): Promise<HTMLImageElement[]> {
    if (orderedSlides.length === 0) return [];
    const images: HTMLImageElement[] = [];

    for (const slide of orderedSlides) {
      flushSync(() => {
        setPreviewProduct(slide.product);
        setCaptureStyle(slide.style);
      });
      await waitForCaptureReady(slide.product.id);
      if (!captureRef.current) continue;
      const dataUrl = await toPng(captureRef.current, {
        cacheBust: true,
        pixelRatio: 1,
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = dataUrl;
      });
      images.push(img);
    }

    flushSync(() => {
      setCaptureStyle(null);
      setPreviewProduct(orderedSlides[0]?.product ?? null);
    });
    return images;
  }

  function drawFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    current: HTMLImageElement,
    next: HTMLImageElement | null,
    progress: number,
    kind: VideoTransitionId,
  ) {
    ctx.clearRect(0, 0, width, height);
    const p = Math.max(0, Math.min(1, progress));

    if (!next || kind === "none" || p <= 0) {
      ctx.drawImage(current, 0, 0, width, height);
      return;
    }

    if (kind === "fade") {
      ctx.globalAlpha = 1 - p;
      ctx.drawImage(current, 0, 0, width, height);
      ctx.globalAlpha = p;
      ctx.drawImage(next, 0, 0, width, height);
      ctx.globalAlpha = 1;
      return;
    }

    if (kind === "slide") {
      ctx.drawImage(current, -p * width, 0, width, height);
      ctx.drawImage(next, (1 - p) * width, 0, width, height);
      return;
    }

    if (kind === "slide-up") {
      ctx.drawImage(current, 0, -p * height, width, height);
      ctx.drawImage(next, 0, (1 - p) * height, width, height);
      return;
    }

    if (kind === "zoom") {
      const scale = 1 + p * 0.12;
      ctx.drawImage(
        current,
        (width - width * scale) / 2,
        (height - height * scale) / 2,
        width * scale,
        height * scale,
      );
      ctx.globalAlpha = p;
      ctx.drawImage(next, 0, 0, width, height);
      ctx.globalAlpha = 1;
      return;
    }

    // wipe
    ctx.drawImage(current, 0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width * p, height);
    ctx.clip();
    ctx.drawImage(next, 0, 0, width, height);
    ctx.restore();
  }

  async function runTimeline(record: boolean, format: ExportFormat = "webm") {
    if (orderedProducts.length === 0) {
      toast.error("Selecciona al menos un producto o tarjeta.");
      return;
    }

    const durationSec = Math.max(1, Math.min(60, Number(slideSeconds) || 3));
    const size = socialCardFormatSize(
      sourceMode === "products"
        ? cardStyle.formatId
        : (getSocialCardProject(selectedCardIds[0]!)?.formatId ?? "story"),
    );
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setTimelineStatus("Renderizando diapositivas…");
    const slides = await captureSlides();
    if (slides.length === 0) {
      setTimelineStatus(null);
      toast.error("No se pudieron renderizar las diapositivas.");
      return;
    }

    const fps = 30;
    const slideMs = Math.round(durationSec * 1000);
    const tMs =
      transition === "none"
        ? 0
        : Math.max(0, Math.min(Math.floor(slideMs / 2), transitionMs));
    const totalMs = slides.length * slideMs;

    setTimelineStatus(
      record
        ? `Grabando ${slides.length}×${durationSec}s…`
        : `Preview ${slides.length}×${durationSec}s…`,
    );

    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    let stream: MediaStream | null = null;
    let usedMime = "video/webm";
    let usedExt: ExportFormat = "webm";

    if (record) {
      stream = canvas.captureStream(fps);
      const preferred = pickRecorderMime(format);
      const fallback = pickRecorderMime("webm");
      const mime = preferred ?? fallback;
      if (!mime) {
        setTimelineStatus(null);
        toast.error("Este navegador no puede grabar vídeo.");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      usedMime = mime;
      usedExt = mime.includes("mp4") || mime.includes("h264") ? "mp4" : "webm";
      if (format === "mp4" && usedExt !== "mp4") {
        toast.error(
          "MP4 no soportado en este navegador; se exportará WebM. Prueba Chrome/Safari recientes.",
        );
      }
      recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 8_000_000,
      });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.start(100);
    }

    const started = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const elapsed = now - started;
        if (elapsed >= totalMs) {
          drawFrame(
            ctx,
            size.width,
            size.height,
            slides[slides.length - 1]!,
            null,
            0,
            "none",
          );
          resolve();
          return;
        }
        const index = Math.min(
          slides.length - 1,
          Math.floor(elapsed / slideMs),
        );
        const local = elapsed - index * slideMs;
        const next = index < slides.length - 1 ? slides[index + 1]! : null;
        const inTransition =
          next != null && tMs > 0 && local > slideMs - tMs;
        const progress = inTransition ? (local - (slideMs - tMs)) / tMs : 0;
        drawFrame(
          ctx,
          size.width,
          size.height,
          slides[index]!,
          inTransition ? next : null,
          progress,
          transition,
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    });

    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder!.onstop = () => resolve();
        recorder!.stop();
      });
      const blob = new Blob(chunks, {
        type: recorder.mimeType || usedMime,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cazaofertas-video-${Date.now()}.${usedExt}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Vídeo ${usedExt.toUpperCase()} descargado (${durationSec}s/slide).`);
    }

    stream?.getTracks().forEach((track) => track.stop());
    setTimelineStatus(null);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-64 items-center justify-center text-stone-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Cargando editor…
      </div>
    );
  }

  const previewScale = 0.28;
  const formatSize = socialCardFormatSize(cardStyle.formatId);
  const chip = (active: boolean): CSSProperties => ({
    borderColor: active ? "#1c1917" : "#d6d3d1",
    background: active ? "#1c1917" : "#fff",
    color: active ? "#fafaf9" : "#1c1917",
  });

  // Estilo efectivo: en modo cards usamos el de la primera tarjeta seleccionada para preview
  const effectiveStyle: VideoCardStyle =
    captureStyle ??
    (sourceMode === "cards" && selectedCardIds[0]
      ? (() => {
          const card = getSocialCardProject(selectedCardIds[0]!);
          if (!card) return cardStyle;
          return styleFromSocialCard(card);
        })()
      : cardStyle);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <Link
            href="/admin/videos"
            className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500 hover:text-ink"
          >
            ← Videos
          </Link>
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            className="mt-2 block w-full max-w-md border-0 border-b border-transparent bg-transparent font-display text-3xl text-ink outline-none focus:border-ink"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => persist()}
            className="admin-btn admin-btn-ghost"
          >
            <Save className="h-3.5 w-3.5" />
            Guardar
          </button>
          <button
            type="button"
            disabled={previewing || exporting}
            onClick={async () => {
              flushSync(() => setPreviewing(true));
              try {
                await runTimeline(false);
              } finally {
                setPreviewing(false);
              }
            }}
            className="admin-btn admin-btn-ghost"
          >
            {previewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Preview
          </button>
          <div className="admin-card flex items-center gap-1 p-1">
            {(["webm", "mp4"] as const).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setExportFormat(fmt)}
                className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={chip(exportFormat === fmt)}
              >
                {fmt}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={previewing || exporting}
            onClick={async () => {
              flushSync(() => setExporting(true));
              try {
                persist({ silent: true, navigate: false });
                await runTimeline(true, exportFormat);
              } finally {
                setExporting(false);
              }
            }}
            className="admin-btn admin-btn-primary"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Exportar {exportFormat.toUpperCase()}
          </button>
          {(previewing || exporting) && (
            <button
              type="button"
              onClick={() => {
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                setPreviewing(false);
                setExporting(false);
                setTimelineStatus(null);
              }}
              className="inline-flex h-11 items-center gap-2 border border-stone-300 px-3 text-xs font-semibold uppercase tracking-[0.12em]"
            >
              <Square className="h-3.5 w-3.5" />
              Parar
            </button>
          )}
        </div>
        {timelineStatus ? (
          <p className="mt-3 w-full text-xs text-stone-500">{timelineStatus}</p>
        ) : null}
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Fuente de slides
            </p>
            <div className="mt-2 flex gap-2">
              {(
                [
                  ["products", "Desde productos"],
                  ["cards", "Desde tarjetas guardadas"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSourceMode(id)}
                  className="rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em]"
                  style={chip(sourceMode === id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-stone-500">
              {sourceMode === "products"
                ? "Puedes configurar el estilo de tarjeta (igual que Redes/Tarjetas)."
                : "Se usa el estilo ya guardado de cada tarjeta; no se reconfigura aquí."}
            </p>
          </div>

          {sourceMode === "products" ? (
            <>
              <div className="flex flex-wrap gap-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar producto…"
                  className="min-w-[200px] flex-1 border border-stone-300 px-3 py-2 text-sm"
                />
                <label className="inline-flex items-center gap-2 text-xs text-stone-600">
                  <input
                    type="checkbox"
                    checked={onlyOffers}
                    onChange={(event) => setOnlyOffers(event.target.checked)}
                  />
                  Solo ofertas activas
                </label>
              </div>
              {loading ? (
                <p className="text-sm text-stone-500">Cargando productos…</p>
              ) : (
                <ul className="max-h-[42vh] divide-y divide-stone-200 admin-table-wrap">
                  {filteredProducts.map((product) => {
                    const thumb = proxiedThumb(product.imageUrl);
                    return (
                      <li key={product.id}>
                        <label className="flex cursor-pointer gap-3 px-3 py-2.5 hover:bg-stone-50">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => toggleProduct(product.id)}
                            className="mt-2 shrink-0"
                          />
                          <span className="relative h-14 w-14 shrink-0 overflow-hidden border border-stone-200 bg-stone-100">
                            {thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={thumb}
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
                            <span className="line-clamp-2 text-sm font-medium leading-snug text-ink">
                              {product.title}
                            </span>
                            <span className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[11px] text-stone-500">
                              <span className="font-semibold text-ink">
                                {formatEuro(product.currentPrice)}
                              </span>
                              {product.previousPrice != null &&
                              product.previousPrice >
                                product.currentPrice ? (
                                <span className="line-through">
                                  {formatEuro(product.previousPrice)}
                                </span>
                              ) : null}
                              <span>
                                {isOfferProduct(product) ? (
                                  <span className="text-amber-700">Oferta</span>
                                ) : (
                                  <span>Normal</span>
                                )}
                              </span>
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="admin-card p-4 md:p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                  Estilo de tarjeta (productos)
                </p>
                <SocialCardStyleControls
                  value={cardStyle}
                  onChange={(patch) => patchStyle(patch)}
                  onNotify={(message) => toast.error(message)}
                />
              </div>
            </>
          ) : (
            <ul className="max-h-[52vh] divide-y divide-stone-200 admin-table-wrap">
              {cardProjects.length === 0 ? (
                <li className="px-4 py-8 text-sm text-stone-500">
                  No hay tarjetas guardadas. Crea alguna en Redes / Tarjetas.
                </li>
              ) : (
                cardProjects.map((card) => (
                  <li key={card.id}>
                    <label className="flex cursor-pointer gap-3 px-3 py-2.5 hover:bg-stone-50">
                      <input
                        type="checkbox"
                        checked={selectedCardIds.includes(card.id)}
                        onChange={() => toggleCard(card.id)}
                        className="mt-1"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {card.name}
                        </span>
                        <span className="text-[11px] text-stone-500">
                          {card.productTitle ?? "Sin producto"} ·{" "}
                          {card.formatId} · {card.layoutId}
                        </span>
                      </span>
                    </label>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <div className="admin-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Timeline
            </p>
            <label className="mt-3 block text-sm">
              Segundos / slide
              <input
                type="number"
                min={1}
                max={60}
                step={0.5}
                value={slideSeconds}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setSlideSeconds(
                    Number.isFinite(next)
                      ? Math.max(1, Math.min(60, next))
                      : 3,
                  );
                }}
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              />
              <span className="mt-1 block text-[11px] text-stone-500">
                1–60 s por diapositiva (el preview usa este valor tras renderizar).
              </span>
            </label>
            <label className="mt-3 block text-sm">
              Transición
              <select
                value={transition}
                onChange={(event) =>
                  setTransition(event.target.value as VideoTransitionId)
                }
                className="mt-1 w-full border border-stone-300 px-3 py-2"
              >
                {TRANSITIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              Duración transición (ms)
              <input
                type="number"
                min={0}
                max={2000}
                step={50}
                disabled={transition === "none"}
                value={transitionMs}
                onChange={(event) =>
                  setTransitionMs(Number(event.target.value) || 0)
                }
                className="mt-1 w-full border border-stone-300 px-3 py-2 disabled:opacity-50"
              />
            </label>
            <p className="mt-3 text-[11px] text-stone-500">
              Slides: {orderedProducts.length} · Formato export:{" "}
              {effectiveStyle.formatId}
            </p>
          </div>

          <div className="overflow-hidden border border-stone-200 bg-stone-100 p-3">
            <p className="mb-2 text-center text-[11px] text-stone-500">
              {previewing || exporting
                ? (timelineStatus ?? "Timeline")
                : "Preview tarjeta"}
            </p>
            <canvas
              ref={canvasRef}
              className={`mx-auto max-w-full border border-stone-200 bg-white ${
                previewing || exporting ? "block" : "hidden"
              }`}
              style={{
                width: formatSize.width * previewScale,
                height: "auto",
              }}
            />
            {!(previewing || exporting) ? (
              <div
                className="mx-auto overflow-hidden bg-white"
                style={{
                  width: formatSize.width * previewScale,
                  height: formatSize.height * previewScale,
                }}
              >
                {previewProduct ? (
                  <SocialCardPreview
                    key={`idle-${previewProduct.id}`}
                    product={previewProduct}
                    style={effectiveStyle}
                    scale={previewScale}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-stone-400">
                    Sin slides
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Escenario offscreen para capturar frames con toPng */}
      <div className="pointer-events-none fixed -left-[4000px] top-0">
        {previewProduct ? (
          <SocialCardPreview
            key={`capture-${previewProduct.id}-${effectiveStyle.layoutId}-${effectiveStyle.formatId}`}
            product={previewProduct}
            style={effectiveStyle}
            cardRef={captureRef}
          />
        ) : null}
      </div>
    </div>
  );
}
