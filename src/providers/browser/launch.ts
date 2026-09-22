import type { Browser, Page } from "playwright";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const { chromium } = await import("playwright");
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

/**
 * Navegador headless puntual, solo para el chequeo de alertas de usuario en
 * tiendas donde el scrape por fetch no funciona (Cloudflare Turnstile,
 * SPA renderizada por cliente). Nunca usar en el descubrimiento/recheck
 * masivo de ofertas: un Chromium por producto es demasiado caro para lotes.
 */
export async function withBrowserPage<T>(
  fn: (page: Page) => Promise<T>,
  options?: { userAgent?: string; locale?: string },
): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage({
    userAgent: options?.userAgent ?? DEFAULT_UA,
    locale: options?.locale ?? "es-ES",
  });
  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}

/** Cierra el navegador compartido si se llegó a lanzar (fin del proceso cron). */
export async function closeSharedBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close().catch(() => {});
}
