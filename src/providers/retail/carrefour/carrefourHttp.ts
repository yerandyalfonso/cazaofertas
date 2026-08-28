import { isRetailBlockedHtml } from "@/lib/retail-url-utils";
import { withRetry } from "@/lib/retry";

const CARREFOUR_ORIGIN = "https://www.carrefour.es";

export function carrefourFetchHeaders(
  options: { referer?: string; accept?: string } = {},
): Record<string, string> {
  return {
    Accept:
      options.accept ??
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    Referer: options.referer ?? `${CARREFOUR_ORIGIN}/`,
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "sec-ch-ua":
      '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
    Priority: "u=0, i",
  };
}

export async function fetchCarrefourHtml(
  url: string,
  options: { timeoutMs?: number; referer?: string } = {},
): Promise<string> {
  return withRetry(
    async () => {
      const timeoutMs = options.timeoutMs ?? 18_000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: carrefourFetchHeaders({ referer: options.referer }),
          redirect: "follow",
        });

        if (!response.ok) {
          throw new Error(`Carrefour HTTP ${response.status} para ${url}`);
        }

        const html = await response.text();
        if (isRetailBlockedHtml(html)) {
          throw new Error("Carrefour bloqueó la petición (Cloudflare).");
        }

        return html;
      } finally {
        clearTimeout(timer);
      }
    },
    { attempts: 3, delayMs: 900 },
  );
}

export function normalizeCarrefourProductUrl(url: string): string {
  const parsed = new URL(url.trim(), CARREFOUR_ORIGIN);
  parsed.hash = "";
  return parsed.toString();
}

export function isCarrefourProductUrl(url: string): boolean {
  return /carrefour\.es/i.test(url) && Boolean(extractCarrefourSku(url));
}

export function extractCarrefourSku(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const skuFromQuery = trimmed.match(/[?&]skuId=(\d+)/i);
  if (skuFromQuery?.[1]) return skuFromQuery[1];

  const pathSku = trimmed.match(/(VC4A-\d+)/i);
  if (pathSku?.[1]) return pathSku[1].toUpperCase();

  if (/^VC4A-\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^\d{8,}$/.test(trimmed)) return trimmed;

  return null;
}
