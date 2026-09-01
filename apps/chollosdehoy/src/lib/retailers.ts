export const RETAILER_LABELS: Record<string, string> = {
  amazon: "Amazon",
  kiabi: "Kiabi",
  carrefour: "Carrefour",
  miravia: "Miravia",
};

export const RETAILER_COLORS: Record<string, string> = {
  amazon: "#FF9900",
  kiabi: "#E4002B",
  carrefour: "#004E9F",
  miravia: "#6C2BD9",
};

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
