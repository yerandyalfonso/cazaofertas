import Image from "next/image";

/** Foto del producto entera sobre fondo blanco, ocupando toda su zona. */
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
  if (!src) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center bg-white text-sm text-muted">
        Sin imagen
      </div>
    );
  }
  return (
    <div className="absolute inset-0 bg-white">
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-contain transition-transform duration-300 group-hover:scale-[1.03] ${padding}`}
        sizes={sizes}
        priority={priority}
      />
    </div>
  );
}
