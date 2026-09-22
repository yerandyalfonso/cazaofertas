import { withBrowserPage } from "@/providers/browser/launch";

export interface AliexpressProductQuote {
  productUrl: string;
  title: string | null;
  imageUrl: string | null;
  price: number | null;
  listPrice: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
}

function parseEuroAmount(text: string): number | null {
  const match = text.match(/(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})\s?€/);
  if (!match) return null;
  const normalized = match[1].replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * La ficha de AliExpress se renderiza por JS del cliente (SSR vacío), así
 * que hace falta navegador headless. No hay JSON-LD fiable ni selectores
 * estables (clases obfuscadas que cambian), así que parseamos el texto
 * visible — es lo que usan la mayoría de scrapers de AliExpress en producción.
 */
export async function scrapeAliexpressProductPage(
  url: string,
  options?: { timeoutMs?: number },
): Promise<AliexpressProductQuote> {
  return withBrowserPage(
    async (page) => {
      const resp = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: options?.timeoutMs ?? 20_000,
      });
      if (resp && resp.status() >= 400) {
        throw new Error(`AliExpress HTTP ${resp.status()} para ${url}`);
      }
      await page.waitForTimeout(4_000);

      const { title, bodyText, imageUrl } = await page.evaluate(() => ({
        title: document.title,
        bodyText: document.body.innerText,
        imageUrl:
          document
            .querySelector<HTMLMetaElement>('meta[property="og:image"]')
            ?.content?.trim() || null,
      }));

      if (/expired|producto ya no está disponible|item is not available/i.test(bodyText)) {
        throw new Error("AliExpress: producto expirado o no disponible.");
      }

      const cleanTitle =
        title.replace(/\s*-\s*AliExpress.*$/i, "").trim() || null;

      if (!cleanTitle) {
        throw new Error("AliExpress: no se pudo leer la ficha (bloqueo o URL inválida).");
      }

      const amounts = [...bodyText.matchAll(/(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})\s?€/g)].map(
        (m) => m[0],
      );
      const price = amounts[0] ? parseEuroAmount(amounts[0]) : null;
      const referenceMatch = bodyText.match(
        /(?:antes del descuento|precio original|price before discount)[^\d]*(\d{1,3}(?:[.\s]\d{3})*[.,]\d{2})\s?€/i,
      );
      const listPrice = referenceMatch
        ? parseEuroAmount(`${referenceMatch[1]}€`)
        : amounts[1] && amounts[1] !== amounts[0]
          ? parseEuroAmount(amounts[1])
          : null;

      const availability = /agotado|out of stock|no disponible/i.test(bodyText)
        ? "OUT_OF_STOCK"
        : price != null
          ? "IN_STOCK"
          : "UNKNOWN";

      return {
        productUrl: url,
        title: cleanTitle,
        imageUrl,
        price,
        listPrice: listPrice != null && listPrice > (price ?? 0) ? listPrice : null,
        availability,
      };
    },
    { locale: "es-ES" },
  );
}
