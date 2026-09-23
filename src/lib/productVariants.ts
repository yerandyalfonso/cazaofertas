import type { Json } from "@/types/database";

/**
 * Variantes de Amazon (talla, color…): cada una tiene ASIN propio pero
 * comparten `parentAsin`. Se guardan en `products.parent_asin` /
 * `products.variant_info` para enviar una sola variante por producto y
 * listar el resto de opciones en el mensaje.
 */
export interface ProductVariantDimension {
  /** Clave Amazon (`size_name`, `color_name`, …). */
  key: string;
  /** Etiqueta visible («Tamaño», «Color»). */
  label: string;
  /** Todas las opciones que ofrece Amazon para esta dimensión. */
  values: string[];
}

export interface ProductVariantInfo {
  parentAsin: string;
  /** Valores de esta variante concreta, en el orden de `dimensions`. */
  own: string[];
  dimensions: ProductVariantDimension[];
  /** ASINs de las demás variantes del mismo padre (sin incluir este). */
  siblingAsins: string[];
}

function parseFlatJsonObject<T>(html: string, key: string): T | null {
  // Los objetos del twister de Amazon no tienen objetos anidados.
  const match = html.match(new RegExp(`"${key}"\\s*:\\s*(\\{[^{}]*\\})`));
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

export function extractAmazonVariantInfo(
  html: string,
  asin: string,
): ProductVariantInfo | null {
  const parentAsin = html
    .match(/"parentAsin"\s*:\s*"([A-Z0-9]{10})"/)?.[1]
    ?.toUpperCase();
  if (!parentAsin || parentAsin === asin.toUpperCase()) return null;

  const values =
    parseFlatJsonObject<Record<string, string[]>>(html, "variationValues") ?? {};
  const labels =
    parseFlatJsonObject<Record<string, string>>(html, "variationDisplayLabels") ??
    {};
  const byAsin =
    parseFlatJsonObject<Record<string, string[]>>(
      html,
      "dimensionValuesDisplayData",
    ) ?? {};

  const orderMatch = html.match(/"dimensions"\s*:\s*(\[[^\]]*\])/)?.[1];
  let order: string[] = [];
  try {
    order = orderMatch ? (JSON.parse(orderMatch) as string[]) : [];
  } catch {
    order = [];
  }
  if (order.length === 0) order = Object.keys(values);

  const dimensions = order
    .filter((key) => Array.isArray(values[key]) && values[key]!.length > 0)
    .map((key) => ({
      key,
      label: labels[key]?.trim() || key.replace(/_name$/, ""),
      values: values[key]!.map((value) => String(value).trim()).filter(Boolean),
    }));

  return {
    parentAsin,
    own: (byAsin[asin.toUpperCase()] ?? []).map((value) => String(value).trim()),
    dimensions,
    siblingAsins: Object.keys(byAsin)
      .map((key) => key.toUpperCase())
      .filter((key) => /^[A-Z0-9]{10}$/.test(key) && key !== asin.toUpperCase()),
  };
}

const DIMENSION_EMOJI: Record<string, string> = {
  size_name: "📏",
  color_name: "🎨",
  style_name: "✨",
  pattern_name: "🔷",
};
const MAX_LISTED_VALUES = 5;

/** «36 EU … 48 EU» → «36 EU – 48 EU» si todas son números con el mismo sufijo. */
function compressNumericRange(values: string[]): string | null {
  if (values.length < 4) return null;
  const parsed = values.map((value) =>
    value.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/),
  );
  if (parsed.some((match) => !match)) return null;
  const suffix = parsed[0]![2]!;
  if (parsed.some((match) => match![2] !== suffix)) return null;
  const numbers = parsed.map((match) => Number(match![1]!.replace(",", ".")));
  const min = values[numbers.indexOf(Math.min(...numbers))]!;
  const max = values[numbers.indexOf(Math.max(...numbers))]!;
  return `${min} – ${max}`;
}

function formatDimensionValues(values: string[]): string {
  const range = compressNumericRange(values);
  if (range) return range;
  const shown = values.slice(0, MAX_LISTED_VALUES).join(" · ");
  return values.length > MAX_LISTED_VALUES
    ? `${shown} (+${values.length - MAX_LISTED_VALUES})`
    : shown;
}

/** Líneas de texto plano (sin escapar) para añadir al mensaje del chollo. */
export function formatVariantLines(
  info: ProductVariantInfo | null | undefined,
): string[] {
  if (!info) return [];
  const dimensions = info.dimensions.filter((dim) => dim.values.length > 1);
  if (dimensions.length === 0) return [];

  const lines: string[] = [];
  const own = info.own.filter(Boolean);
  if (own.length > 0) lines.push(`🎯 Oferta en: ${own.join(" · ")}`);
  for (const dim of dimensions) {
    const emoji = DIMENSION_EMOJI[dim.key] ?? "🔹";
    lines.push(`${emoji} ${dim.label}: ${formatDimensionValues(dim.values)}`);
  }
  return lines;
}

/** Valor para `products.variant_info` (jsonb). */
export function variantInfoForStorage(
  info: ProductVariantInfo | null | undefined,
): Json | null {
  return info ? (info as unknown as Json) : null;
}

export function parseStoredVariantInfo(raw: unknown): ProductVariantInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const info = raw as Partial<ProductVariantInfo>;
  if (typeof info.parentAsin !== "string" || !Array.isArray(info.dimensions)) {
    return null;
  }
  return {
    parentAsin: info.parentAsin,
    own: Array.isArray(info.own) ? info.own.map(String) : [],
    dimensions: info.dimensions.filter(
      (dim): dim is ProductVariantDimension =>
        Boolean(dim) &&
        typeof dim.key === "string" &&
        typeof dim.label === "string" &&
        Array.isArray(dim.values),
    ),
    siblingAsins: Array.isArray(info.siblingAsins)
      ? info.siblingAsins.map(String)
      : [],
  };
}
