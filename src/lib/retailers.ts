import {
  extractAsin,
  generateAmazonUrl,
  generateAffiliateUrl,
} from "@/lib/affiliate";

export const PRODUCT_RETAILERS = [
  "amazon",
  "kiabi",
  "carrefour",
  "miravia",
] as const;
export type ProductRetailer = (typeof PRODUCT_RETAILERS)[number];

export interface RetailerDefinition {
  id: ProductRetailer;
  label: string;
  hostPatterns: RegExp[];
  urlPlaceholder: string;
  scrapeSupported: boolean;
  externalIdHint: string;
  defaultBrand?: string;
  defaultCategorySlug?: string;
}

/** Registro de tiendas: añade una entrada aquí al integrar una nueva. */
export const RETAILER_DEFINITIONS: RetailerDefinition[] = [
  {
    id: "amazon",
    label: "Amazon",
    hostPatterns: [/amazon\.(es|com|de|fr|it|co\.uk)/i],
    urlPlaceholder: "https://www.amazon.es/.../dp/B0XXXXXXXX/",
    scrapeSupported: true,
    externalIdHint: "ASIN (10 caracteres)",
  },
  {
    id: "kiabi",
    label: "Kiabi",
    hostPatterns: [/kiabi\.(es|com|fr)/i],
    urlPlaceholder: "https://www.kiabi.es/..._P########C####.html",
    scrapeSupported: true,
    externalIdHint: "P…C… (en la URL)",
    defaultBrand: "Kiabi",
    defaultCategorySlug: "moda",
  },
  {
    id: "carrefour",
    label: "Carrefour",
    hostPatterns: [/carrefour\.es/i],
    urlPlaceholder: "https://www.carrefour.es/...",
    scrapeSupported: false,
    externalIdHint: "skuId o VC4A-… en la URL",
  },
  {
    id: "miravia",
    label: "Miravia",
    hostPatterns: [/miravia\.es/i],
    urlPlaceholder: "https://www.miravia.es/p/i…-s….html",
    scrapeSupported: true,
    externalIdHint: "itemId (números en /p/i…)",
    defaultBrand: "Miravia",
  },
];

export function getRetailerDefinition(
  retailer: ProductRetailer,
): RetailerDefinition {
  return (
    RETAILER_DEFINITIONS.find((item) => item.id === retailer) ??
    RETAILER_DEFINITIONS[0]
  );
}

export function detectRetailerFromUrl(url: string): ProductRetailer | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  for (const definition of RETAILER_DEFINITIONS) {
    if (definition.hostPatterns.some((pattern) => pattern.test(trimmed))) {
      return definition.id;
    }
  }

  return null;
}

export function retailerScrapeSupported(retailer: ProductRetailer): boolean {
  return getRetailerDefinition(retailer).scrapeSupported;
}

export function isProductRetailer(value: string): value is ProductRetailer {
  return (PRODUCT_RETAILERS as readonly string[]).includes(value);
}

export function normalizeRetailer(
  value: string | null | undefined,
): ProductRetailer {
  if (value && isProductRetailer(value)) return value;
  return "amazon";
}

/** ID sintético en `products.asin` para no romper el esquema legacy. */
export function syntheticAsinForRetailer(
  retailer: ProductRetailer,
  externalId: string,
): string {
  const clean = externalId.trim().toUpperCase();
  if (retailer === "amazon") return clean;
  if (retailer === "kiabi") return `KB-${clean}`;
  if (retailer === "carrefour") return `CF-${clean}`;
  if (retailer === "miravia") return `MV-${clean}`;
  return `RT-${clean}`;
}

export function extractMiraviaProductId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const fromUrl = trimmed.match(/\/p\/i(\d+)(?:-s\d+)?(?:\.html)?/i);
  if (fromUrl?.[1]) return fromUrl[1];

  if (/^\d{8,}$/.test(trimmed)) return trimmed;
  return null;
}

export function extractKiabiProductId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const fromUrl = trimmed.match(/_(P\d+C\d+)/i);
  if (fromUrl?.[1]) return fromUrl[1].toUpperCase();

  if (/^P\d+C\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

function extractCarrefourProductId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const skuFromQuery = trimmed.match(/[?&]skuId=(\d+)/i);
  if (skuFromQuery?.[1]) return skuFromQuery[1];

  const pathSku = trimmed.match(/(VC4A-\d+)/i);
  if (pathSku?.[1]) return pathSku[1].toUpperCase();

  if (/^VC4A-\d+$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^\d{8,}$/.test(trimmed)) return trimmed;
  return null;
}

export function extractExternalId(
  retailer: ProductRetailer,
  urlOrId: string,
): string | null {
  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  switch (retailer) {
    case "amazon":
      return extractAsin(trimmed)?.toUpperCase() ?? null;
    case "kiabi":
      return extractKiabiProductId(trimmed);
    case "carrefour":
      return extractCarrefourProductId(trimmed);
    case "miravia":
      return extractMiraviaProductId(trimmed);
    default:
      return trimmed.length >= 3 ? trimmed : null;
  }
}

export function resolveCanonicalProductUrl(
  retailer: ProductRetailer,
  input: string,
  externalId: string,
): string {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (retailer === "amazon") return generateAmazonUrl(externalId);
  return trimmed;
}

export function isKiabiProductUrl(url: string): boolean {
  return /kiabi\.(es|com|fr)/i.test(url) && Boolean(extractKiabiProductId(url));
}

export function normalizeKiabiProductUrl(url: string): string {
  const parsed = new URL(url.trim());
  parsed.hash = "";
  return parsed.toString();
}

export interface ProductLinkFields {
  retailer?: string | null;
  asin?: string | null;
  external_id?: string | null;
  product_url?: string | null;
  amazon_url?: string | null;
  affiliate_url?: string | null;
}

/** URL pública del producto (catálogo, redirects). */
export function resolveProductPageUrl(product: ProductLinkFields): string {
  return (
    product.product_url?.trim() ||
    product.amazon_url?.trim() ||
    (product.asin && normalizeRetailer(product.retailer) === "amazon"
      ? `https://www.amazon.es/dp/${product.asin}`
      : "")
  );
}

/**
 * URL de compra/afiliado.
 * Amazon: siempre reaplica el tag actual (aunque haya affiliate_url guardada).
 * Otras tiendas: affiliate_url si existe; si no, product_url / amazon_url normal.
 */
export function resolveProductBuyUrl(product: ProductLinkFields): string {
  const retailer = normalizeRetailer(product.retailer);

  if (retailer === "amazon") {
    return generateAffiliateUrl({
      amazon_url: product.amazon_url ?? product.product_url,
      affiliate_url: product.affiliate_url,
      asin: product.asin,
    });
  }

  const affiliate = product.affiliate_url?.trim();
  if (affiliate) {
    return affiliate;
  }

  const direct = resolveProductPageUrl(product);
  if (!direct) {
    throw new Error("No se pudo resolver URL de compra para el producto.");
  }
  return direct;
}

export function retailerLabel(retailer: string | null | undefined): string {
  if (!retailer) return "Amazon";
  if (isProductRetailer(retailer)) {
    return getRetailerDefinition(retailer).label;
  }
  return retailer.charAt(0).toUpperCase() + retailer.slice(1);
}

/** Colores de badge de tienda (alineados con marketplace /cupones). */
export const RETAILER_COLORS: Record<string, string> = {
  amazon: "#FF9900",
  kiabi: "#E4002B",
  carrefour: "#004E9F",
  miravia: "#6C2BD9",
};

export function retailerColor(retailer: string | null | undefined): string {
  if (!retailer) return "#4f7f6a";
  return RETAILER_COLORS[retailer.toLowerCase()] ?? "#4f7f6a";
}

/** CTA principal en ficha de producto: "Ir a Kiabi", "Ir a Amazon", etc. */
export function retailerBuyCtaLabel(retailer: string | null | undefined): string {
  return `Ir a ${retailerLabel(retailer)}`;
}

/** CTA en tarjetas y listados: "Ver en Kiabi", etc. */
export function retailerViewCtaLabel(retailer: string | null | undefined): string {
  return `Ver en ${retailerLabel(retailer)}`;
}

/** Hashtag Telegram de tienda (#amazon, #miravia, …). */
export function formatRetailerHashtag(
  retailer: string | null | undefined,
): string | null {
  const normalized = retailer?.trim().toLowerCase();
  if (!normalized || !isProductRetailer(normalized)) return null;
  return `#${normalized}`;
}
