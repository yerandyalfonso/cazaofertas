import Image from "next/image";
import { SITE_NAME } from "@/lib/site";

/**
 * Logo horizontal (icono «c’h» + «chollos d’hoy.»). SVG con el texto en trazos,
 * generado con docs/redes/svg/generar_svg.py (b1-3-horizontal-trazos.svg).
 */
export function BrandLogo({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      src="/brand/logo.svg"
      alt={SITE_NAME}
      width={1492}
      height={300}
      priority={priority}
      unoptimized
      className="h-8 w-auto md:h-9"
    />
  );
}
