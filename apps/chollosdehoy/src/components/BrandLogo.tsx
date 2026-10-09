import Image from "next/image";
import { SITE_NAME } from "@/lib/site";

/**
 * Logo horizontal (icono «c’h» + «chollos d’hoy.»). SVG con el texto en trazos,
 * generado con docs/redes/svg/generar_svg.py (b1-3-horizontal-trazos.svg).
 */
const VARIANTS = {
  horizontal: { src: "/brand/logo.svg", width: 1492, className: "h-8 w-auto md:h-9" },
  // Dos líneas; el centro del icono cae en el hueco entre «chollos» y «d’hoy».
  apilado: { src: "/brand/logo-apilado.svg", width: 801, className: "h-10 w-auto md:h-11" },
} as const;

const VARIANT: keyof typeof VARIANTS = "apilado";

export function BrandLogo({ priority = false }: { priority?: boolean }) {
  const v = VARIANTS[VARIANT];
  return (
    <Image
      src={v.src}
      alt={SITE_NAME}
      width={v.width}
      height={300}
      priority={priority}
      unoptimized
      className={v.className}
    />
  );
}
