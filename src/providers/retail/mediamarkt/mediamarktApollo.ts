import { roundMoney } from "@/lib/money";

/*
 * Lectura del estado Apollo que MediaMarkt incrusta en `__PRELOADED_STATE__`
 * (ficha y listados). El estado entero no es JSON válido (lleva
 * `undefined`), así que se localiza cada entidad por su `__typename` + `id`
 * y solo se parsea ese objeto.
 */

/**
 * Devuelve el objeto JSON que empieza en `start` (una `{`), respetando
 * cadenas.
 */
function sliceJsonObject(html: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (ch === "\\") i += 1;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

/** Entidad `{"__typename":"<typename>","id":"<id>",…}` o null. */
export function readApolloEntity<T>(
  html: string,
  typename: string,
  id: string,
): T | null {
  const at = html.indexOf(`"__typename":"${typename}","id":"${id}"`);
  if (at < 0) return null;
  const start = html.lastIndexOf("{", at);
  const raw = start >= 0 ? sliceJsonObject(html, start) : null;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Ids de producto («Media:es:<id>») con ficha en el estado de la página. */
export function listApolloProductIds(html: string): string[] {
  const ids = html.matchAll(/"__typename":"CofrCoreFeature","id":"Media:es:(\d+)"/g);
  return [...new Set([...ids].map((match) => match[1]!))];
}

export interface ApolloPriceFeature {
  price?: { amount?: number; discount?: number | null } | null;
  /** `type`: «XOP» = precio anterior (rebaja real); «RRP» = PVPR del fabricante. */
  strikePrice?: { amount?: number; shouldBeStruck?: boolean; type?: string | null } | null;
  marketplaceSeller?: { sellerName?: string } | null;
}

export interface ApolloOnlineStatus {
  isAvailableAndBuyable?: boolean;
  onlineStatus?: string;
}

export interface ApolloCoreFeature {
  ean?: string | null;
  manufacturerName?: string | null;
  productName?: string | null;
  urlRelative?: string | null;
  isProductOfTypeMarketplace?: boolean;
  breadcrumbs?: Array<{ __ref?: string }> | null;
}

export interface ApolloMediaAssets {
  productMainImage?: { link?: string | null } | null;
}

export function toPrice(value: unknown): number | null {
  const n =
    typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? roundMoney(n) : null;
}

/** Precio actual y tachado (solo si la tienda lo muestra tachado). */
export function pricesFromFeature(feature: ApolloPriceFeature | null): {
  price: number | null;
  listPrice: number | null;
} {
  const price = toPrice(feature?.price?.amount);
  // Un PVPR tachado no es una rebaja (como en Amazon y PcComponentes): sin referencia.
  if (feature?.strikePrice?.type?.toUpperCase() === "RRP") {
    return { price, listPrice: null };
  }
  const strike = feature?.strikePrice?.shouldBeStruck
    ? toPrice(feature.strikePrice.amount)
    : null;
  const discount = toPrice(feature?.price?.discount);
  const candidate =
    strike ?? (price != null && discount != null ? roundMoney(price + discount) : null);
  return {
    price,
    listPrice: price != null && candidate != null && candidate > price ? candidate : null,
  };
}

/** Nombres de la ruta de categorías de MediaMarkt (Informática › Portátiles…). */
export function categoryNamesFromCore(html: string, core: ApolloCoreFeature | null): string[] {
  const names: string[] = [];
  for (const crumb of core?.breadcrumbs ?? []) {
    const id = crumb.__ref?.replace(/^CofrCatalogDataApiCategoryPathElement:/, "");
    if (!id) continue;
    const element = readApolloEntity<{ categoryName?: string }>(
      html,
      "CofrCatalogDataApiCategoryPathElement",
      id,
    );
    if (element?.categoryName) names.push(element.categoryName);
  }
  return names;
}
