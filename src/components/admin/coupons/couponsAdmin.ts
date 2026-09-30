/** Tipos y utilidades de la pantalla de Cupones del admin. */

export type AdminCoupon = {
  id: string;
  retailer: string;
  title: string;
  code: string;
  description: string;
  terms: string;
  url: string;
  starts_at: string | null;
  expires_at: string | null;
  highlight: boolean;
  is_active: boolean;
  source: string;
};

export type FormState = {
  id?: string;
  retailer: string;
  title: string;
  code: string;
  description: string;
  terms: string;
  url: string;
  startsAt: string;
  expiresAt: string;
  highlight: boolean;
  isActive: boolean;
};

export type SortKey = "title" | "retailer" | "code" | "expires_at" | "is_active";
export type SortDir = "asc" | "desc";
export type ActiveFilter = "all" | "active" | "inactive";

export const EMPTY: FormState = {
  retailer: "amazon",
  title: "",
  code: "",
  description: "",
  terms: "",
  url: "",
  startsAt: "",
  expiresAt: "",
  highlight: false,
  isActive: true,
};

export function isInternalCode(code: string): boolean {
  return /^(PROMO-|CUPONES-|CLUB-|MV-|AWIN-|CLIP-)/i.test(code);
}
