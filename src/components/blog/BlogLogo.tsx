import { BLOG_NAME } from "@/lib/blog-brand";
import { LOGO_MARK_PATHS } from "@/lib/logo-mark-paths";

const SIZES = {
  nav: {
    mark: "h-10 w-10 md:h-12 md:w-12",
    gap: "gap-2.5 md:gap-3",
    top: "text-[0.625rem] tracking-[0.2em] md:text-xs",
    bottom: "text-[1.75rem] md:text-[2.125rem]",
  },
  lg: {
    mark: "h-16 w-16 md:h-20 md:w-20",
    gap: "gap-4 md:gap-5",
    top: "text-sm tracking-[0.2em] md:text-base",
    bottom: "text-5xl md:text-6xl",
  },
} as const;

/** Orden de dibujo: de arriba abajo (según la posición de cada pieza). */
const DRAW_ORDER = [...LOGO_MARK_PATHS].sort((a, b) => {
  const y = (t: string | null) => Number(t?.match(/,\s*([\d.]+)\)/)?.[1] ?? 0);
  return y(a.transform) - y(b.transform);
});

/**
 * Icono vectorizado: base gris y, encima, un trazo verde recortado a cada pieza
 * que recorre su contorno al pasar el ratón («se dibuja» pieza a pieza).
 */
function LogoMark({ id, className }: { id: string; className: string }) {
  return (
    <svg
      viewBox="0 0 1331 1332"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <defs>
        {DRAW_ORDER.map((path, index) => (
          // Sin transform: el recorte se aplica en el espacio ya trasladado del grupo.
          <clipPath key={index} id={`${id}-${index}`}>
            <path d={path.d} />
          </clipPath>
        ))}
      </defs>
      <g fill="#2f3a45">
        {DRAW_ORDER.map((path, index) => (
          <path key={index} d={path.d} transform={path.transform ?? undefined} />
        ))}
      </g>
      <g className="logo-draw" fill="none" stroke="#115e59" strokeWidth={34}>
        {DRAW_ORDER.map((path, index) => (
          <g key={index} transform={path.transform ?? undefined}>
            <path
              d={path.d}
              clipPath={`url(#${id}-${index})`}
              pathLength={1}
              style={{ transitionDelay: `${index * 0.09}s` }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * Marca de «Una mica de tot» (variante E3): icono · separador ·
 * «UNA MICA DE» en versalitas espaciadas sobre «tot» en Fraunces.
 * Al pasar el ratón (sobre un contenedor `.group`) el icono se dibuja en verde
 * y el nombre se escribe de izquierda a derecha.
 */
export function BlogLogo({ size = "lg" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span className={`inline-flex items-center text-[#2f3a45] ${s.gap}`}>
      <LogoMark id={`logo-${size}`} className={s.mark} />
      <span aria-hidden className="w-px self-stretch bg-current opacity-30" />
      <span className="sr-only">{BLOG_NAME}</span>
      <span aria-hidden className="flex flex-col">
        <span
          className={`logo-write logo-write-1 whitespace-nowrap font-sans font-semibold uppercase leading-none ${s.top}`}
        >
          Una mica de
        </span>
        <span
          className={`logo-write logo-write-2 -mt-0.5 font-display font-semibold leading-[0.85] tracking-[-0.02em] ${s.bottom}`}
        >
          tot
        </span>
      </span>
    </span>
  );
}
