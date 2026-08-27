/**
 * Wizard interactivo de alertas Telegram (inline keyboards + estado).
 */

import { createSupabaseServiceClient } from "@/lib/supabase";
import type { Json } from "@/types/database";

type InlineKeyboardButton =
  | { text: string; url: string }
  | { text: string; callback_data: string };

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export type WizardMode = "category" | "keyword" | "brand" | "url";

export type WizardStep =
  | "pick_mode"
  | "pick_category"
  | "await_text"
  | "pick_discount"
  | "pick_max_price"
  | "confirm";

export interface AlertWizardDraft {
  step: WizardStep;
  mode?: WizardMode;
  categorySlug?: string | null;
  categoryId?: string | null;
  categoryLabel?: string | null;
  keyword?: string | null;
  brand?: string | null;
  url?: string | null;
  /** Nombre corto del producto (wizard por ASIN/URL). */
  productTitle?: string | null;
  minDiscount?: number | null;
  maxPrice?: number | null;
  updatedAt: string;
}

/** Etiqueta legible para Telegram (evita mostrar solo el ASIN). */
export function shortProductLabel(
  title: string | null | undefined,
  fallbackAsin?: string | null,
  max = 52,
): string {
  const clean = title?.replace(/\s+/g, " ").trim();
  if (clean) {
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1).trimEnd()}…`;
  }
  if (fallbackAsin) return `Producto ${fallbackAsin}`;
  return "Producto de Amazon";
}

const WIZARD_TTL_MS = 30 * 60 * 1000;

const memory = new Map<number, AlertWizardDraft>();

export const WIZARD_CATEGORIES = [
  { label: "Electrónica", slug: "tecnologia" },
  { label: "Hogar", slug: "hogar" },
  { label: "Moda", slug: "moda" },
  { label: "Belleza", slug: "belleza" },
  { label: "Deportes", slug: "deportes" },
  { label: "Juguetes", slug: "juguetes" },
  { label: "Informática", slug: "informatica" },
] as const;

export const DISCOUNT_OPTIONS = [
  { label: "−10%", value: 10 },
  { label: "−20%", value: 20 },
  { label: "−30%", value: 30 },
  { label: "−40%", value: 40 },
  { label: "−50%", value: 50 },
] as const;

export const MAX_PRICE_OPTIONS = [
  { label: "≤ 20 €", value: 20 },
  { label: "≤ 50 €", value: 50 },
  { label: "≤ 100 €", value: 100 },
  { label: "≤ 200 €", value: 200 },
  { label: "≤ 500 €", value: 500 },
] as const;

function isExpired(draft: AlertWizardDraft): boolean {
  const updated = new Date(draft.updatedAt).getTime();
  return Date.now() - updated > WIZARD_TTL_MS;
}

export async function getWizardDraft(
  telegramId: number,
): Promise<AlertWizardDraft | null> {
  const local = memory.get(telegramId);
  if (local && !isExpired(local)) return local;
  if (local) memory.delete(telegramId);

  try {
    const client = createSupabaseServiceClient();
    const { data } = await client
      .from("users")
      .select("telegram_wizard")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    const raw = data?.telegram_wizard;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const draft = raw as unknown as AlertWizardDraft;
    if (!draft.step || !draft.updatedAt || isExpired(draft)) {
      await clearWizardDraft(telegramId);
      return null;
    }
    memory.set(telegramId, draft);
    return draft;
  } catch {
    return null;
  }
}

export async function saveWizardDraft(
  telegramId: number,
  draft: Omit<AlertWizardDraft, "updatedAt"> & { updatedAt?: string },
): Promise<AlertWizardDraft> {
  const next: AlertWizardDraft = {
    ...draft,
    updatedAt: new Date().toISOString(),
  };
  memory.set(telegramId, next);

  try {
    const client = createSupabaseServiceClient();
    await client
      .from("users")
      .update({ telegram_wizard: next as unknown as Json })
      .eq("telegram_id", telegramId);
  } catch (error) {
    console.warn(
      "[alertWizard] No se pudo persistir telegram_wizard (¿migración 0010?)",
      error instanceof Error ? error.message : error,
    );
  }

  return next;
}

export async function clearWizardDraft(telegramId: number): Promise<void> {
  memory.delete(telegramId);
  try {
    const client = createSupabaseServiceClient();
    await client
      .from("users")
      .update({ telegram_wizard: null })
      .eq("telegram_id", telegramId);
  } catch {
    // ignore
  }
}

function navRow(includeBack: boolean): InlineKeyboardButton[] {
  const row: InlineKeyboardButton[] = [];
  if (includeBack) {
    row.push({ text: "⬅️ Atrás", callback_data: "wiz:back" });
  }
  row.push({ text: "❌ Cancelar", callback_data: "wiz:cancel" });
  return row;
}

/** Numeración estable del wizard (1–4 + confirmación). */
export function wizardStepLabel(step: WizardStep): string {
  switch (step) {
    case "pick_mode":
      return "paso 1/4";
    case "pick_category":
    case "await_text":
      return "paso 2/4";
    case "pick_discount":
      return "paso 3/4";
    case "pick_max_price":
      return "paso 4/4";
    case "confirm":
      return "confirmación";
  }
}

export function buildWizardModeMarkup(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📂 Categoría", callback_data: "wiz:mode:category" },
        { text: "🔤 Palabra clave", callback_data: "wiz:mode:keyword" },
      ],
      [
        { text: "🏷️ Marca", callback_data: "wiz:mode:brand" },
        { text: "🔗 URL Amazon", callback_data: "wiz:mode:url" },
      ],
      navRow(false),
    ],
  };
}

export function buildWizardCategoryMarkup(): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = WIZARD_CATEGORIES.map((cat) => [
    { text: cat.label, callback_data: `wiz:cat:${cat.slug}` },
  ]);
  rows.push([{ text: "🌐 Cualquier categoría", callback_data: "wiz:cat:any" }]);
  rows.push(navRow(true));
  return { inline_keyboard: rows };
}

export function buildWizardDiscountMarkup(): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup["inline_keyboard"] = [];
  for (let i = 0; i < DISCOUNT_OPTIONS.length; i += 2) {
    const a = DISCOUNT_OPTIONS[i]!;
    const b = DISCOUNT_OPTIONS[i + 1];
    const row = [{ text: a.label, callback_data: `wiz:disc:${a.value}` }];
    if (b) row.push({ text: b.label, callback_data: `wiz:disc:${b.value}` });
    rows.push(row);
  }
  rows.push([{ text: "Sin mínimo", callback_data: "wiz:disc:any" }]);
  rows.push(navRow(true));
  return { inline_keyboard: rows };
}

export function buildWizardMaxPriceMarkup(): InlineKeyboardMarkup {
  const rows: InlineKeyboardMarkup["inline_keyboard"] = [];
  for (let i = 0; i < MAX_PRICE_OPTIONS.length; i += 2) {
    const a = MAX_PRICE_OPTIONS[i]!;
    const b = MAX_PRICE_OPTIONS[i + 1];
    const row = [{ text: a.label, callback_data: `wiz:price:${a.value}` }];
    if (b) row.push({ text: b.label, callback_data: `wiz:price:${b.value}` });
    rows.push(row);
  }
  rows.push([{ text: "Sin límite", callback_data: "wiz:price:any" }]);
  rows.push(navRow(true));
  return { inline_keyboard: rows };
}

export function buildWizardConfirmMarkup(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "✅ Crear alerta", callback_data: "wiz:confirm" }],
      navRow(true),
    ],
  };
}

export function buildWizardCancelOnlyMarkup(): InlineKeyboardMarkup {
  return { inline_keyboard: [navRow(true)] };
}

export function formatWizardSummary(draft: AlertWizardDraft): string {
  const lines = [
    `📋 <b>Resumen — ${wizardStepLabel("confirm")}</b>`,
    "",
  ];

  if (draft.mode === "category") {
    lines.push(
      `📂 Categoría: <b>${escapeHtml(draft.categoryLabel ?? "Cualquiera")}</b>`,
    );
  } else if (draft.mode === "keyword") {
    lines.push(`🔤 Palabra clave: <b>${escapeHtml(draft.keyword ?? "—")}</b>`);
  } else if (draft.mode === "brand") {
    lines.push(`🏷️ Marca: <b>${escapeHtml(draft.brand ?? "—")}</b>`);
  } else if (draft.mode === "url") {
    const productLabel =
      draft.productTitle?.trim() ||
      draft.keyword?.trim() ||
      null;
    if (productLabel) {
      lines.push(`🎯 Producto: <b>${escapeHtml(productLabel)}</b>`);
    } else if (draft.url) {
      lines.push(`🔗 URL: ${escapeHtml(draft.url.slice(0, 80))}`);
    }
  }

  lines.push(
    `📉 Descuento mín.: <b>${
      draft.minDiscount != null ? `−${draft.minDiscount}%` : "Sin mínimo"
    }</b>`,
  );
  lines.push(
    `💶 Precio máx.: <b>${
      draft.maxPrice != null ? `${draft.maxPrice} €` : "Sin límite"
    }</b>`,
  );
  lines.push("", "¿Confirmas?");
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function resolveCategoryId(
  slug: string | null | undefined,
): Promise<{ id: string; name: string } | null> {
  if (!slug) return null;
  const client = createSupabaseServiceClient();
  const { data } = await client
    .from("categories")
    .select("id, name")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}
