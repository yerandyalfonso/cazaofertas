"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { Download, Droplet, Loader2, Pipette, Save } from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { formatEuro } from "@/lib/money";
import {
  formatSocialProjectDate,
  getSocialCardProject,
  projectFromSnapshot,
  upsertSocialCardProject,
} from "@/lib/social-card-projects";

interface SocialProduct {
  id: string;
  title: string;
  slug: string;
  asin: string;
  brand: string | null;
  amazonUrl: string;
  imageUrl?: string | null;
  currentPrice: number;
  previousPrice: number | null;
  referencePrice: number;
  dealScore: number;
  dealLabel: string;
  discountPercentage: number;
  lastCheckedAt: string | null;
}

type FormatId = "square" | "story" | "landscape" | "classic";
type StyleId = "cream" | "border" | "pastel" | "sunset";
/** Layout de la tarjeta light. `minimal` = diseño actual (por defecto). */
type LayoutId = "minimal" | "float" | "banner" | "seal";
type ImageFit =
  | "contain"
  | "cover"
  | "cover-top"
  | "blur"
  | "smart";

const IMAGE_FITS: Array<{
  id: ImageFit;
  label: string;
  hint: string;
}> = [
  {
    id: "contain",
    label: "Contain",
    hint: "Imagen completa + color de fondo",
  },
  {
    id: "cover",
    label: "Cover",
    hint: "Rellena y recorta al centro",
  },
  {
    id: "cover-top",
    label: "Cover top",
    hint: "Rellena priorizando la parte superior",
  },
  {
    id: "blur",
    label: "Blur fill",
    hint: "Completa + fondo difuminado de la foto",
  },
  {
    id: "smart",
    label: "Smart",
    hint: "Elige solo: cover si encaja, si no blur",
  },
];

interface ExportFormat {
  id: FormatId;
  label: string;
  ratio: string;
  hint: string;
  width: number;
  height: number;
}

interface TemplateStyle {
  id: StyleId;
  label: string;
  hint: string;
}

const FORMATS: ExportFormat[] = [
  {
    id: "square",
    label: "Cuadrado",
    ratio: "1:1",
    hint: "Instagram Feed / Telegram",
    width: 1080,
    height: 1080,
  },
  {
    id: "story",
    label: "Vertical",
    ratio: "9:16",
    hint: "Stories / Reels / TikTok",
    width: 1080,
    height: 1920,
  },
  {
    id: "landscape",
    label: "Horizontal",
    ratio: "16:9",
    hint: "Twitter / YouTube / Banners",
    width: 1920,
    height: 1080,
  },
  {
    id: "classic",
    label: "Clásico",
    ratio: "4:3",
    hint: "Posts / carousels",
    width: 1080,
    height: 810,
  },
];

const LAYOUTS: Array<{ id: LayoutId; label: string; hint: string }> = [
  {
    id: "minimal",
    label: "Minimalista",
    hint: "Diseño actual: tarjeta flotante, imagen limpia y precios horizontales",
  },
  {
    id: "float",
    label: "Flotante Asimétrico",
    hint: "Imagen superpuesta en diagonal sobre panel de texto desplazado",
  },
  {
    id: "banner",
    label: "Header Banner",
    hint: "Franja superior sutil con tono de marca / categoría",
  },
  {
    id: "seal",
    label: "Sello Geométrico",
    hint: "Misma tarjeta light con badge de descuento tipo etiqueta/sello",
  },
];

const STYLES: TemplateStyle[] = [
  {
    id: "cream",
    label: "Soft Cream",
    hint: "Degradado cálido coral / melocotón",
  },
  {
    id: "border",
    label: "Border",
    hint: "Pasteles alegres (ámbar, rosa, cielo)",
  },
  {
    id: "pastel",
    label: "Soft Pastel",
    hint: "Degradado suave melocotón → lavanda",
  },
  {
    id: "sunset",
    label: "Sunset",
    hint: "Naranja y violeta difuminados",
  },
];

const STYLE_THEME: Record<
  StyleId,
  {
    canvasBg: string;
    canvasOverlay?: string;
    cardBg: string;
    cardBorder?: string;
    cardShadow?: string;
    brandColor: string;
    titleColor: string;
    priceAccent: string;
    priceStrike: string;
    fallbackImageBg: string;
    previewChrome: string;
    bannerBg: string;
    sealBg: string;
  }
> = {
  cream: {
    canvasBg:
      "linear-gradient(145deg, #fff8f1 0%, #ffe9d6 34%, #fde8ef 68%, #eaf4ff 100%)",
    canvasOverlay:
      "radial-gradient(ellipse 55% 42% at 12% 18%, rgba(255,255,255,0.88) 0%, transparent 55%), radial-gradient(ellipse 42% 38% at 88% 14%, rgba(255,186,140,0.38) 0%, transparent 52%), radial-gradient(ellipse 40% 42% at 72% 86%, rgba(255,170,190,0.28) 0%, transparent 55%), radial-gradient(ellipse 35% 30% at 18% 78%, rgba(170,225,205,0.24) 0%, transparent 50%)",
    cardBg: "#FFFCF8",
    cardShadow: "0 28px 70px -26px rgba(180, 90, 50, 0.28)",
    brandColor: "#c2410c",
    titleColor: "#292524",
    priceAccent: "#ea580c",
    priceStrike: "#b8a99a",
    fallbackImageBg: "#FFFCF8",
    previewChrome: "#fff1e6",
    bannerBg: "linear-gradient(90deg, #fdba74 0%, #fb7185 55%, #fda4af 100%)",
    sealBg: "linear-gradient(145deg, #f97316 0%, #e11d48 100%)",
  },
  border: {
    canvasBg:
      "linear-gradient(135deg, #fffaf3 0%, #fef3c7 30%, #fce7f3 62%, #e0f2fe 100%)",
    canvasOverlay:
      "radial-gradient(ellipse 50% 40% at 20% 15%, rgba(255,255,255,0.92) 0%, transparent 55%), radial-gradient(ellipse 45% 35% at 90% 20%, rgba(251,146,60,0.28) 0%, transparent 50%), radial-gradient(ellipse 40% 40% at 75% 85%, rgba(244,114,182,0.22) 0%, transparent 52%), radial-gradient(ellipse 35% 30% at 10% 80%, rgba(56,189,248,0.2) 0%, transparent 50%)",
    cardBg: "#ffffff",
    cardShadow: "0 30px 70px -24px rgba(249, 115, 22, 0.22)",
    brandColor: "#db2777",
    titleColor: "#1e293b",
    priceAccent: "#f97316",
    priceStrike: "#94a3b8",
    fallbackImageBg: "#ffffff",
    previewChrome: "#fff7ed",
    bannerBg: "linear-gradient(90deg, #fb923c 0%, #f472b6 50%, #38bdf8 100%)",
    sealBg: "linear-gradient(145deg, #f97316 0%, #db2777 100%)",
  },
  pastel: {
    canvasBg:
      "linear-gradient(145deg, #fdeee4 0%, #f6d9cf 38%, #e9d8f4 70%, #dde8f7 100%)",
    canvasOverlay:
      "radial-gradient(ellipse 50% 40% at 12% 18%, rgba(255,255,255,0.82) 0%, transparent 55%), radial-gradient(ellipse 45% 35% at 88% 12%, rgba(244,163,148,0.32) 0%, transparent 50%), radial-gradient(ellipse 40% 45% at 70% 88%, rgba(167,139,250,0.2) 0%, transparent 55%)",
    cardBg: "#ffffff",
    cardShadow:
      "0 40px 90px -24px rgba(90, 45, 35, 0.35), 0 12px 28px -10px rgba(90, 45, 35, 0.16)",
    brandColor: "#8b5e3c",
    titleColor: "#3d2c24",
    priceAccent: "#f97316",
    priceStrike: "#b6a49a",
    fallbackImageBg: "#ffffff",
    previewChrome: "#f7efe6",
    bannerBg: "linear-gradient(90deg, #f0ab9a 0%, #c4b5fd 55%, #93c5fd 100%)",
    sealBg: "linear-gradient(145deg, #fb923c 0%, #e11d48 100%)",
  },
  sunset: {
    canvasBg:
      "linear-gradient(145deg, #fff4e6 0%, #fdba74 26%, #d8b4fe 64%, #a78bfa 100%)",
    canvasOverlay:
      "radial-gradient(ellipse 55% 45% at 10% 15%, rgba(255,247,237,0.88) 0%, transparent 55%), radial-gradient(ellipse 48% 40% at 92% 18%, rgba(249,115,22,0.38) 0%, transparent 50%), radial-gradient(ellipse 45% 42% at 78% 88%, rgba(139,92,246,0.36) 0%, transparent 55%), radial-gradient(ellipse 35% 30% at 15% 82%, rgba(251,146,60,0.28) 0%, transparent 50%)",
    cardBg: "#fffbeb",
    cardShadow:
      "0 36px 80px -22px rgba(124, 58, 237, 0.4), 0 14px 30px -12px rgba(249, 115, 22, 0.28)",
    brandColor: "#7c3aed",
    titleColor: "#1e1b4b",
    priceAccent: "#ea580c",
    priceStrike: "#a78bfa",
    fallbackImageBg: "#fffbeb",
    previewChrome: "#f5e8ff",
    bannerBg: "linear-gradient(90deg, #fb923c 0%, #a855f7 55%, #7c3aed 100%)",
    sealBg: "linear-gradient(145deg, #f97316 0%, #7c3aed 100%)",
  },
};

type CardTheme = (typeof STYLE_THEME)[StyleId];

/**
 * Atajos de las 4 presets (solo saltan el slider a un punto).
 * El color lo genera `themeFromTone` de forma continua, no mezclando esas 4.
 */
const PRESET_TONE: Record<StyleId, number> = {
  cream: 8,
  border: 38,
  sunset: 58,
  pastel: 86,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hsl(h: number, s: number, l: number, a = 1): string {
  const hh = ((h % 360) + 360) % 360;
  if (a < 1) {
    return `hsla(${Math.round(hh)} ${Math.round(s)}% ${Math.round(l)}% / ${Number(a.toFixed(3))})`;
  }
  return `hsl(${Math.round(hh)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function toneLabel(tone: number): string {
  if (tone < 34) return "Normal";
  if (tone < 67) return "Vibrante";
  return "Pastel";
}

function toneHueDegrees(tone: number): number {
  const t = Math.min(100, Math.max(0, tone)) / 100;
  const band = t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
  const local = band === 0 ? t * 3 : band === 1 ? (t - 1 / 3) * 3 : (t - 2 / 3) * 3;
  return Math.round((local * 360 + band * 47) % 360);
}

/**
 * Slider 0–100 → infinidad de fondos light con degradados.
 * Cada tercio es un modo (normal / vibrante / pastel) y dentro rota el matiz
 * completo (~360°), así no “salta” entre las 4 presets fijas.
 */
function themeFromTone(toneInput: number): CardTheme {
  const tone = Math.min(100, Math.max(0, toneInput));
  const t = tone / 100;

  const band = t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2;
  const local = band === 0 ? t * 3 : band === 1 ? (t - 1 / 3) * 3 : (t - 2 / 3) * 3;

  const hue = (local * 360 + band * 47) % 360;
  const h2 = (hue + 42 + local * 28) % 360;
  const h3 = (hue + 86 + local * 36) % 360;
  const h4 = (hue + 148 + band * 22) % 360;

  let sat: number;
  let satSpread: number;
  let light0: number;
  let lightSpread: number;
  let overlayStrength: number;
  let accentSat: number;
  let brandL: number;

  if (band === 0) {
    sat = lerp(40, 58, local);
    satSpread = 20;
    light0 = lerp(94, 89, local);
    lightSpread = 12;
    overlayStrength = lerp(0.3, 0.44, local);
    accentSat = 80;
    brandL = 36;
  } else if (band === 1) {
    sat = lerp(72, 94, local);
    satSpread = 24;
    light0 = lerp(89, 82, local);
    lightSpread = 16;
    overlayStrength = lerp(0.46, 0.62, local);
    accentSat = 92;
    brandL = 40;
  } else {
    sat = lerp(48, 26, local);
    satSpread = 16;
    light0 = lerp(95, 97, local);
    lightSpread = 7;
    overlayStrength = lerp(0.24, 0.34, local);
    accentSat = 74;
    brandL = 42;
  }

  const c1 = hsl(hue, sat, light0);
  const c2 = hsl(h2, Math.min(98, sat + satSpread * 0.4), light0 - lightSpread * 0.4);
  const c3 = hsl(h3, Math.min(98, sat + satSpread * 0.85), light0 - lightSpread * 0.85);
  const c4 = hsl(h4, Math.max(16, sat - 4), light0 - lightSpread * 0.3);

  const angle = 128 + Math.round(local * 52 + band * 18);
  const canvasBg = `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 26%, ${c3} 58%, ${c4} 100%)`;

  const canvasOverlay = [
    `radial-gradient(ellipse 60% 48% at ${10 + local * 22}% ${12 + band * 8}%, ${hsl(0, 0, 100, 0.92)} 0%, transparent 58%)`,
    `radial-gradient(ellipse 50% 42% at ${88 - local * 14}% ${18 + local * 16}%, ${hsl(hue, Math.min(98, sat + 12), 64, overlayStrength)} 0%, transparent 55%)`,
    `radial-gradient(ellipse 46% 50% at ${68 + local * 12}% ${86 - band * 6}%, ${hsl(h3, Math.min(98, sat + 8), 62, overlayStrength * 0.9)} 0%, transparent 57%)`,
    `radial-gradient(ellipse 38% 34% at ${14 + band * 10}% ${76 - local * 14}%, ${hsl(h4, sat + 4, 70, overlayStrength * 0.75)} 0%, transparent 52%)`,
  ].join(", ");

  const cardBg = band === 0 ? "#FFFCF8" : band === 1 ? "#fffbeb" : "#ffffff";
  const titleColor = band === 1 ? "#1e1b4b" : band === 0 ? "#292524" : "#2a2438";
  const brandColor = hsl((hue + 10) % 360, Math.min(72, sat + 8), brandL);
  const priceAccent = hsl(
    band === 2 ? (22 + local * 18) % 360 : (hue + 14) % 360,
    accentSat,
    band === 1 ? 47 : 50,
  );
  const priceStrike = hsl(h3, Math.max(10, sat * 0.3), 64);
  const previewChrome = hsl(hue, Math.max(16, sat * 0.4), 94);
  const shadowA = hsl(h3, 48, 36, band === 1 ? 0.4 : 0.28);
  const shadowB = hsl(hue, 52, 40, band === 1 ? 0.28 : 0.18);

  return {
    canvasBg,
    canvasOverlay,
    cardBg,
    cardShadow:
      band === 1
        ? `0 36px 80px -22px ${shadowA}, 0 14px 30px -12px ${shadowB}`
        : `0 28px 70px -26px ${shadowA}`,
    brandColor,
    titleColor,
    priceAccent,
    priceStrike,
    fallbackImageBg: cardBg,
    previewChrome,
    bannerBg: `linear-gradient(90deg, ${hsl(hue, sat + 12, 60)} 0%, ${hsl(h2, sat + 8, 58)} 48%, ${hsl(h3, sat + 4, 62)} 100%)`,
    sealBg: `linear-gradient(145deg, ${hsl((hue + 6) % 360, accentSat, 52)} 0%, ${hsl((h3 + 12) % 360, Math.min(90, sat + 14), 45)} 100%)`,
  };
}

function proxiedImageUrl(url: string): string {
  return `/api/admin/image-proxy?url=${encodeURIComponent(url)}`;
}

function slugifyFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function previewScaleFor(format: ExportFormat): number {
  const maxPreviewWidth = 560;
  const maxPreviewHeight = 720;
  return Math.min(
    maxPreviewWidth / format.width,
    maxPreviewHeight / format.height,
    0.55,
  );
}

function PriceRow({
  current,
  previous,
  priceSize,
  strikeSize,
  accent,
  strike,
}: {
  current: number;
  previous: number | null;
  priceSize: number;
  strikeSize: number;
  accent: string;
  strike: string;
}) {
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-5 gap-y-1"
      style={{ lineHeight: 1 }}
    >
      <span
        className="font-extrabold tracking-tight"
        style={{ fontSize: priceSize, color: accent }}
      >
        {formatEuro(current)}
      </span>
      {previous != null ? (
        <span
          className="font-medium line-through"
          style={{ fontSize: strikeSize, color: strike }}
        >
          {formatEuro(previous)}
        </span>
      ) : null}
    </div>
  );
}

function detectEdgeBackgroundColor(img: HTMLImageElement): string | null {
  try {
    const maxSide = 160;
    const ratio = Math.min(
      1,
      maxSide / Math.max(img.naturalWidth, img.naturalHeight, 1),
    );
    const w = Math.max(8, Math.round(img.naturalWidth * ratio));
    const h = Math.max(8, Math.round(img.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    const inset = 2;
    const samples: Array<[number, number]> = [
      [inset, inset],
      [w - 1 - inset, inset],
      [inset, h - 1 - inset],
      [w - 1 - inset, h - 1 - inset],
      [Math.floor(w / 2), inset],
      [Math.floor(w / 2), h - 1 - inset],
      [inset, Math.floor(h / 2)],
      [w - 1 - inset, Math.floor(h / 2)],
    ];

    // Cuadrícula pequeña en cada esquina (más robusto que 1 px).
    const colors: Array<{ r: number; g: number; b: number }> = [];
    for (const [sx, sy] of samples) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = Math.min(w - 1, Math.max(0, sx + dx));
          const y = Math.min(h - 1, Math.max(0, sy + dy));
          const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
          if ((a ?? 0) < 200) continue;
          colors.push({ r: r ?? 0, g: g ?? 0, b: b ?? 0 });
        }
      }
    }
    if (colors.length < 4) return null;

    // Cuantizar y elegir el color de borde más frecuente.
    const buckets = new Map<
      string,
      { r: number; g: number; b: number; n: number }
    >();
    for (const c of colors) {
      const key = `${Math.round(c.r / 12) * 12},${Math.round(c.g / 12) * 12},${Math.round(c.b / 12) * 12}`;
      const prev = buckets.get(key);
      if (prev) {
        prev.r += c.r;
        prev.g += c.g;
        prev.b += c.b;
        prev.n += 1;
      } else {
        buckets.set(key, { r: c.r, g: c.g, b: c.b, n: 1 });
      }
    }

    let best: { r: number; g: number; b: number; n: number } | null = null;
    for (const value of buckets.values()) {
      if (!best || value.n > best.n) best = value;
    }
    if (!best) return null;

    const r = Math.round(best.r / best.n);
    const g = Math.round(best.g / best.n);
    const b = Math.round(best.b / best.n);
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

function ProductImage({
  src,
  ready,
  onReady,
  onError,
  onBgColor,
  fit,
  areaWidth,
  areaHeight,
  zoom = 1,
}: {
  src: string | null;
  ready: boolean;
  onReady: () => void;
  onError: () => void;
  onBgColor: (color: string | null) => void;
  fit: ImageFit;
  /** Proporción del área de imagen (para smart). */
  areaWidth: number;
  areaHeight: number;
  zoom?: number;
}) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(
    null,
  );
  const zoomScale = Math.max(0.4, Math.min(2, zoom));

  if (!src) {
    return (
      <div
        className="flex items-center justify-center text-sm opacity-40"
        style={{ width: "100%", height: "100%", minHeight: 240 }}
      >
        Sin imagen
      </div>
    );
  }

  const resolvedFit = (() => {
    if (fit !== "smart") return fit;
    if (!natural) return "blur";
    const imgRatio = natural.w / Math.max(natural.h, 1);
    const areaRatio = areaWidth / Math.max(areaHeight, 1);
    const diff = Math.abs(imgRatio - areaRatio) / areaRatio;
    // Si la proporción es parecida → cover; si no → blur (sin recortar el producto).
    return diff < 0.22 ? "cover" : "blur";
  })();

  const handleLoad = (el: HTMLImageElement) => {
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    onBgColor(detectEdgeBackgroundColor(el));
    onReady();
  };

  if (resolvedFit === "blur") {
    return (
      <div className="relative h-full w-full overflow-hidden">
        {/* Fondo: misma foto ampliada y difuminada */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          aria-hidden
          crossOrigin="anonymous"
          className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover"
          style={{
            filter: "blur(28px) saturate(1.05)",
            transform: "scale(1.15)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: "rgba(255,255,255,0.12)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          crossOrigin="anonymous"
          onLoad={(event) => handleLoad(event.currentTarget)}
          onError={() => {
            onBgColor(null);
            onError();
          }}
          className="relative z-[1] h-full w-full object-contain"
          style={{
            opacity: ready ? 1 : 0.85,
            transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
            transformOrigin: "center center",
          }}
        />
      </div>
    );
  }

  const objectPosition =
    resolvedFit === "cover-top" ? "center top" : "center center";
  const objectFit =
    resolvedFit === "contain" ? "contain" : "cover";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      crossOrigin="anonymous"
      onLoad={(event) => handleLoad(event.currentTarget)}
      onError={() => {
        onBgColor(null);
        onError();
      }}
      className="h-full w-full"
      style={{
        objectFit,
        objectPosition,
        opacity: ready ? 1 : 0.85,
        transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
        transformOrigin: "center center",
      }}
    />
  );
}

export function SocialAdminClient({
  projectId,
}: {
  projectId: string | null;
}) {
  const router = useRouter();
  const toast = useAdminToast();
  const cardRef = useRef<HTMLDivElement>(null);
  const hydratingRef = useRef(false);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    projectId,
  );
  const [projectName, setProjectName] = useState("Nueva tarjeta");
  const [editorReady, setEditorReady] = useState(false);

  const [products, setProducts] = useState<SocialProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [formatId, setFormatId] = useState<FormatId>("story");
  const [layoutId, setLayoutId] = useState<LayoutId>("minimal");
  const [styleId, setStyleId] = useState<StyleId>("sunset");
  const [colorTone, setColorTone] = useState(PRESET_TONE.sunset);
  const [imageFit, setImageFit] = useState<ImageFit>("contain");
  const [imagePadX, setImagePadX] = useState(40);
  const [imagePadY, setImagePadY] = useState(40);
  const [cardRadius, setCardRadius] = useState(40);
  const [cardSurfaceColor, setCardSurfaceColor] = useState("#ffffff");
  const [floatRotate, setFloatRotate] = useState(-3);
  const [floatOffsetX, setFloatOffsetX] = useState(0);
  const [floatOffsetY, setFloatOffsetY] = useState(0);
  const [floatZoom, setFloatZoom] = useState(1);
  const [textPadX, setTextPadX] = useState(44);
  const [textPadY, setTextPadY] = useState(40);
  const [exporting, setExporting] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageBgColor, setImageBgColor] = useState<string | null>(null);
  const [pickingColor, setPickingColor] = useState(false);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId],
  );

  const buildSnapshot = useCallback(
    () => ({
      name: projectName.trim() || "Tarjeta sin título",
      productId: selectedId || null,
      productTitle: selected?.title ?? null,
      formatId,
      layoutId,
      styleId,
      colorTone,
      imageFit,
      imagePadX,
      imagePadY,
      cardRadius,
      cardSurfaceColor,
      floatRotate,
      floatOffsetX,
      floatOffsetY,
      floatZoom,
      textPadX,
      textPadY,
    }),
    [
      projectName,
      selectedId,
      selected?.title,
      formatId,
      layoutId,
      styleId,
      colorTone,
      imageFit,
      imagePadX,
      imagePadY,
      cardRadius,
      cardSurfaceColor,
      floatRotate,
      floatOffsetX,
      floatOffsetY,
      floatZoom,
      textPadX,
      textPadY,
    ],
  );

  const applyProject = useCallback(
    (project: NonNullable<ReturnType<typeof getSocialCardProject>>) => {
      hydratingRef.current = true;
      setCurrentProjectId(project.id);
      setProjectName(project.name);
      setSelectedId(project.productId ?? "");
      setFormatId(project.formatId);
      setLayoutId(project.layoutId);
      setStyleId(project.styleId);
      setColorTone(project.colorTone);
      setImageFit(project.imageFit);
      setImagePadX(project.imagePadX);
      setImagePadY(project.imagePadY);
      setCardRadius(project.cardRadius);
      setCardSurfaceColor(project.cardSurfaceColor ?? "#ffffff");
      setFloatRotate(project.floatRotate ?? -3);
      setFloatOffsetX(project.floatOffsetX ?? 0);
      setFloatOffsetY(project.floatOffsetY ?? 0);
      setFloatZoom(project.floatZoom ?? 1);
      setTextPadX(project.textPadX ?? 44);
      setTextPadY(project.textPadY ?? 40);
      window.setTimeout(() => {
        hydratingRef.current = false;
      }, 0);
    },
    [],
  );

  const persistCurrentProject = useCallback(
    (options?: { silent?: boolean }) => {
      const id = currentProjectId ?? projectId;
      if (!id) return;

      const existing = getSocialCardProject(id);
      if (!existing) return;

      upsertSocialCardProject(
        projectFromSnapshot(buildSnapshot(), existing),
      );

      if (!options?.silent) {
        toast.success("Tarjeta guardada.");
      }
    },
    [buildSnapshot, currentProjectId, projectId, toast],
  );

  function saveCurrentProject() {
    const existingId = projectId ?? currentProjectId;
    const existing = existingId ? getSocialCardProject(existingId) : undefined;
    const saved = projectFromSnapshot(buildSnapshot(), existing ?? undefined);

    upsertSocialCardProject(saved);
    setCurrentProjectId(saved.id);

    if (!projectId) {
      router.replace(`/admin/social/${saved.id}`);
    }

    toast.success("Tarjeta guardada.");
  }

  useEffect(() => {
    if (projectId) {
      const project = getSocialCardProject(projectId);
      if (!project) {
        toast.error("Tarjeta no encontrada.");
        router.replace("/admin/social");
        return;
      }
      applyProject(project);
      setEditorReady(true);
      return;
    }

    setCurrentProjectId(null);
    setProjectName("Nueva tarjeta");
    setSelectedId("");
    setFormatId("story");
    setLayoutId("minimal");
    setStyleId("sunset");
    setColorTone(PRESET_TONE.sunset);
    setImageFit("contain");
    setImagePadX(40);
    setImagePadY(40);
    setCardRadius(40);
    setCardSurfaceColor("#ffffff");
    setFloatRotate(-3);
    setFloatOffsetX(0);
    setFloatOffsetY(0);
    setFloatZoom(1);
    setTextPadX(44);
    setTextPadY(40);
    setEditorReady(true);
  }, [applyProject, projectId, router, toast]);

  useEffect(() => {
    const id = currentProjectId ?? projectId;
    if (!id || !editorReady || hydratingRef.current) return;
    const timer = window.setTimeout(() => {
      persistCurrentProject({ silent: true });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    cardRadius,
    cardSurfaceColor,
    floatRotate,
    floatOffsetX,
    floatOffsetY,
    floatZoom,
    textPadX,
    textPadY,
    colorTone,
    currentProjectId,
    editorReady,
    formatId,
    imageFit,
    imagePadX,
    imagePadY,
    layoutId,
    persistCurrentProject,
    projectId,
    projectName,
    selectedId,
    styleId,
  ]);

  const format = FORMATS.find((item) => item.id === formatId) ?? FORMATS[0];
  const layout = LAYOUTS.find((item) => item.id === layoutId) ?? LAYOUTS[0];
  const theme = useMemo(() => themeFromTone(colorTone), [colorTone]);
  const toneName = toneLabel(colorTone);
  const scale = previewScaleFor(format);
  const isLandscape = format.id === "landscape";
  const isStory = format.id === "story";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/products");
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        products?: SocialProduct[];
      };
      if (!response.ok || !data.ok) {
        toast.error(data.error ?? "No se pudieron cargar productos.");
        return;
      }
      const list = data.products ?? [];
      setProducts(list);
      setSelectedId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch {
      toast.error("Error de red al cargar productos.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!editorReady) return;
    void load();
  }, [editorReady, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.asin.toLowerCase().includes(q) ||
        (p.brand?.toLowerCase().includes(q) ?? false),
    );
  }, [products, query]);

  const discount = useMemo(() => {
    if (!selected) return 0;
    if (selected.discountPercentage > 0) {
      return Math.round(selected.discountPercentage);
    }
    const ref = selected.previousPrice ?? selected.referencePrice;
    if (ref > selected.currentPrice) {
      return Math.round(((ref - selected.currentPrice) / ref) * 100);
    }
    return 0;
  }, [selected]);

  const previousPrice = selected
    ? (selected.previousPrice ??
      (selected.referencePrice > selected.currentPrice
        ? selected.referencePrice
        : null))
    : null;

  const displayImageUrl = selected?.imageUrl
    ? proxiedImageUrl(selected.imageUrl)
    : null;

  useEffect(() => {
    setImageReady(false);
    setImageBgColor(null);
  }, [displayImageUrl, formatId, styleId, layoutId, colorTone]);

  async function downloadPng() {
    if (!cardRef.current || !selected) {
      toast.error("Selecciona un producto primero.");
      return;
    }
    if (displayImageUrl && !imageReady) {
      toast.info("Espera a que cargue la imagen del producto.");
      return;
    }

    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
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

      const link = document.createElement("a");
      link.download = `cazaoferta-${layout.id}-${toneName.toLowerCase()}-${Math.round(colorTone)}-${format.ratio.replace(":", "x")}-${slugifyFilename(selected.title) || selected.asin}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(
        `PNG ${layout.label} · ${toneName} · ${format.width}×${format.height} descargado.`,
      );
    } catch (error) {
      console.error(error);
      toast.error(
        "No se pudo generar el PNG. Revisa que la imagen del producto cargue bien.",
      );
    } finally {
      setExporting(false);
    }
  }

  const titleSize = isLandscape
    ? 36
    : isStory
      ? 44
      : format.id === "classic"
        ? 32
        : 36;
  const brandSize = isLandscape ? 36 : isStory ? 42 : 34;
  const priceSize = isLandscape ? 58 : isStory ? 72 : 60;
  const strikeSize = isLandscape ? 36 : isStory ? 42 : 34;
  const pad = isLandscape ? 56 : isStory ? 64 : 48;
  const imageAreaBg =
    imageFit === "blur"
      ? (imageBgColor ?? theme.fallbackImageBg)
      : cardSurfaceColor;

  const onImageError = () => {
    setImageReady(false);
    toast.error("No se pudo cargar la imagen del producto.");
  };

  function renderBadge(variant: "pill" | "seal" = "pill") {
    if (discount <= 0) return null;
    const isVibrant = colorTone >= 50 && colorTone < 80;

    if (variant === "seal") {
      const size = isStory ? 128 : isLandscape ? 108 : 116;
      return (
        <div className="absolute z-10" style={{ top: 22, right: 22 }}>
          <div
            className="relative flex items-center justify-center font-extrabold tracking-tight text-white"
            style={{
              width: size,
              height: size,
              background: theme.sealBg,
              clipPath:
                "polygon(50% 0%, 85% 15%, 100% 50%, 85% 85%, 50% 100%, 15% 85%, 0% 50%, 15% 15%)",
              boxShadow: "0 14px 32px rgba(15, 23, 42, 0.22)",
              fontSize: isStory ? 34 : 28,
              transform: "rotate(-8deg)",
            }}
          >
            <span style={{ transform: "rotate(8deg)" }}>−{discount}%</span>
          </div>
        </div>
      );
    }

    return (
      <div className="absolute z-10" style={{ top: 28, right: 28 }}>
        <span
          className="inline-flex items-center rounded-full font-bold tracking-wide text-white"
          style={{
            padding: isStory ? "14px 26px" : "12px 22px",
            fontSize: isStory ? 28 : 22,
            background: isVibrant
              ? "linear-gradient(135deg, #f97316, #7c3aed)"
              : "#e11d48",
            boxShadow: isVibrant
              ? "0 12px 28px rgba(124,58,237,0.4)"
              : "0 10px 24px rgba(225,29,72,0.28)",
          }}
        >
          −{discount}%
        </span>
      </div>
    );
  }

  function renderProductMedia(options: {
    split: boolean;
    sectionRadius: string;
    mediaRadius: number | string;
    minHeight?: number;
    flexClass: string;
  }) {
    if (!selected) return null;
    const hasImagePad = imagePadX > 0 || imagePadY > 0;
    return (
      <div
        className={`relative flex items-center justify-center ${options.flexClass}`}
        style={{
          minHeight: options.minHeight,
          padding: `${imagePadY}px ${imagePadX}px`,
          background: cardSurfaceColor,
          borderRadius: options.sectionRadius,
          overflow: "hidden",
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden"
          style={{
            borderRadius: options.mediaRadius,
            background: imageAreaBg,
            minHeight: "100%",
          }}
        >
          <ProductImage
            key={`${displayImageUrl}-${imageFit}-${layoutId}`}
            src={displayImageUrl}
            ready={imageReady}
            onReady={() => setImageReady(true)}
            onError={onImageError}
            onBgColor={setImageBgColor}
            fit={imageFit}
            areaWidth={
              options.split
                ? Math.round((format.width - pad * 2) * 0.54) - imagePadX * 2
                : format.width - pad * 2 - imagePadX * 2
            }
            areaHeight={
              (options.minHeight ??
                Math.round((format.height - pad * 2) * 0.62)) -
              imagePadY * 2
            }
          />
        </div>
      </div>
    );
  }

  function renderCopyBlock(options?: { clamp?: number }) {
    if (!selected) return null;
    return (
      <div
        className="w-full shrink-0"
        style={{
          padding: `${textPadY}px ${textPadX}px`,
        }}
      >
        {selected.brand ? (
          <p
            className="font-bold uppercase tracking-[0.14em]"
            style={{ fontSize: brandSize, color: theme.brandColor }}
          >
            {selected.brand}
          </p>
        ) : null}
        <h2
          className="font-semibold leading-snug"
          style={{
            marginTop: selected.brand ? 12 : 0,
            fontSize: titleSize,
            color: theme.titleColor,
            display: "-webkit-box",
            WebkitLineClamp: options?.clamp ?? (isLandscape ? 2 : 3),
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {selected.title}
        </h2>
        <div style={{ marginTop: Math.max(16, Math.round(textPadY * 0.55)) }}>
          <PriceRow
            current={selected.currentPrice}
            previous={previousPrice}
            priceSize={priceSize}
            strikeSize={strikeSize}
            accent={theme.priceAccent}
            strike={theme.priceStrike}
          />
        </div>
      </div>
    );
  }

  function renderCanvas(card: ReactNode) {
    return (
      <div
        className="absolute inset-0 flex"
        style={{
          padding: pad,
          background: theme.canvasBg,
          overflow: layoutId === "float" ? "visible" : "hidden",
        }}
      >
        {theme.canvasOverlay ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: theme.canvasOverlay }}
          />
        ) : null}
        {card}
      </div>
    );
  }

  function renderMinimalCard() {
    if (!selected) return null;
    const hasImagePad = imagePadX > 0 || imagePadY > 0;
    const mediaRadius = hasImagePad ? cardRadius : 0;

    return renderCanvas(
      <div
        className="relative z-[1] flex h-full w-full flex-col overflow-hidden"
        style={{
          background: cardSurfaceColor,
          border: theme.cardBorder,
          boxShadow: theme.cardShadow ?? "none",
          borderRadius: cardRadius,
        }}
      >
        {renderBadge("pill")}
        {renderProductMedia({
          split: false,
          sectionRadius: "0",
          mediaRadius,
          flexClass: "min-h-0 w-full flex-1",
        })}
        {renderCopyBlock()}
      </div>,
    );
  }

  function renderFloatCard() {
    if (!selected) return null;
    const mediaH = isStory
      ? "52%"
      : isLandscape
        ? "58%"
        : format.id === "classic"
          ? "48%"
          : "50%";
    const mediaW = isLandscape ? "52%" : "78%";
    const zoom = Math.max(0.4, Math.min(2, floatZoom));

    return renderCanvas(
      <div
        className="relative z-[1] flex h-full w-full flex-col"
        style={{
          background: cardSurfaceColor,
          border: theme.cardBorder,
          boxShadow: theme.cardShadow ?? "0 28px 60px rgba(15,23,42,0.18)",
          borderRadius: cardRadius,
          overflow: "visible",
        }}
      >
        <div className="relative min-h-0 w-full flex-1" aria-hidden />
        {renderCopyBlock({ clamp: isLandscape ? 2 : 4 })}

        <div
          className="absolute z-[2] overflow-hidden"
          style={{
            top: (isLandscape ? 28 : 40) + floatOffsetY,
            left: isLandscape
              ? `calc(24% + ${floatOffsetX}px)`
              : `calc(11% + ${floatOffsetX}px)`,
            width: mediaW,
            height: mediaH,
            borderRadius: Math.max(24, cardRadius - 4),
            background: imageAreaBg,
            boxShadow: "0 24px 48px rgba(15,23,42,0.28)",
            transform: `rotate(${floatRotate}deg)`,
            transformOrigin: "center center",
            padding: `${Math.max(8, imagePadY / 2)}px ${Math.max(8, imagePadX / 2)}px`,
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden"
            style={{ borderRadius: Math.max(16, cardRadius - 12) }}
          >
            <ProductImage
              key={`${displayImageUrl}-${imageFit}-float-${zoom}`}
              src={displayImageUrl}
              ready={imageReady}
              onReady={() => setImageReady(true)}
              onError={onImageError}
              onBgColor={setImageBgColor}
              fit={imageFit}
              areaWidth={
                Math.round(
                  (format.width - pad * 2) * (isLandscape ? 0.52 : 0.78),
                ) - Math.max(16, imagePadX)
              }
              areaHeight={
                Math.round(
                  (format.height - pad * 2) * (isLandscape ? 0.58 : 0.52),
                ) - Math.max(16, imagePadY)
              }
              zoom={zoom}
            />
          </div>
        </div>
        {renderBadge("pill")}
      </div>,
    );
  }

  function renderBannerCard() {
    if (!selected) return null;
    const hasImagePad = imagePadX > 0 || imagePadY > 0;
    const bannerLabel =
      selected.brand?.trim() ||
      (discount > 0 ? `Chollo −${discount}%` : "CazaOfertas");

    return renderCanvas(
      <div
        className="relative z-[1] flex h-full w-full flex-col overflow-hidden"
        style={{
          background: cardSurfaceColor,
          border: theme.cardBorder,
          boxShadow: theme.cardShadow ?? "none",
          borderRadius: cardRadius,
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-4"
          style={{
            background: theme.bannerBg,
            padding: isStory ? "18px 32px" : "14px 28px",
          }}
        >
          <p
            className="font-bold uppercase tracking-[0.16em] text-white"
            style={{ fontSize: isStory ? 26 : 20 }}
          >
            {bannerLabel}
          </p>
          {discount > 0 ? (
            <span
              className="font-extrabold text-white"
              style={{
                fontSize: isStory ? 28 : 22,
                background: "rgba(255,255,255,0.22)",
                padding: "8px 16px",
                borderRadius: 999,
              }}
            >
              −{discount}%
            </span>
          ) : null}
        </div>

        {renderProductMedia({
          split: false,
          sectionRadius: "0",
          mediaRadius: hasImagePad ? Math.max(0, cardRadius - 8) : 0,
          flexClass: "min-h-0 w-full flex-1",
        })}
        {renderCopyBlock()}
      </div>,
    );
  }

  function renderSealCard() {
    if (!selected) return null;
    const hasImagePad = imagePadX > 0 || imagePadY > 0;
    const mediaRadius = hasImagePad ? cardRadius : 0;

    return renderCanvas(
      <div
        className="relative z-[1] flex h-full w-full flex-col overflow-hidden"
        style={{
          background: cardSurfaceColor,
          border: theme.cardBorder,
          boxShadow: theme.cardShadow ?? "none",
          borderRadius: cardRadius,
        }}
      >
        {renderBadge("seal")}
        {renderProductMedia({
          split: false,
          sectionRadius: "0",
          mediaRadius,
          flexClass: "min-h-0 w-full flex-1",
        })}
        {renderCopyBlock()}
      </div>,
    );
  }

  function renderActiveCard() {
    switch (layoutId) {
      case "float":
        return renderFloatCard();
      case "banner":
        return renderBannerCard();
      case "seal":
        return renderSealCard();
      case "minimal":
      default:
        return renderMinimalCard();
    }
  }

  if (!editorReady) {
    return (
      <div className="flex h-80 items-center justify-center border border-dashed border-stone-300 bg-white text-stone-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Cargando editor…
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-stone-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <Link
              href="/admin/social"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-800 hover:underline"
            >
              ← Volver a tarjetas
            </Link>
            <h1 className="mt-3 font-display text-3xl tracking-tight text-ink md:text-4xl">
              {projectId ? "Editar tarjeta" : "Nueva tarjeta"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              {projectId && currentProjectId
                ? `Última actualización: ${formatSocialProjectDate(
                    getSocialCardProject(currentProjectId)?.updatedAt ??
                      new Date().toISOString(),
                  )}`
                : "Configura la tarjeta y guárdala para añadirla a tu lista."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveCurrentProject}
              disabled={!selected}
              className="inline-flex h-11 items-center gap-2 border border-stone-300 bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink hover:bg-stone-50 disabled:opacity-40"
            >
              <Save className="h-4 w-4" />
              Guardar
            </button>
            <button
              type="button"
              onClick={() => void downloadPng()}
              disabled={exporting || !selected}
              className="inline-flex h-11 items-center gap-2 bg-ink px-4 text-xs font-semibold uppercase tracking-[0.12em] text-paper disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Descargar PNG
            </button>
          </div>
        </div>
        <label className="mt-4 block max-w-md text-sm font-medium text-ink">
          Nombre del proyecto
          <input
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal text-ink outline-none focus:border-ink"
            placeholder="Ej. Oferta aspiradora Black Friday"
          />
        </label>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">
          Redes
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Layout Minimalista por defecto (sin cambios). Añade Split, Banner o
          Sello; elige paleta light y exporta PNG a resolución nativa.
        </p>
      </header>

      <section className="mt-8 space-y-5 border border-stone-300 bg-white p-5 md:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Layout de tarjeta
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {LAYOUTS.map((item) => {
              const active = item.id === layoutId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setLayoutId(item.id)}
                  className={`rounded-sm border px-4 py-3 text-left transition ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-stone-300 bg-white text-ink hover:border-stone-500"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p
                    className={`mt-1 text-[11px] leading-snug ${
                      active ? "text-paper/70" : "text-stone-500"
                    }`}
                  >
                    {item.hint}
                  </p>
                </button>
              );
            })}
          </div>
          {layoutId === "float" ? (
            <div className="mt-4 grid gap-3 border border-stone-200 bg-stone-50/80 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <p className="sm:col-span-2 lg:col-span-4 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                Flotante: inclinación, posición y zoom
              </p>
              <label className="text-xs text-stone-600">
                Ángulo ({floatRotate}°)
                <input
                  type="range"
                  min={-15}
                  max={15}
                  step={0.5}
                  value={floatRotate}
                  onChange={(event) =>
                    setFloatRotate(Number(event.target.value))
                  }
                  className="mt-1 w-full accent-ink"
                />
              </label>
              <label className="text-xs text-stone-600">
                Desplazamiento X ({floatOffsetX}px)
                <input
                  type="range"
                  min={-120}
                  max={120}
                  step={1}
                  value={floatOffsetX}
                  onChange={(event) =>
                    setFloatOffsetX(Number(event.target.value))
                  }
                  className="mt-1 w-full accent-ink"
                />
              </label>
              <label className="text-xs text-stone-600">
                Desplazamiento Y ({floatOffsetY}px)
                <input
                  type="range"
                  min={-80}
                  max={200}
                  step={1}
                  value={floatOffsetY}
                  onChange={(event) =>
                    setFloatOffsetY(Number(event.target.value))
                  }
                  className="mt-1 w-full accent-ink"
                />
              </label>
              <label className="text-xs text-stone-600">
                Zoom imagen ({Math.round(floatZoom * 100)}%)
                <input
                  type="range"
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  value={floatZoom}
                  onChange={(event) =>
                    setFloatZoom(Number(event.target.value))
                  }
                  className="mt-1 w-full accent-ink"
                />
              </label>
              <p className="sm:col-span-2 lg:col-span-4 text-[11px] text-stone-500">
                La imagen flotante ya no se recorta contra el borde de la
                tarjeta; usa zoom/posición si sobresale del lienzo.
              </p>
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Paleta / fondo (light)
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {STYLES.map((item) => {
              const active = Math.abs(colorTone - PRESET_TONE[item.id]) <= 1.5;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setStyleId(item.id);
                    setColorTone(PRESET_TONE[item.id]);
                  }}
                  className={`rounded-sm border px-4 py-3 text-left transition ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-stone-300 bg-white text-ink hover:border-stone-500"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p
                    className={`mt-1 text-[11px] leading-snug ${
                      active ? "text-paper/70" : "text-stone-500"
                    }`}
                  >
                    {item.hint}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border border-stone-200 bg-stone-50/80 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                Tono del degradado
              </p>
              <p className="text-xs text-stone-600">
                {toneName} · matiz {toneHueDegrees(colorTone)}° ·{" "}
                {Math.round(colorTone)}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-stone-500">
              0–33 normal, 34–66 vibrante, 67–100 pastel. En cada zona el matiz
              rota (~360°) → muchas variaciones, no solo las 4 presets.
            </p>
            <div
              className="mt-3 h-3 w-full border border-stone-200"
              style={{
                background: theme.canvasBg,
              }}
              aria-hidden
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={colorTone}
              onChange={(event) => {
                const next = Number(event.target.value);
                setColorTone(next);
                const match = (Object.keys(PRESET_TONE) as StyleId[]).find(
                  (id) => Math.abs(PRESET_TONE[id] - next) <= 1.5,
                );
                if (match) setStyleId(match);
              }}
              className="mt-3 w-full accent-ink"
              aria-label="Tono del degradado de fondo"
            />
            <div className="mt-1 flex justify-between text-[10px] uppercase tracking-[0.12em] text-stone-400">
              <span>Normal</span>
              <span>Vibrante</span>
              <span>Pastel</span>
            </div>
          </div>

          <div className="mt-4 border border-stone-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Fondo de la tarjeta
            </p>
            <p className="mt-1 text-[11px] text-stone-500">
              Independiente del degradado del lienzo. Por defecto blanco.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-ink">
                <span
                  className="relative h-9 w-9 overflow-hidden rounded-sm border border-stone-300"
                  style={{ background: cardSurfaceColor }}
                >
                  <input
                    type="color"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(cardSurfaceColor)
                        ? cardSurfaceColor
                        : "#ffffff"
                    }
                    onChange={(event) =>
                      setCardSurfaceColor(event.target.value)
                    }
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    aria-label="Color de fondo de la tarjeta"
                  />
                </span>
                <span className="font-mono text-xs uppercase">
                  {cardSurfaceColor}
                </span>
              </label>
              <button
                type="button"
                disabled={pickingColor}
                onClick={async () => {
                  const EyeDropperCtor = (
                    window as Window & {
                      EyeDropper?: new () => {
                        open: () => Promise<{ sRGBHex: string }>;
                      };
                    }
                  ).EyeDropper;
                  if (!EyeDropperCtor) {
                    toast.error(
                      "Tu navegador no soporta el cuentagotas. Usa Chrome/Edge.",
                    );
                    return;
                  }
                  setPickingColor(true);
                  try {
                    const result = await new EyeDropperCtor().open();
                    setCardSurfaceColor(result.sRGBHex);
                  } catch {
                    // usuario canceló
                  } finally {
                    setPickingColor(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-sm border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink hover:border-ink disabled:opacity-50"
              >
                {pickingColor ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pipette className="h-3.5 w-3.5" />
                )}
                Cuentagotas
              </button>
              <button
                type="button"
                onClick={() => setCardSurfaceColor("#ffffff")}
                className="inline-flex items-center gap-2 rounded-sm border border-stone-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-stone-600 hover:border-ink hover:text-ink"
              >
                <Droplet className="h-3.5 w-3.5" />
                Blanco
              </button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Formato de exportación
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {FORMATS.map((item) => {
              const active = item.id === formatId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFormatId(item.id)}
                  className={`rounded-sm border px-4 py-3 text-left transition ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-stone-300 bg-white text-ink hover:border-stone-500"
                  }`}
                >
                  <p className="text-sm font-semibold">
                    {item.label}{" "}
                    <span
                      className={active ? "text-paper/70" : "text-stone-400"}
                    >
                      {item.ratio}
                    </span>
                  </p>
                  <p
                    className={`mt-1 text-[11px] leading-snug ${
                      active ? "text-paper/70" : "text-stone-500"
                    }`}
                  >
                    {item.width}×{item.height} · {item.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Ajuste de imagen
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {IMAGE_FITS.map((item) => {
              const active = item.id === imageFit;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setImageFit(item.id)}
                  className={`rounded-sm border px-4 py-3 text-left transition ${
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-stone-300 bg-white text-ink hover:border-stone-500"
                  }`}
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p
                    className={`mt-1 text-[11px] leading-snug ${
                      active ? "text-paper/70" : "text-stone-500"
                    }`}
                  >
                    {item.hint}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                Padding lateral (izq. + der.)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 24, 40, 56, 72, 96].map((value) => (
                  <button
                    key={`x-${value}`}
                    type="button"
                    onClick={() => setImagePadX(value)}
                    className={`h-9 min-w-12 border px-2.5 text-xs font-semibold transition ${
                      imagePadX === value
                        ? "border-ink bg-ink text-paper"
                        : "border-stone-300 bg-white text-stone-700 hover:border-ink"
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <label className="inline-flex h-9 items-center gap-1.5 border border-stone-300 bg-white px-2 text-xs text-stone-600">
                  Custom
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={imagePadX}
                    onChange={(event) =>
                      setImagePadX(
                        Math.min(
                          200,
                          Math.max(0, Number(event.target.value) || 0),
                        ),
                      )
                    }
                    className="h-7 w-14 border border-stone-200 px-1.5 text-sm text-ink outline-none focus:border-ink"
                  />
                  <span className="text-stone-400">px</span>
                </label>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                Padding vertical (sup. + inf.)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 24, 40, 56, 72, 96].map((value) => (
                  <button
                    key={`y-${value}`}
                    type="button"
                    onClick={() => setImagePadY(value)}
                    className={`h-9 min-w-12 border px-2.5 text-xs font-semibold transition ${
                      imagePadY === value
                        ? "border-ink bg-ink text-paper"
                        : "border-stone-300 bg-white text-stone-700 hover:border-ink"
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <label className="inline-flex h-9 items-center gap-1.5 border border-stone-300 bg-white px-2 text-xs text-stone-600">
                  Custom
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={imagePadY}
                    onChange={(event) =>
                      setImagePadY(
                        Math.min(
                          200,
                          Math.max(0, Number(event.target.value) || 0),
                        ),
                      )
                    }
                    className="h-7 w-14 border border-stone-200 px-1.5 text-sm text-ink outline-none focus:border-ink"
                  />
                  <span className="text-stone-400">px</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                Padding texto (horizontal)
              </p>
              <p className="mt-1 text-[11px] text-stone-500">
                Aplica a los 4 layouts; el bloque de texto queda abajo.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[24, 36, 44, 56, 72, 96].map((value) => (
                  <button
                    key={`tx-${value}`}
                    type="button"
                    onClick={() => setTextPadX(value)}
                    className={`h-9 min-w-12 border px-2.5 text-xs font-semibold transition ${
                      textPadX === value
                        ? "border-ink bg-ink text-paper"
                        : "border-stone-300 bg-white text-stone-700 hover:border-ink"
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <label className="inline-flex h-9 items-center gap-1.5 border border-stone-300 bg-white px-2 text-xs text-stone-600">
                  Custom
                  <input
                    type="number"
                    min={8}
                    max={160}
                    value={textPadX}
                    onChange={(event) =>
                      setTextPadX(
                        Math.min(
                          160,
                          Math.max(8, Number(event.target.value) || 8),
                        ),
                      )
                    }
                    className="h-7 w-14 border border-stone-200 px-1.5 text-sm text-ink outline-none focus:border-ink"
                  />
                  <span className="text-stone-400">px</span>
                </label>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                Padding texto (vertical)
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[16, 24, 32, 40, 56, 72].map((value) => (
                  <button
                    key={`ty-${value}`}
                    type="button"
                    onClick={() => setTextPadY(value)}
                    className={`h-9 min-w-12 border px-2.5 text-xs font-semibold transition ${
                      textPadY === value
                        ? "border-ink bg-ink text-paper"
                        : "border-stone-300 bg-white text-stone-700 hover:border-ink"
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <label className="inline-flex h-9 items-center gap-1.5 border border-stone-300 bg-white px-2 text-xs text-stone-600">
                  Custom
                  <input
                    type="number"
                    min={8}
                    max={160}
                    value={textPadY}
                    onChange={(event) =>
                      setTextPadY(
                        Math.min(
                          160,
                          Math.max(8, Number(event.target.value) || 8),
                        ),
                      )
                    }
                    className="h-7 w-14 border border-stone-200 px-1.5 text-sm text-ink outline-none focus:border-ink"
                  />
                  <span className="text-stone-400">px</span>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Border radius (card + zona imagen)
            </p>
            <p className="mt-1 text-[11px] text-stone-500">
              Un solo valor para la card y la zona gris de la imagen (también con
              padding).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 16, 24, 32, 40, 56, 72].map((value) => (
                <button
                  key={`card-r-${value}`}
                  type="button"
                  onClick={() => setCardRadius(value)}
                  className={`h-9 min-w-12 border px-2.5 text-xs font-semibold transition ${
                    cardRadius === value
                      ? "border-ink bg-ink text-paper"
                      : "border-stone-300 bg-white text-stone-700 hover:border-ink"
                  }`}
                >
                  {value}
                </button>
              ))}
              <label className="inline-flex h-9 items-center gap-1.5 border border-stone-300 bg-white px-2 text-xs text-stone-600">
                Custom
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={cardRadius}
                  onChange={(event) =>
                    setCardRadius(
                      Math.min(
                        200,
                        Math.max(0, Number(event.target.value) || 0),
                      ),
                    )
                  }
                  className="h-7 w-14 border border-stone-200 px-1.5 text-sm text-ink outline-none focus:border-ink"
                />
                <span className="text-stone-400">px</span>
              </label>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-t border-stone-200 pt-5 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
          <label className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Buscar
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Título, ASIN o marca…"
              className="mt-2 h-11 w-full border border-stone-300 px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none focus:border-ink"
            />
          </label>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
              Producto
            </p>
            <ul className="mt-2 max-h-44 divide-y divide-stone-200 overflow-auto border border-stone-300 bg-white">
              {loading ? (
                <li className="px-3 py-3 text-sm text-stone-500">Cargando…</li>
              ) : filtered.length === 0 ? (
                <li className="px-3 py-3 text-sm text-stone-500">
                  Sin productos
                </li>
              ) : (
                filtered.map((product) => {
                  const thumb = product.imageUrl
                    ? proxiedImageUrl(product.imageUrl)
                    : null;
                  const active = product.id === selectedId;
                  return (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(product.id)}
                        className={`flex w-full gap-3 px-3 py-2.5 text-left transition ${
                          active
                            ? "bg-stone-100"
                            : "bg-white hover:bg-stone-50"
                        }`}
                      >
                        <span className="relative h-12 w-12 shrink-0 overflow-hidden border border-stone-200 bg-stone-100">
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
                          <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] text-stone-500">
                            <span className="font-semibold text-ink">
                              {formatEuro(product.currentPrice)}
                            </span>
                            {product.previousPrice != null &&
                            product.previousPrice > product.currentPrice ? (
                              <span className="line-through">
                                {formatEuro(product.previousPrice)}
                              </span>
                            ) : null}
                            <span className="font-mono">{product.asin}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <button
            type="button"
            disabled={!selected || exporting || loading}
            onClick={() => void downloadPng()}
            className="inline-flex h-11 items-center justify-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Generando…" : "Descargar PNG"}
          </button>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Vista previa
          </p>
          <p className="text-xs text-stone-500">
            {toneName} · {layout.label} · {format.label} · {format.width}×
            {format.height}px
          </p>
        </div>

        {!selected ? (
          <div className="border border-dashed border-stone-300 bg-white px-6 py-16 text-center text-sm text-stone-500">
            {loading
              ? "Cargando catálogo…"
              : "No hay productos. Añade alguno en Productos."}
          </div>
        ) : (
          <div
            className="overflow-auto border border-stone-200 p-4 sm:p-8"
            style={{ background: theme.previewChrome }}
          >
            <div
              className="mx-auto"
              style={{
                width: format.width * scale,
                height: format.height * scale,
              }}
            >
              <div
                ref={cardRef}
                className="relative"
                style={{
                  width: format.width,
                  height: format.height,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  overflow: layoutId === "float" ? "visible" : "hidden",
                  fontFamily:
                    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                }}
              >
                {renderActiveCard()}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
