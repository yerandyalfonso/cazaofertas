export const RETAILER_LABELS: Record<string, string> = {
  amazon: "Amazon",
  kiabi: "Kiabi",
  carrefour: "Carrefour",
  miravia: "Miravia",
  aliexpress: "AliExpress",
  pccomponentes: "PcComponentes",
  mediamarkt: "MediaMarkt",
};

/** Color de marca de cada tienda: variables CSS definidas en globals.css. */
export const RETAILER_COLORS: Record<string, string> = {
  amazon: "var(--retailer-amazon)",
  kiabi: "var(--retailer-kiabi)",
  carrefour: "var(--retailer-carrefour)",
  miravia: "var(--retailer-miravia)",
  aliexpress: "var(--retailer-aliexpress)",
  pccomponentes: "var(--retailer-pccomponentes)",
  mediamarkt: "var(--retailer-mediamarkt)",
};

/** Color de una tienda, o el primario si no tiene uno propio. */
export function retailerColor(id: string): string {
  return RETAILER_COLORS[id] ?? "var(--primary)";
}

export function retailerLabel(id: string | null | undefined): string {
  if (!id) return "Tienda";
  if (RETAILER_LABELS[id]) return RETAILER_LABELS[id];
  return id
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const MARKETPLACE_RETAILERS = Object.keys(RETAILER_LABELS);
