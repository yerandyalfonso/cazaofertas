import { BLOG_NAME } from "@/lib/blog-brand";

const SIZES = {
  // Barra de navegación: icono de trazo grueso (legible a 40–48 px).
  nav: {
    src: "/brand/una-mica-de-tot-mark-sm.svg",
    mark: "h-10 w-10 md:h-12 md:w-12",
    px: 48,
    gap: "gap-2.5 md:gap-3",
    top: "text-[0.625rem] tracking-[0.2em] md:text-xs",
    bottom: "text-[1.75rem] md:text-[2.125rem]",
  },
  lg: {
    src: "/brand/una-mica-de-tot-mark.svg",
    mark: "h-16 w-16 md:h-20 md:w-20",
    px: 80,
    gap: "gap-4 md:gap-5",
    top: "text-sm tracking-[0.2em] md:text-base",
    bottom: "text-5xl md:text-6xl",
  },
} as const;

/**
 * Marca de «Una mica de tot» (variante E3): icono · separador ·
 * «UNA MICA DE» en versalitas espaciadas sobre «tot» en Fraunces.
 */
export function BlogLogo({ size = "lg" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center text-[#2f3a45] ${s.gap}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
      <img src={s.src} alt="" width={s.px} height={s.px} className={s.mark} />
      <span aria-hidden className="w-px self-stretch bg-current opacity-30" />
      <span className="sr-only">{BLOG_NAME}</span>
      <span aria-hidden className="flex flex-col">
        <span className={`whitespace-nowrap font-sans font-semibold uppercase leading-none ${s.top}`}>
          Una mica de
        </span>
        <span
          className={`-mt-0.5 font-display font-semibold leading-[0.85] tracking-[-0.02em] ${s.bottom}`}
        >
          tot
        </span>
      </span>
    </span>
  );
}
