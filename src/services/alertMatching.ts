import { toNumber } from "@/lib/money";
import type { TypedSupabaseClient } from "@/lib/supabase";
import type { DealLevel } from "@/types";
import type { Database } from "@/types/database";

export type AlertRow = Database["public"]["Tables"]["alerts"]["Row"];
export type UserRow = Database["public"]["Tables"]["users"]["Row"];

export interface DealCandidate {
  productId: string;
  asin: string;
  title: string;
  brand: string | null;
  categoryId: string | null;
  /** Slug de subcategoría interna (ruteo Telegram). */
  categorySlug?: string | null;
  /** Nombre visible de la subcategoría. */
  categoryName?: string | null;
  /** Slug de categoría padre (blog). */
  parentCategorySlug?: string | null;
  /** Nombre de categoría padre (blog). */
  parentCategoryName?: string | null;
  /** Tienda de compra (`amazon`, `kiabi`, `miravia`, …) para hashtag #tienda. */
  retailer?: string | null;
  currentPrice: number;
  previousPrice: number;
  discountPercentage: number;
  dealLevel: DealLevel;
  affiliateUrl: string;
  nearHistoricalLow: boolean;
  /** Slug público `/producto/[slug]` para el botón “Ver en la web”. */
  productSlug?: string | null;
  /** Score 0–100 del motor de chollos (opcional para canal). */
  score?: number;
  dealLabel?: string;
  /** Imagen del producto (Telegram sendPhoto). */
  imageUrl?: string | null;
  /** Resumen corto bajo el título. */
  summary?: string | null;
  /** Cuando se detectó / encoló (mensaje Telegram). */
  detectedAt?: string | null;
  /** Caducidad Amazon si existe. */
  expiresAt?: string | null;
}

export interface AlertMatch {
  alert: AlertRow;
  user: UserRow;
}

function normalizeBrand(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.trim().toLowerCase();
}

export function alertMatchesDeal(alert: AlertRow, deal: DealCandidate): boolean {
  if (!alert.is_active) {
    return false;
  }

  if (alert.product_id && alert.product_id !== deal.productId) {
    return false;
  }

  if (alert.category_id && alert.category_id !== deal.categoryId) {
    return false;
  }

  const alertBrand = normalizeBrand(alert.brand);
  const productBrand = normalizeBrand(deal.brand);
  if (alertBrand && alertBrand !== productBrand) {
    return false;
  }

  const keyword = alert.keyword?.trim().toLowerCase();
  if (keyword && !deal.title.toLowerCase().includes(keyword)) {
    return false;
  }

  const minDiscount = toNumber(alert.min_discount_percentage);
  if (minDiscount !== null && deal.discountPercentage < minDiscount) {
    return false;
  }

  const maxPrice = toNumber(alert.max_price);
  if (maxPrice !== null && deal.currentPrice > maxPrice) {
    return false;
  }

  const minPrice = toNumber(alert.min_price);
  if (minPrice !== null && deal.currentPrice < minPrice) {
    return false;
  }

  return true;
}

export async function findMatchingAlerts(
  client: TypedSupabaseClient,
  deal: DealCandidate,
): Promise<AlertMatch[]> {
  const { data, error } = await client
    .from("alerts")
    .select("*, users(*)")
    .eq("is_active", true);

  if (error) {
    throw new Error(`No se pudieron leer alertas: ${error.message}`);
  }

  const matches: AlertMatch[] = [];

  for (const row of data ?? []) {
    const { users, ...alert } = row as AlertRow & {
      users: UserRow | UserRow[] | null;
    };
    const user = Array.isArray(users) ? users[0] : users;

    if (!user) {
      continue;
    }

    if (alertMatchesDeal(alert, deal)) {
      matches.push({ alert, user });
    }
  }

  return matches;
}

export const alertMatchingService = {
  alertMatchesDeal,
  findMatchingAlerts,
};
