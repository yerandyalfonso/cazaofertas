const MARKETPLACE_DOMAINS: Record<string, string> = {
  ES: "www.amazon.es",
  FR: "www.amazon.fr",
  DE: "www.amazon.de",
  IT: "www.amazon.it",
  UK: "www.amazon.co.uk",
};

const DEFAULT_ASSOCIATE_TAG = "cazaoferta-21";

export interface AffiliateProductInput {
  amazon_url?: string | null;
  affiliate_url?: string | null;
  asin?: string | null;
}

export type AffiliateUrlInput = string | AffiliateProductInput;

function getAssociateTag(): string {
  return process.env.AMAZON_ASSOCIATE_TAG?.trim() || DEFAULT_ASSOCIATE_TAG;
}

function getMarketplaceDomain(): string {
  const marketplace = process.env.AMAZON_MARKETPLACE ?? "ES";
  return MARKETPLACE_DOMAINS[marketplace] ?? MARKETPLACE_DOMAINS.ES;
}

export function extractAsin(value: string): string | null {
  const trimmed = value.trim();
  const fromDp = trimmed.match(/\/dp\/([A-Z0-9]{10})/i);
  if (fromDp) {
    return fromDp[1].toUpperCase();
  }

  const fromProduct = trimmed.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  if (fromProduct) {
    return fromProduct[1].toUpperCase();
  }

  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return null;
}

export function generateAmazonUrl(asin: string): string {
  const domain = getMarketplaceDomain();
  return `https://${domain}/dp/${asin}`;
}

function applyAffiliateTag(urlString: string, tag: string): string {
  const url = new URL(urlString);
  url.searchParams.set("tag", tag);
  return url.toString();
}

function resolveSourceUrl(input: AffiliateUrlInput): string {
  if (typeof input === "string") {
    const trimmed = input.trim();

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }

    const asin = extractAsin(trimmed);
    if (asin) {
      return generateAmazonUrl(asin);
    }

    throw new Error(
      `No se pudo resolver URL de Amazon desde: "${trimmed.slice(0, 80)}"`,
    );
  }

  const directUrl = input.affiliate_url ?? input.amazon_url;
  if (directUrl) {
    return directUrl;
  }

  if (input.asin) {
    return generateAmazonUrl(input.asin);
  }

  throw new Error(
    "generateAffiliateUrl requiere amazon_url, affiliate_url o asin.",
  );
}

/**
 * Genera una URL de afiliado de Amazon con el parámetro tag configurado.
 * Nunca construyas enlaces de compra directamente en componentes de UI.
 */
export function generateAffiliateUrl(input: AffiliateUrlInput): string {
  const tag = getAssociateTag();
  const sourceUrl = resolveSourceUrl(input);
  return applyAffiliateTag(sourceUrl, tag);
}
