import { scrapeCarrefourProductWithBrowser } from "@/providers/retail/carrefour/carrefourBrowserDiscovery";

export interface CarrefourProductQuote {
  productUrl: string;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
  price: number | null;
  listPrice: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
}

/**
 * Carrefour (Cloudflare) bloquea el Chromium headless compartido de
 * `withBrowserPage`, incluso desde IP residencial: se usa Google Chrome con
 * ventana fuera de pantalla. Solo funciona en el Mac (alertas residenciales).
 */
export async function scrapeCarrefourProductPage(
  url: string,
  options?: { timeoutMs?: number },
): Promise<CarrefourProductQuote> {
  const quote = await scrapeCarrefourProductWithBrowser(url, {
    timeoutMs: Math.max(options?.timeoutMs ?? 0, 30_000),
  });
  return {
    productUrl: quote.productUrl,
    title: quote.title,
    brand: quote.brand,
    imageUrl: quote.imageUrl,
    price: quote.price,
    listPrice: quote.listPrice,
    availability: quote.availability,
  };
}
