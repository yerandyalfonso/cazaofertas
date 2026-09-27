"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Imagen que llena toda su zona: el fondo toma el color de las esquinas de la
 * foto, así no se ve el recorte entre la foto y la tarjeta.
 */
export function FillImage({
  src,
  alt,
  sizes,
  padding = "",
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  /** Margen interior de la foto (p. ej. "p-8" en la ficha). */
  padding?: string;
  priority?: boolean;
}) {
  const [bg, setBg] = useState<string | null>(null);

  if (!src) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center text-sm text-muted">
        Sin imagen
      </div>
    );
  }
  return (
    <div className="absolute inset-0" style={bg ? { backgroundColor: bg } : undefined}>
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-contain transition-transform duration-300 group-hover:scale-[1.03] ${padding}`}
        sizes={sizes}
        priority={priority}
        onLoad={(event) => setBg(edgeColor(event.currentTarget))}
      />
    </div>
  );
}

/** Color medio de las cuatro esquinas de la imagen (null si no se puede leer). */
function edgeColor(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 8, 8);
    const { data } = ctx.getImageData(0, 0, 8, 8);
    let r = 0, g = 0, b = 0;
    for (const [x, y] of [[0, 0], [7, 0], [0, 7], [7, 7]]) {
      const i = (y * 8 + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return `rgb(${Math.round(r / 4)} ${Math.round(g / 4)} ${Math.round(b / 4)})`;
  } catch {
    return null;
  }
}
