import Image, { type ImageProps } from "next/image";

function isUsableImageSrc(src: ImageProps["src"] | null | undefined): boolean {
  if (src == null) return false;
  if (typeof src === "string") {
    const value = src.trim();
    if (!value) return false;
    if (value.startsWith("/") || value.startsWith("data:")) return true;
    try {
      // next/image construye `new URL(src)` — falla con "", "null", rutas rotas, etc.
      // eslint-disable-next-line no-new
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
  // StaticImport / Blob
  return Boolean(src);
}

type RemoteImageProps = ImageProps & {
  /** Si `src` no es usable, se intenta este (p. ej. cover por defecto del blog). */
  fallbackSrc?: string;
};

/**
 * Imágenes externas sin pasar por /_next/image.
 * Más fiable en Telegram WebView y al abrir enlaces desde el bot.
 * Si `src` no es una URL usable, usa `fallbackSrc` o no renderiza.
 */
export function RemoteImage({ fallbackSrc, ...props }: RemoteImageProps) {
  const src = isUsableImageSrc(props.src)
    ? props.src
    : isUsableImageSrc(fallbackSrc)
      ? fallbackSrc
      : null;

  if (!src) {
    return null;
  }

  return <Image {...props} src={src} unoptimized />;
}
