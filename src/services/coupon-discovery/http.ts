const DEFAULT_HEADERS: HeadersInit = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "accept-language": "es-ES,es;q=0.9",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export async function fetchHtml(
  url: string,
  options?: { referer?: string; timeoutMs?: number },
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        ...DEFAULT_HEADERS,
        ...(options?.referer ? { referer: options.referer } : {}),
      },
      signal: AbortSignal.timeout(options?.timeoutMs ?? 15_000),
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(`[coupons] HTTP ${res.status} ${url}`);
      return null;
    }
    return await res.text();
  } catch (error) {
    console.warn(`[coupons] fetch ${url}:`, (error as Error).message);
    return null;
  }
}

/** Códigos tipo MODA15, SAVE10, BIENVENIDO (evita CSS/HTML cortos). */
const CODE_RE =
  /\b(?![0-9]+$)(?![A-F0-9]{8,}$)([A-ZÁÉÍÓÚÑ][A-Z0-9ÁÉÍÓÚÑ_-]{3,19})\b/g;

const CODE_DENY = new Set([
  "HTTP",
  "HTTPS",
  "HTML",
  "JSON",
  "TRUE",
  "FALSE",
  "NULL",
  "NONE",
  "HOME",
  "SHOP",
  "CART",
  "LOGIN",
  "EMAIL",
  "COOKIE",
  "SCRIPT",
  "STYLE",
  "CLASS",
  "WIDTH",
  "HEIGHT",
  "IMAGE",
  "CLICK",
  "BUTTON",
  "TITLE",
  "AMAZON",
  "KIABI",
  "MIRAVIA",
  "CARREFOUR",
  "PRIME",
  "OFERTA",
  "OFERTAS",
  "DESCUENTO",
  "PROMOCION",
  "PROMOCIÓN",
  "ENVIO",
  "ENVÍO",
  "GRATIS",
  "EURO",
  "EUROS",
]);

export function extractPromoCodes(text: string): string[] {
  const upper = text.toUpperCase();
  const found = new Set<string>();
  for (const match of upper.matchAll(CODE_RE)) {
    const code = match[1];
    if (!code || CODE_DENY.has(code)) continue;
    if (/^[A-Z]{1,3}$/.test(code)) continue;
    found.add(code);
  }
  return [...found];
}

export function pageTitle(html: string): string | null {
  const raw = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  if (!raw) return null;
  return raw.replace(/\s+/g, " ").slice(0, 120);
}

export function extractExpiry(text: string): string | undefined {
  const m = text.match(
    /(?:hasta|válido hasta|caduca|expira)[^\d]{0,20}(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,
  );
  if (!m) return undefined;
  const day = m[1].padStart(2, "0");
  const month = m[2].padStart(2, "0");
  let year = m[3];
  if (year.length === 2) year = `20${year}`;
  return `${year}-${month}-${day}`;
}
