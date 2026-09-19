/**
 * Paletas Alerta YIR — misma geometría SVG, colores distintos.
 * `bg` = archivo en /public/social/
 */
export type PulseThemeId =
  | "amber"
  | "teal"
  | "blue"
  | "green"
  | "rose"
  | "violet"
  | "cyan"
  | "slate"
  | "magenta"
  | "coral"
  | "lime"
  | "red"
  | "orange"
  | "stone";

export interface PulseTheme {
  id: PulseThemeId;
  label: string;
  /** Fondo SVG público */
  bgPath: string;
  /** Fallback sólido mientras carga */
  fallback: string;
  discountBg: string;
  priceGradient: string;
  strikeLine: string;
}

export const PULSE_THEMES: Record<PulseThemeId, PulseTheme> = {
  amber: {
    id: "amber",
    label: "Ámbar",
    bgPath: "/social/pulse-yir-bg-amber.svg",
    fallback: "#F3AA37",
    discountBg: "#F80",
    priceGradient: "linear-gradient(97deg, #FF9F10 11.55%, #FEC33B 104.52%)",
    strikeLine: "#E11900",
  },
  teal: {
    id: "teal",
    label: "Teal",
    bgPath: "/social/pulse-yir-bg-teal.svg",
    fallback: "#0D9488",
    discountBg: "#0F766E",
    priceGradient: "linear-gradient(97deg, #14B8A6 11.55%, #5EEAD4 104.52%)",
    strikeLine: "#BE123C",
  },
  blue: {
    id: "blue",
    label: "Azul",
    bgPath: "/social/pulse-yir-bg-blue.svg",
    fallback: "#2563EB",
    discountBg: "#1D4ED8",
    priceGradient: "linear-gradient(97deg, #3B82F6 11.55%, #93C5FD 104.52%)",
    strikeLine: "#E11D48",
  },
  green: {
    id: "green",
    label: "Verde",
    bgPath: "/social/pulse-yir-bg-green.svg",
    fallback: "#16A34A",
    discountBg: "#15803D",
    priceGradient: "linear-gradient(97deg, #22C55E 11.55%, #86EFAC 104.52%)",
    strikeLine: "#DC2626",
  },
  rose: {
    id: "rose",
    label: "Rosa",
    bgPath: "/social/pulse-yir-bg-rose.svg",
    fallback: "#E11D48",
    discountBg: "#BE123C",
    priceGradient: "linear-gradient(97deg, #F43F5E 11.55%, #FDA4AF 104.52%)",
    strikeLine: "#1E293B",
  },
  violet: {
    id: "violet",
    label: "Violeta",
    bgPath: "/social/pulse-yir-bg-violet.svg",
    fallback: "#7C3AED",
    discountBg: "#6D28D9",
    priceGradient: "linear-gradient(97deg, #8B5CF6 11.55%, #C4B5FD 104.52%)",
    strikeLine: "#E11D48",
  },
  cyan: {
    id: "cyan",
    label: "Cian",
    bgPath: "/social/pulse-yir-bg-cyan.svg",
    fallback: "#0E7490",
    discountBg: "#155E75",
    priceGradient: "linear-gradient(97deg, #06B6D4 11.55%, #67E8F9 104.52%)",
    strikeLine: "#BE123C",
  },
  slate: {
    id: "slate",
    label: "Pizarra",
    bgPath: "/social/pulse-yir-bg-slate.svg",
    fallback: "#475569",
    discountBg: "#334155",
    priceGradient: "linear-gradient(97deg, #64748B 11.55%, #CBD5E1 104.52%)",
    strikeLine: "#E11D48",
  },
  magenta: {
    id: "magenta",
    label: "Magenta",
    bgPath: "/social/pulse-yir-bg-magenta.svg",
    fallback: "#DB2777",
    discountBg: "#BE185D",
    priceGradient: "linear-gradient(97deg, #EC4899 11.55%, #F9A8D4 104.52%)",
    strikeLine: "#1E293B",
  },
  coral: {
    id: "coral",
    label: "Coral",
    bgPath: "/social/pulse-yir-bg-coral.svg",
    fallback: "#FB7185",
    discountBg: "#E11D48",
    priceGradient: "linear-gradient(97deg, #FB7185 11.55%, #FECDD3 104.52%)",
    strikeLine: "#1E293B",
  },
  lime: {
    id: "lime",
    label: "Lima",
    bgPath: "/social/pulse-yir-bg-lime.svg",
    fallback: "#65A30D",
    discountBg: "#4D7C0F",
    priceGradient: "linear-gradient(97deg, #84CC16 11.55%, #BEF264 104.52%)",
    strikeLine: "#DC2626",
  },
  red: {
    id: "red",
    label: "Rojo",
    bgPath: "/social/pulse-yir-bg-red.svg",
    fallback: "#DC2626",
    discountBg: "#B91C1C",
    priceGradient: "linear-gradient(97deg, #EF4444 11.55%, #FCA5A5 104.52%)",
    strikeLine: "#1E293B",
  },
  orange: {
    id: "orange",
    label: "Naranja",
    bgPath: "/social/pulse-yir-bg-orange.svg",
    fallback: "#EA580C",
    discountBg: "#C2410C",
    priceGradient: "linear-gradient(97deg, #F97316 11.55%, #FDBA74 104.52%)",
    strikeLine: "#1E293B",
  },
  stone: {
    id: "stone",
    label: "Piedra",
    bgPath: "/social/pulse-yir-bg-stone.svg",
    fallback: "#78716C",
    discountBg: "#57534E",
    priceGradient: "linear-gradient(97deg, #A8A29E 11.55%, #E7E5E4 104.52%)",
    strikeLine: "#E11D48",
  },
};

export const PULSE_THEME_IDS = Object.keys(PULSE_THEMES) as PulseThemeId[];

export function getPulseTheme(id: string | null | undefined): PulseTheme {
  if (id && id in PULSE_THEMES) {
    return PULSE_THEMES[id as PulseThemeId];
  }
  return PULSE_THEMES.amber;
}

/** Colores crudos para generar el SVG (script + runtime Facebook). */
export interface PulseSvgPalette {
  base: string;
  radialInner: string;
  radialOuter: string;
  diamondA: string;
  diamondB: string;
  accent: string;
  band: string;
  glow: string;
  shadowRgb: string; // "r g b" 0-1 for feColorMatrix
  curveA: string;
  curveB: string;
  /** Rejilla de puntos Figma (radial). */
  dotsInner: string;
  dotsOuter: string;
}

export const PULSE_SVG_PALETTES: Record<PulseThemeId, PulseSvgPalette> = {
  amber: {
    base: "#F3AA37",
    radialInner: "#FFAE00",
    radialOuter: "#FF9C00",
    diamondA: "#FFDD0A",
    diamondB: "#F9992B",
    accent: "#D3FF1A",
    band: "#FFC015",
    glow: "#FF5E00",
    shadowRgb: "0.956863 0.521569 0.129412",
    curveA: "#FAA116",
    curveB: "#FB8400",
    dotsInner: "#2C0600",
    dotsOuter: "#921400",
  },
  teal: {
    base: "#14B8A6",
    radialInner: "#2DD4BF",
    radialOuter: "#0D9488",
    diamondA: "#5EEAD4",
    diamondB: "#0F766E",
    accent: "#A3E635",
    band: "#2DD4BF",
    glow: "#0F766E",
    shadowRgb: "0.05 0.47 0.43",
    curveA: "#5EEAD4",
    curveB: "#0D9488",
    dotsInner: "#042F2E",
    dotsOuter: "#0F766E",
  },
  blue: {
    base: "#3B82F6",
    radialInner: "#60A5FA",
    radialOuter: "#2563EB",
    diamondA: "#93C5FD",
    diamondB: "#1D4ED8",
    accent: "#FDE047",
    band: "#60A5FA",
    glow: "#1E40AF",
    shadowRgb: "0.15 0.35 0.85",
    curveA: "#93C5FD",
    curveB: "#1D4ED8",
    dotsInner: "#0C1A3A",
    dotsOuter: "#1D4ED8",
  },
  green: {
    base: "#22C55E",
    radialInner: "#4ADE80",
    radialOuter: "#16A34A",
    diamondA: "#86EFAC",
    diamondB: "#15803D",
    accent: "#FACC15",
    band: "#4ADE80",
    glow: "#166534",
    shadowRgb: "0.1 0.55 0.25",
    curveA: "#86EFAC",
    curveB: "#15803D",
    dotsInner: "#052E16",
    dotsOuter: "#166534",
  },
  rose: {
    base: "#F43F5E",
    radialInner: "#FB7185",
    radialOuter: "#E11D48",
    diamondA: "#FDA4AF",
    diamondB: "#BE123C",
    accent: "#FDE047",
    band: "#FB7185",
    glow: "#9F1239",
    shadowRgb: "0.85 0.15 0.3",
    curveA: "#FDA4AF",
    curveB: "#BE123C",
    dotsInner: "#4C0519",
    dotsOuter: "#BE123C",
  },
  violet: {
    base: "#8B5CF6",
    radialInner: "#A78BFA",
    radialOuter: "#7C3AED",
    diamondA: "#C4B5FD",
    diamondB: "#6D28D9",
    accent: "#FDE047",
    band: "#A78BFA",
    glow: "#5B21B6",
    shadowRgb: "0.45 0.2 0.85",
    curveA: "#C4B5FD",
    curveB: "#6D28D9",
    dotsInner: "#2E1065",
    dotsOuter: "#6D28D9",
  },
  cyan: {
    base: "#0E7490",
    radialInner: "#22D3EE",
    radialOuter: "#0E7490",
    diamondA: "#67E8F9",
    diamondB: "#155E75",
    accent: "#FDE047",
    band: "#22D3EE",
    glow: "#155E75",
    shadowRgb: "0.05 0.45 0.55",
    curveA: "#67E8F9",
    curveB: "#155E75",
    dotsInner: "#083344",
    dotsOuter: "#0E7490",
  },
  slate: {
    base: "#475569",
    radialInner: "#94A3B8",
    radialOuter: "#334155",
    diamondA: "#CBD5E1",
    diamondB: "#1E293B",
    accent: "#FDE047",
    band: "#94A3B8",
    glow: "#1E293B",
    shadowRgb: "0.2 0.25 0.35",
    curveA: "#CBD5E1",
    curveB: "#334155",
    dotsInner: "#0F172A",
    dotsOuter: "#475569",
  },
  magenta: {
    base: "#DB2777",
    radialInner: "#F472B6",
    radialOuter: "#BE185D",
    diamondA: "#F9A8D4",
    diamondB: "#9D174D",
    accent: "#FDE047",
    band: "#F472B6",
    glow: "#9D174D",
    shadowRgb: "0.75 0.15 0.45",
    curveA: "#F9A8D4",
    curveB: "#BE185D",
    dotsInner: "#500724",
    dotsOuter: "#BE185D",
  },
  coral: {
    base: "#FB7185",
    radialInner: "#FDA4AF",
    radialOuter: "#E11D48",
    diamondA: "#FECDD3",
    diamondB: "#BE123C",
    accent: "#FDE047",
    band: "#FDA4AF",
    glow: "#BE123C",
    shadowRgb: "0.9 0.35 0.45",
    curveA: "#FECDD3",
    curveB: "#E11D48",
    dotsInner: "#4C0519",
    dotsOuter: "#E11D48",
  },
  lime: {
    base: "#65A30D",
    radialInner: "#A3E635",
    radialOuter: "#4D7C0F",
    diamondA: "#BEF264",
    diamondB: "#3F6212",
    accent: "#FDE047",
    band: "#A3E635",
    glow: "#3F6212",
    shadowRgb: "0.35 0.55 0.05",
    curveA: "#BEF264",
    curveB: "#4D7C0F",
    dotsInner: "#1A2E05",
    dotsOuter: "#4D7C0F",
  },
  red: {
    base: "#DC2626",
    radialInner: "#F87171",
    radialOuter: "#B91C1C",
    diamondA: "#FCA5A5",
    diamondB: "#991B1B",
    accent: "#FDE047",
    band: "#F87171",
    glow: "#991B1B",
    shadowRgb: "0.75 0.15 0.15",
    curveA: "#FCA5A5",
    curveB: "#B91C1C",
    dotsInner: "#450A0A",
    dotsOuter: "#B91C1C",
  },
  orange: {
    base: "#EA580C",
    radialInner: "#FB923C",
    radialOuter: "#C2410C",
    diamondA: "#FDBA74",
    diamondB: "#9A3412",
    accent: "#FDE047",
    band: "#FB923C",
    glow: "#9A3412",
    shadowRgb: "0.85 0.35 0.05",
    curveA: "#FDBA74",
    curveB: "#C2410C",
    dotsInner: "#431407",
    dotsOuter: "#C2410C",
  },
  stone: {
    base: "#78716C",
    radialInner: "#A8A29E",
    radialOuter: "#57534E",
    diamondA: "#E7E5E4",
    diamondB: "#44403C",
    accent: "#FDE047",
    band: "#A8A29E",
    glow: "#44403C",
    shadowRgb: "0.35 0.32 0.3",
    curveA: "#E7E5E4",
    curveB: "#57534E",
    dotsInner: "#1C1917",
    dotsOuter: "#57534E",
  },
};

/** Rejilla Figma: step 18.375, radio ≈ 3.0625 (arriba 7×6, abajo 15×16). */
function buildDotGridCircles(cols: number, rows: number): string {
  const step = 18.375;
  const r = 3.0625;
  const parts: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = +(r + col * step).toFixed(4);
      const cy = +(r + row * step).toFixed(4);
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}"/>`);
    }
  }
  return parts.join("");
}

const DOTS_TOP = buildDotGridCircles(7, 6);
const DOTS_BOTTOM = buildDotGridCircles(15, 16);

/** SVG compacto (misma composición que el export Figma). */
export function buildPulseBackgroundSvg(p: PulseSvgPalette): string {
  const shadowRgb = p.shadowRgb
    .split(" ")
    .map((n) => Math.round(Number(n) * 255))
    .join(",");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="rg" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(512 512) rotate(90) scale(512)">
      <stop stop-color="${p.radialInner}"/>
      <stop offset="1" stop-color="${p.radialOuter}" stop-opacity="0.6"/>
    </radialGradient>
    <linearGradient id="d1" x1="-87" y1="7" x2="93" y2="401" gradientUnits="userSpaceOnUse">
      <stop stop-color="${p.diamondA}"/>
      <stop offset="1" stop-color="${p.diamondB}"/>
    </linearGradient>
    <linearGradient id="d2" x1="760" y1="716" x2="940" y2="1110" gradientUnits="userSpaceOnUse">
      <stop stop-color="${p.diamondA}"/>
      <stop offset="1" stop-color="${p.diamondB}"/>
    </linearGradient>
    <radialGradient id="glowBL" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(135 811) rotate(90) scale(155)">
      <stop stop-color="${p.glow}"/>
      <stop offset="1" stop-color="${p.glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="curve" x1="1352" y1="1185" x2="654" y2="805" gradientUnits="userSpaceOnUse">
      <stop stop-color="${p.curveA}"/>
      <stop offset="1" stop-color="${p.curveB}"/>
    </linearGradient>
    <!-- Puntos arriba: radial Figma paint0_radial_230648_2942 -->
    <radialGradient id="dotsTopGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(63.5 33.25) rotate(129.457) scale(84.1858 82.243)">
      <stop stop-color="${p.dotsInner}"/>
      <stop offset="1" stop-color="${p.dotsOuter}" stop-opacity="0"/>
    </radialGradient>
    <!-- Puntos abajo: radial Figma paint0_radial_230649_3621 -->
    <radialGradient id="dotsBotGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(131.562 139.125) rotate(90) scale(139.125 131.562)">
      <stop stop-color="${p.dotsInner}"/>
      <stop offset="1" stop-color="${p.dotsOuter}" stop-opacity="0"/>
    </radialGradient>
    <filter id="sh" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="36" stdDeviation="0" flood-color="rgb(${shadowRgb})" flood-opacity="1"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="${p.base}"/>
  <rect width="1024" height="1024" fill="url(#rg)"/>
  <path filter="url(#sh)" d="M110-83L-284 97L-104 491L290 311L110-83Z" fill="url(#d1)"/>
  <path style="mix-blend-mode:color-burn" filter="url(#sh)" d="M957 626L563 806L743 1200L1137 1020L957 626Z" fill="url(#d2)"/>
  <path d="M430-127L320-17c-4 4-4 10 0 14s10 4 14 0l110-110c4-4 4-10 0-14s-10-4-14 0Z" fill="${p.accent}" stroke="#151618" stroke-width="4"/>
  <!-- Rejilla puntos superior derecha (113×98 @ 911,10) -->
  <g transform="translate(911 10)" fill="url(#dotsTopGrad)" fill-opacity="0.2">${DOTS_TOP}</g>
  <circle cx="134" cy="810" r="156" fill="url(#glowBL)"/>
  <!-- Rejilla puntos inferior izquierda (264×279 @ 8,664) -->
  <g transform="translate(8 664)" fill="url(#dotsBotGrad)">${DOTS_BOTTOM}</g>
  <g opacity="0.4" stroke="#F5F2E9" stroke-width="2">
    <path d="M1070 808H752V1126H1070V808Z"/>
    <path d="M751 846H1071"/><path d="M751 886H1071"/><path d="M751 926H1071"/>
    <path d="M751 966H1071"/><path d="M751 1006H1071"/>
    <path d="M792 807V1127"/><path d="M832 807V1127"/><path d="M872 807V1127"/>
    <path d="M912 807V1127"/><path d="M952 807V1127"/><path d="M992 807V1127"/>
  </g>
  <path d="M1115 1151L-154 535L-222 675L1047 1291L1115 1151Z" fill="${p.band}" fill-opacity="0.6"/>
  <path d="M822 50L78 165c-18 3-30 19-27 37l115 744c3 18 19 30 37 27l744-115c18-3 30-19 27-37L859 77c-3-18-19-30-37-27Z" stroke="white" stroke-width="2" fill="none"/>
  <path d="M1270 700C1198 503 781 742 616 1064c-68-1-206 70-215 360-12 364 220 386 593 374s-23-177-110-484S1139 1245 1321 1214s22-285-51-514Z" stroke="url(#curve)" stroke-opacity="0.6" stroke-width="4" fill="none"/>
</svg>`;
}

