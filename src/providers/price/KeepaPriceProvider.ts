import type { PriceProvider, ProductPriceData } from "@/providers/price/types";
import { ProductAvailability } from "@/types";

/**
 * Dominios Keepa: 1=com, 2=co.uk, 3=de, 4=fr, 5=co.jp, 6=ca, 8=it, 9=es, …
 * @see https://keepa.com/#!discuss/t/product-object/116
 */
const KEEPA_DOMAIN_BY_MARKETPLACE: Record<string, number> = {
  ES: 9,
  DE: 3,
  FR: 4,
  IT: 8,
  UK: 2,
  US: 1,
};

export interface KeepaPriceProviderOptions {
  apiKey: string;
  /** Código marketplace (ES, DE, …). Default ES. */
  marketplace?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Pausa entre lotes (Keepa rate-limits). */
  delayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function centsToEuro(cents: number | null | undefined): number | null {
  if (cents === null || cents === undefined || cents < 0) return null;
  return Math.round(cents) / 100;
}

/**
 * Proveedor Keepa (API oficial de histórico/precios Amazon).
 * Actívalo con KEEPA_API_KEY (y PRICE_PROVIDER=keepa|auto).
 */
export class KeepaPriceProvider implements PriceProvider {
  private readonly apiKey: string;
  private readonly domain: number;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly delayMs: number;

  constructor(options: KeepaPriceProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("KeepaPriceProvider requiere apiKey (KEEPA_API_KEY).");
    }
    this.apiKey = options.apiKey.trim();
    const market = (options.marketplace ?? "ES").toUpperCase();
    this.domain = KEEPA_DOMAIN_BY_MARKETPLACE[market] ?? 9;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.delayMs = options.delayMs ?? 1_100;
  }

  async getProduct(asin: string): Promise<ProductPriceData> {
    const [product] = await this.getProducts([asin]);
    if (!product) {
      throw new Error(`Keepa no devolvió datos para ${asin}.`);
    }
    return product;
  }

  async getProducts(asins: string[]): Promise<ProductPriceData[]> {
    const results: ProductPriceData[] = [];
    const unique = [...new Set(asins.map((a) => a.trim().toUpperCase()).filter(Boolean))];

    // Keepa acepta varios ASINs por petición; lotes de 10.
    for (let i = 0; i < unique.length; i += 10) {
      if (i > 0 && this.delayMs > 0) await sleep(this.delayMs);
      const batch = unique.slice(i, i + 10);
      const batchResults = await this.fetchBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  private async fetchBatch(asins: string[]): Promise<ProductPriceData[]> {
    const url = new URL("https://api.keepa.com/product");
    url.searchParams.set("key", this.apiKey);
    url.searchParams.set("domain", String(this.domain));
    url.searchParams.set("asin", asins.join(","));
    url.searchParams.set("stats", "1");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Keepa HTTP ${response.status}: ${body.slice(0, 200) || response.statusText}`,
        );
      }

      const payload = (await response.json()) as {
        products?: Array<{
          asin?: string;
          title?: string;
          brand?: string;
          csv?: Array<Array<number> | null>;
          stats?: {
            current?: Array<number | null>;
            avg30?: Array<number | null>;
            avg90?: Array<number | null>;
          };
        }>;
        error?: string;
      };

      if (payload.error) {
        throw new Error(`Keepa: ${payload.error}`);
      }

      const out: ProductPriceData[] = [];
      for (const product of payload.products ?? []) {
        const asin = product.asin?.toUpperCase();
        if (!asin) continue;

        // csv[0] = Amazon price history; stats.current[0] = último precio Amazon (céntimos)
        const currentCents =
          product.stats?.current?.[0] ??
          lastCsvPriceCents(product.csv?.[0] ?? null);
        const price = centsToEuro(currentCents);
        if (price === null) continue;

        out.push({
          asin,
          price,
          currency: "EUR",
          availability: ProductAvailability.IN_STOCK,
          title: product.title,
          brand: product.brand,
        });
      }
      return out;
    } finally {
      clearTimeout(timer);
    }
  }
}

function lastCsvPriceCents(series: Array<number> | null): number | null {
  if (!series || series.length < 2) return null;
  // Keepa CSV: [time, price, time, price, …]; -1 = sin dato
  for (let i = series.length - 1; i >= 1; i -= 2) {
    const price = series[i];
    if (typeof price === "number" && price >= 0) return price;
  }
  return null;
}
