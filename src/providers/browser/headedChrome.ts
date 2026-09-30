import type { Browser, Page } from "playwright";

/**
 * Google Chrome con ventana real (no headless) para tiendas cuyo Cloudflare
 * bloquea `fetch` y Chromium headless incluso desde IP residencial
 * (Carrefour, PcComponentes). Solo funciona en el Mac: necesita Chrome
 * instalado y una sesión gráfica. La ventana se abre pequeña, fuera de
 * pantalla y minimizada.
 */
export async function launchHeadedChrome(): Promise<Browser> {
  const { chromium } = await import("playwright");
  return chromium.launch({
    channel:
      process.env.HEADED_BROWSER_CHANNEL?.trim() ||
      process.env.CARREFOUR_BROWSER_CHANNEL?.trim() ||
      "chrome",
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      // Ventana mínima (Chrome la deja en ~500×375) en la esquina inferior
      // derecha; `newMinimizedPage` la minimiza nada más abrirla.
      "--window-position=5000,5000",
      "--window-size=320,240",
    ],
  });
}

/**
 * Pestaña con la ventana minimizada: Cloudflare la sigue dejando pasar y
 * macOS devuelve el foco a la app que estabas usando (solo parpadea al abrir).
 */
export async function newMinimizedPage(browser: Browser): Promise<Page> {
  // viewport null: si no, Playwright agranda la ventana al tamaño emulado. Los
  // datos salen del HTML servido (SSR), no dependen del tamaño.
  const page = await browser.newPage({ locale: "es-ES", viewport: null });
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { windowState: "minimized" },
    });
    await cdp.detach();
  } catch {
    // Si no se puede minimizar, sigue fuera de pantalla (--window-position).
  }
  return page;
}

/** Abre Chrome con ventana, ejecuta `fn` en una pestaña minimizada y lo cierra. */
export async function withHeadedChromePage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await launchHeadedChrome();
  try {
    return await fn(await newMinimizedPage(browser));
  } finally {
    await browser.close().catch(() => {});
  }
}
