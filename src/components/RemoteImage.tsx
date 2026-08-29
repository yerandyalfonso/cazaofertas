import Image, { type ImageProps } from "next/image";

function isUsableImageSrc(src: ImageProps["src"]): boolean {
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

/**
 * Imágenes externas sin pasar por /_next/image.
 * Más fiable en Telegram WebView y al abrir enlaces desde el bot.
 * Si `src` no es una URL usable, no renderiza (evita crash de next/image).
 */
export function RemoteImage(props: ImageProps) {
  if (!isUsableImageSrc(props.src)) {
    return null;
  }
  return <Image {...props} unoptimized />;
}
