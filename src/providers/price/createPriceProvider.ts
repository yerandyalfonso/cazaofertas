import { resolveAmazonAssociateTagSync } from "@/services/appSettings";
import { AmazonCreatorsApiProvider } from "@/providers/price/AmazonCreatorsApiProvider";
import { AmazonHtmlPriceProvider } from "@/providers/price/AmazonHtmlPriceProvider";
import { KeepaPriceProvider } from "@/providers/price/KeepaPriceProvider";
import type { PriceProvider } from "@/providers/price/types";

export type PriceProviderId = "html" | "keepa" | "creators" | "auto";

export interface ResolvePriceProviderOptions {
  /** Mapa ASIN → URL (necesario para HTML / fallback Creators). */
  urlByAsin?: Map<string, string>;
  delayMs?: number;
  timeoutMs?: number;
  /** Fuerza un proveedor (tests). */
  force?: PriceProviderId;
}

function readProviderId(): PriceProviderId {
  const raw = (
    process.env.PRICE_PROVIDER ??
    process.env.AMAZON_PRICE_PROVIDER ??
    "auto"
  )
    .trim()
    .toLowerCase();

  if (raw === "html" || raw === "amazon-html" || raw === "scraper") return "html";
  if (raw === "keepa") return "keepa";
  if (raw === "creators" || raw === "paapi" || raw === "pa-api") return "creators";
  return "auto";
}

function hasKeepaCredentials(): boolean {
  return Boolean(process.env.KEEPA_API_KEY?.trim());
}

function hasCreatorsCredentials(): boolean {
  return Boolean(
    process.env.AMAZON_API_ACCESS_KEY?.trim() &&
      process.env.AMAZON_API_SECRET?.trim() &&
      (resolveAmazonAssociateTagSync() ||
        process.env.AMAZON_PARTNER_TAG?.trim()),
  );
}

function createHtmlProvider(
  options: ResolvePriceProviderOptions,
): AmazonHtmlPriceProvider {
  const onVercel = Boolean(process.env.VERCEL);
  return new AmazonHtmlPriceProvider({
    urlByAsin: options.urlByAsin,
    delayMs: options.delayMs ?? (onVercel ? 2_200 : 1_400),
    timeoutMs: options.timeoutMs ?? (onVercel ? 18_000 : 12_000),
  });
}

function createKeepaProvider(): KeepaPriceProvider {
  const apiKey = process.env.KEEPA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Falta KEEPA_API_KEY para PRICE_PROVIDER=keepa.");
  }
  return new KeepaPriceProvider({
    apiKey,
    marketplace: process.env.AMAZON_MARKETPLACE ?? "ES",
  });
}

function createCreatorsProvider(
  options: ResolvePriceProviderOptions,
): AmazonCreatorsApiProvider {
  const accessKey = process.env.AMAZON_API_ACCESS_KEY?.trim() ?? "";
  const secretKey = process.env.AMAZON_API_SECRET?.trim() ?? "";
  const partnerTag =
    resolveAmazonAssociateTagSync() ||
    process.env.AMAZON_PARTNER_TAG?.trim() ||
    "";

  return new AmazonCreatorsApiProvider({
    accessKey,
    secretKey,
    partnerTag,
    marketplace: process.env.AMAZON_MARKETPLACE ?? "ES",
    // Mientras SigV4 no esté activo, el HTML actúa de red de seguridad.
    fallback: createHtmlProvider(options),
    strict: process.env.AMAZON_CREATORS_STRICT === "1",
  });
}

export interface ResolvedPriceProvider {
  id: Exclude<PriceProviderId, "auto">;
  provider: PriceProvider;
  source: "amazon" | "keepa";
}

/**
 * Selecciona el PriceProvider según env:
 * - PRICE_PROVIDER=html|keepa|creators|auto (default auto)
 * - auto: creators (si hay keys) → keepa → html
 */
export function resolvePriceProvider(
  options: ResolvePriceProviderOptions = {},
): ResolvedPriceProvider {
  const requested = options.force ?? readProviderId();

  const pick = (id: Exclude<PriceProviderId, "auto">): ResolvedPriceProvider => {
    if (id === "keepa") {
      return { id: "keepa", provider: createKeepaProvider(), source: "keepa" };
    }
    if (id === "creators") {
      return {
        id: "creators",
        provider: createCreatorsProvider(options),
        source: "amazon",
      };
    }
    return {
      id: "html",
      provider: createHtmlProvider(options),
      source: "amazon",
    };
  };

  if (requested !== "auto") {
    return pick(requested);
  }

  if (hasCreatorsCredentials()) return pick("creators");
  if (hasKeepaCredentials()) return pick("keepa");
  return pick("html");
}
