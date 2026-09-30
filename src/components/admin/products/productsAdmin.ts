/** Tipos y utilidades de la pantalla de Productos del admin. */

import { formatRelativeTime } from "@/lib/relative-time";
import type { ProductRetailer } from "@/lib/retailers";

export interface AdminProduct {
  id: string;
  title: string;
  slug: string;
  asin: string;
  retailer: string;
  externalId: string | null;
  brand: string | null;
  description?: string | null;
  productUrl: string;
  amazonUrl: string;
  affiliateUrl?: string | null;
  imageUrl?: string | null;
  currentPrice: number;
  previousPrice: number | null;
  lowestPrice?: number | null;
  highestPrice?: number | null;
  averagePrice30d?: number | null;
  averagePrice90d?: number | null;
  referencePrice: number;
  dealScore: number;
  dealLabel: string;
  dealLevel?: string;
  discountPercentage: number;
  currency?: string;
  availability?: string;
  availabilityLabel?: string;
  outOfStockAt?: string | null;
  category: { id: string; name: string; slug: string } | null;
  isActive: boolean;
  isFeatured?: boolean;
  lastCheckedAt: string | null;
  lastTelegramNotifiedAt?: string | null;
  lastTelegramNotifiedPrice?: number | null;
  lastTelegramNotifiedScore?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

export type SortKey =
  | "title"
  | "asin"
  | "currentPrice"
  | "referencePrice"
  | "dealScore"
  | "category"
  | "lastCheckedAt";

export type SortDir = "asc" | "desc";
export type StaleFilter = "all" | "fresh" | "stale" | "never";
export type DealFilter = "all" | "offer" | "normal";

export function productStatusBadges(product: AdminProduct) {
  const badges: Array<{ key: string; label: string; className: string }> = [];

  if (product.availability === "OUT_OF_STOCK") {
    badges.push({
      key: "oos",
      label: "Agotado",
      className:
        "border-amber-300 bg-amber-50 text-amber-900",
    });
  }

  if (!product.isActive) {
    badges.push({
      key: "inactive",
      label: "Inactivo",
      className: "border-stone-300 bg-stone-100 text-stone-600",
    });
  }

  return badges;
}

export function freshnessMeta(lastCheckedAt: string | null): {
  label: string;
  className: string;
  hours: number | null;
} {
  if (!lastCheckedAt) {
    return { label: "Nunca", className: "text-rose-700", hours: null };
  }
  const ageMs = Date.now() - new Date(lastCheckedAt).getTime();
  const hours = ageMs / 3_600_000;
  if (hours < 6) {
    return {
      label: formatRelativeTime(lastCheckedAt),
      className: "text-teal-800",
      hours,
    };
  }
  if (hours < 48) {
    return {
      label: formatRelativeTime(lastCheckedAt),
      className: "text-amber-800",
      hours,
    };
  }
  return {
    label: formatRelativeTime(lastCheckedAt),
    className: "text-rose-700",
    hours,
  };
}

export const emptyForm = {
  retailer: "amazon" as ProductRetailer,
  productUrl: "",
  externalId: "",
  title: "",
  categoryId: "",
  referencePrice: "",
  currentPrice: "",
  brand: "",
  imageUrl: "",
  description: "",
};

export const iconBtnClass = "admin-icon-btn";

export const toolbarFieldClass = "admin-select w-auto";
