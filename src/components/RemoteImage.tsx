import Image, { type ImageProps } from "next/image";

/**
 * Imágenes externas sin pasar por /_next/image.
 * Más fiable en Telegram WebView y al abrir enlaces desde el bot.
 */
export function RemoteImage(props: ImageProps) {
  return <Image {...props} unoptimized />;
}
