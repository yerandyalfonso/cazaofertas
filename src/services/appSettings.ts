/**
 * Ajustes de producto en `app_settings` (fila `default`).
 * Los valores en BD tienen prioridad; si faltan, se usa .env como fallback.
 */

import { getTelegramMinScore as getTelegramMinScoreFromEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const APP_SETTINGS_ID = "default";
export const DEFAULT_TELEGRAM_BATCH_HOURS = 4;
export const DEFAULT_TELEGRAM_FLUSH_RESCHEDULE_MINUTES = 20;
export const DEFAULT_AMAZON_ASSOCIATE_TAG = "cazaoferta-21";

const SETTINGS_CACHE_TTL_MS = 30_000;
let settingsCache: { value: AppSettings; expiresAt: number } | null = null;

export interface AppSettings {
  id: string;
  telegramMinScore: number;
  miraviaTelegramMinScore: number;
  kiabiTelegramMinScore: number;
  telegramBatchHours: number;
  telegramFlushRescheduleMinutes: number;
  amazonAssociateTag: string;
  amazonFlashInsertLimit: number;
  miraviaDealsEnabled: boolean;
  miraviaMinDiscountPercent: number;
  miraviaDiscoveryMaxItems: number;
  miraviaFlashLimit: number;
  miraviaFlashUpdateLimit: number;
  kiabiDealsEnabled: boolean;
  kiabiMinDiscountPercent: number;
  kiabiDiscoveryMaxItems: number;
  kiabiNewProductsOnly: boolean;
  lastTelegramFlushAt: string | null;
  telegramFlushResumeAt: string | null;
  updatedAt: string | null;
  source: "database" | "env";
}

export type AppSettingsPatch = Partial<
  Pick<
    AppSettings,
    | "telegramMinScore"
    | "miraviaTelegramMinScore"
    | "kiabiTelegramMinScore"
    | "telegramBatchHours"
    | "telegramFlushRescheduleMinutes"
    | "amazonAssociateTag"
    | "amazonFlashInsertLimit"
    | "miraviaDealsEnabled"
    | "miraviaMinDiscountPercent"
    | "miraviaDiscoveryMaxItems"
    | "miraviaFlashLimit"
    | "miraviaFlashUpdateLimit"
    | "kiabiDealsEnabled"
    | "kiabiMinDiscountPercent"
    | "kiabiDiscoveryMaxItems"
    | "kiabiNewProductsOnly"
    | "lastTelegramFlushAt"
    | "telegramFlushResumeAt"
  >
>;

type AppSettingsRow = {
  id: string;
  telegram_min_score?: number | string | null;
  miravia_telegram_min_score?: number | string | null;
  kiabi_telegram_min_score?: number | string | null;
  telegram_batch_hours?: number | string | null;
  telegram_flush_reschedule_minutes?: number | string | null;
  amazon_associate_tag?: string | null;
  amazon_flash_insert_limit?: number | string | null;
  miravia_deals_enabled?: boolean | null;
  miravia_min_discount_percent?: number | string | null;
  miravia_discovery_max_items?: number | string | null;
  miravia_flash_limit?: number | string | null;
  miravia_flash_update_limit?: number | string | null;
  kiabi_deals_enabled?: boolean | null;
  kiabi_min_discount_percent?: number | string | null;
  kiabi_discovery_max_items?: number | string | null;
  kiabi_new_products_only?: boolean | null;
  last_telegram_flush_at?: string | null;
  telegram_flush_resume_at?: string | null;
  updated_at?: string | null;
};

const SETTINGS_COLUMNS =
  "id, telegram_min_score, miravia_telegram_min_score, kiabi_telegram_min_score, telegram_batch_hours, telegram_flush_reschedule_minutes, amazon_associate_tag, amazon_flash_insert_limit, miravia_deals_enabled, miravia_min_discount_percent, miravia_discovery_max_items, miravia_flash_limit, miravia_flash_update_limit, kiabi_deals_enabled, kiabi_min_discount_percent, kiabi_discovery_max_items, kiabi_new_products_only, last_telegram_flush_at, telegram_flush_resume_at, updated_at";

function clampScore(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

export function clampTelegramBatchHours(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TELEGRAM_BATCH_HOURS;
  return Math.min(24, Math.max(1, Math.round(value * 10) / 10));
}

function clampRescheduleMinutes(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TELEGRAM_FLUSH_RESCHEDULE_MINUTES;
  return Math.min(120, Math.max(5, Math.round(value)));
}

function clampPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(99, Math.max(1, Math.round(value * 100) / 100));
}

function clampSmallInt(value: number, fallback: number, max = 100): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.round(value)));
}

function envBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return v === "1" || v === "true" || v === "on";
}

function envDefaults(): Omit<
  AppSettings,
  "id" | "lastTelegramFlushAt" | "telegramFlushResumeAt" | "updatedAt" | "source"
> {
  return {
    telegramMinScore: getTelegramMinScoreFromEnv(),
    miraviaTelegramMinScore: Number(
      process.env.MIRAVIA_TELEGRAM_MIN_SCORE ?? "55",
    ),
    kiabiTelegramMinScore: Number(
      process.env.KIABI_TELEGRAM_MIN_SCORE ?? "75",
    ),
    telegramBatchHours: DEFAULT_TELEGRAM_BATCH_HOURS,
    telegramFlushRescheduleMinutes: Number(
      process.env.TELEGRAM_FLUSH_RESCHEDULE_MINUTES ??
        String(DEFAULT_TELEGRAM_FLUSH_RESCHEDULE_MINUTES),
    ),
    amazonAssociateTag:
      process.env.AMAZON_ASSOCIATE_TAG?.trim() || DEFAULT_AMAZON_ASSOCIATE_TAG,
    amazonFlashInsertLimit: Number(
      process.env.AMAZON_FLASH_INSERT_LIMIT ?? "4",
    ),
    miraviaDealsEnabled: envBool(process.env.MIRAVIA_DEALS_ENABLED, true),
    miraviaMinDiscountPercent: Number(
      process.env.MIRAVIA_MIN_DISCOUNT_PERCENT ?? "15",
    ),
    miraviaDiscoveryMaxItems: Number(
      process.env.MIRAVIA_DISCOVERY_MAX_ITEMS ?? "60",
    ),
    miraviaFlashLimit: Number(process.env.MIRAVIA_FLASH_LIMIT ?? "3"),
    miraviaFlashUpdateLimit: Number(
      process.env.MIRAVIA_FLASH_UPDATE_LIMIT ?? "2",
    ),
    kiabiDealsEnabled: envBool(process.env.KIABI_DEALS_ENABLED, false),
    kiabiMinDiscountPercent: Number(
      process.env.KIABI_MIN_DISCOUNT_PERCENT ?? "10",
    ),
    kiabiDiscoveryMaxItems: Number(
      process.env.KIABI_DISCOVERY_MAX_ITEMS ?? "100",
    ),
    kiabiNewProductsOnly: envBool(process.env.KIABI_NEW_PRODUCTS_ONLY, true),
  };
}

function mapRow(row: AppSettingsRow): AppSettings {
  const env = envDefaults();
  return {
    id: row.id,
    telegramMinScore: clampScore(
      Number(row.telegram_min_score ?? env.telegramMinScore),
      env.telegramMinScore,
    ),
    miraviaTelegramMinScore: clampScore(
      Number(row.miravia_telegram_min_score ?? env.miraviaTelegramMinScore),
      env.miraviaTelegramMinScore,
    ),
    kiabiTelegramMinScore: clampScore(
      Number(row.kiabi_telegram_min_score ?? env.kiabiTelegramMinScore),
      env.kiabiTelegramMinScore,
    ),
    telegramBatchHours: clampTelegramBatchHours(
      Number(row.telegram_batch_hours ?? env.telegramBatchHours),
    ),
    telegramFlushRescheduleMinutes: clampRescheduleMinutes(
      Number(
        row.telegram_flush_reschedule_minutes ??
          env.telegramFlushRescheduleMinutes,
      ),
    ),
    amazonAssociateTag:
      row.amazon_associate_tag?.trim() || env.amazonAssociateTag,
    amazonFlashInsertLimit: clampSmallInt(
      Number(row.amazon_flash_insert_limit ?? env.amazonFlashInsertLimit),
      env.amazonFlashInsertLimit,
      20,
    ),
    miraviaDealsEnabled:
      row.miravia_deals_enabled ?? env.miraviaDealsEnabled,
    miraviaMinDiscountPercent: clampPercent(
      Number(row.miravia_min_discount_percent ?? env.miraviaMinDiscountPercent),
      env.miraviaMinDiscountPercent,
    ),
    miraviaDiscoveryMaxItems: clampSmallInt(
      Number(row.miravia_discovery_max_items ?? env.miraviaDiscoveryMaxItems),
      env.miraviaDiscoveryMaxItems,
      200,
    ),
    miraviaFlashLimit: clampSmallInt(
      Number(row.miravia_flash_limit ?? env.miraviaFlashLimit),
      env.miraviaFlashLimit,
      5,
    ),
    miraviaFlashUpdateLimit: clampSmallInt(
      Number(
        row.miravia_flash_update_limit ?? env.miraviaFlashUpdateLimit,
      ),
      env.miraviaFlashUpdateLimit,
      5,
    ),
    kiabiDealsEnabled: row.kiabi_deals_enabled ?? env.kiabiDealsEnabled,
    kiabiMinDiscountPercent: clampPercent(
      Number(row.kiabi_min_discount_percent ?? env.kiabiMinDiscountPercent),
      env.kiabiMinDiscountPercent,
    ),
    kiabiDiscoveryMaxItems: clampSmallInt(
      Number(row.kiabi_discovery_max_items ?? env.kiabiDiscoveryMaxItems),
      env.kiabiDiscoveryMaxItems,
      300,
    ),
    kiabiNewProductsOnly:
      row.kiabi_new_products_only ?? env.kiabiNewProductsOnly,
    lastTelegramFlushAt: row.last_telegram_flush_at ?? null,
    telegramFlushResumeAt: row.telegram_flush_resume_at ?? null,
    updatedAt: row.updated_at ?? null,
    source: "database",
  };
}

function envFallback(): AppSettings {
  const env = envDefaults();
  return {
    id: APP_SETTINGS_ID,
    ...env,
    lastTelegramFlushAt: null,
    telegramFlushResumeAt: null,
    updatedAt: null,
    source: "env",
  };
}

function setSettingsCache(settings: AppSettings): void {
  settingsCache = {
    value: settings,
    expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
  };
}

export function peekAppSettings(): AppSettings | null {
  if (settingsCache && Date.now() < settingsCache.expiresAt) {
    return settingsCache.value;
  }
  return null;
}

export function resolveAmazonAssociateTagSync(): string {
  const cached = peekAppSettings()?.amazonAssociateTag?.trim();
  if (cached) return cached;
  return (
    process.env.AMAZON_ASSOCIATE_TAG?.trim() || DEFAULT_AMAZON_ASSOCIATE_TAG
  );
}

async function ensureRow(): Promise<AppSettingsRow | null> {
  try {
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("app_settings")
      .select(SETTINGS_COLUMNS)
      .eq("id", APP_SETTINGS_ID)
      .maybeSingle();

    if (error) {
      console.warn("[app_settings]", error.message);
      return null;
    }
    if (data) return data as AppSettingsRow;

    const env = envDefaults();
    const { data: inserted, error: insertError } = await client
      .from("app_settings")
      .insert({
        id: APP_SETTINGS_ID,
        telegram_min_score: env.telegramMinScore,
        telegram_batch_hours: env.telegramBatchHours,
      })
      .select(SETTINGS_COLUMNS)
      .single();

    if (insertError) {
      console.warn("[app_settings] insert", insertError.message);
      return null;
    }
    return inserted as AppSettingsRow;
  } catch (error) {
    console.warn(
      "[app_settings]",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const row = await ensureRow();
  const settings = row ? mapRow(row) : envFallback();
  setSettingsCache(settings);
  return settings;
}

export async function resolveTelegramMinScore(): Promise<number> {
  return (await getAppSettings()).telegramMinScore;
}

export async function resolveTelegramMinScoreForRetailer(
  retailer: string | null | undefined,
): Promise<number> {
  const settings = await getAppSettings();
  if (retailer === "miravia") return settings.miraviaTelegramMinScore;
  if (retailer === "kiabi") return settings.kiabiTelegramMinScore;
  return settings.telegramMinScore;
}

export async function getTelegramFlushRescheduleMinutes(): Promise<number> {
  return (await getAppSettings()).telegramFlushRescheduleMinutes;
}

/** @deprecated Usar resolveTelegramMinScoreForRetailer */
export function getMiraviaTelegramMinScoreFromEnv(): number {
  return peekAppSettings()?.miraviaTelegramMinScore ?? Number(
    process.env.MIRAVIA_TELEGRAM_MIN_SCORE ?? "55",
  );
}

export async function updateAppSettings(
  patch: AppSettingsPatch,
): Promise<AppSettings> {
  const current = await getAppSettings();
  const merged: AppSettings = {
    ...current,
    telegramMinScore:
      patch.telegramMinScore !== undefined
        ? clampScore(patch.telegramMinScore, current.telegramMinScore)
        : current.telegramMinScore,
    miraviaTelegramMinScore:
      patch.miraviaTelegramMinScore !== undefined
        ? clampScore(
            patch.miraviaTelegramMinScore,
            current.miraviaTelegramMinScore,
          )
        : current.miraviaTelegramMinScore,
    kiabiTelegramMinScore:
      patch.kiabiTelegramMinScore !== undefined
        ? clampScore(patch.kiabiTelegramMinScore, current.kiabiTelegramMinScore)
        : current.kiabiTelegramMinScore,
    telegramBatchHours:
      patch.telegramBatchHours !== undefined
        ? clampTelegramBatchHours(patch.telegramBatchHours)
        : current.telegramBatchHours,
    telegramFlushRescheduleMinutes:
      patch.telegramFlushRescheduleMinutes !== undefined
        ? clampRescheduleMinutes(patch.telegramFlushRescheduleMinutes)
        : current.telegramFlushRescheduleMinutes,
    amazonAssociateTag:
      patch.amazonAssociateTag !== undefined
        ? patch.amazonAssociateTag.trim() || current.amazonAssociateTag
        : current.amazonAssociateTag,
    amazonFlashInsertLimit:
      patch.amazonFlashInsertLimit !== undefined
        ? clampSmallInt(
            patch.amazonFlashInsertLimit,
            current.amazonFlashInsertLimit,
            20,
          )
        : current.amazonFlashInsertLimit,
    miraviaDealsEnabled:
      patch.miraviaDealsEnabled ?? current.miraviaDealsEnabled,
    miraviaMinDiscountPercent:
      patch.miraviaMinDiscountPercent !== undefined
        ? clampPercent(
            patch.miraviaMinDiscountPercent,
            current.miraviaMinDiscountPercent,
          )
        : current.miraviaMinDiscountPercent,
    miraviaDiscoveryMaxItems:
      patch.miraviaDiscoveryMaxItems !== undefined
        ? clampSmallInt(
            patch.miraviaDiscoveryMaxItems,
            current.miraviaDiscoveryMaxItems,
            200,
          )
        : current.miraviaDiscoveryMaxItems,
    miraviaFlashLimit:
      patch.miraviaFlashLimit !== undefined
        ? clampSmallInt(patch.miraviaFlashLimit, current.miraviaFlashLimit, 5)
        : current.miraviaFlashLimit,
    miraviaFlashUpdateLimit:
      patch.miraviaFlashUpdateLimit !== undefined
        ? clampSmallInt(
            patch.miraviaFlashUpdateLimit,
            current.miraviaFlashUpdateLimit,
            5,
          )
        : current.miraviaFlashUpdateLimit,
    kiabiDealsEnabled: patch.kiabiDealsEnabled ?? current.kiabiDealsEnabled,
    kiabiMinDiscountPercent:
      patch.kiabiMinDiscountPercent !== undefined
        ? clampPercent(
            patch.kiabiMinDiscountPercent,
            current.kiabiMinDiscountPercent,
          )
        : current.kiabiMinDiscountPercent,
    kiabiDiscoveryMaxItems:
      patch.kiabiDiscoveryMaxItems !== undefined
        ? clampSmallInt(
            patch.kiabiDiscoveryMaxItems,
            current.kiabiDiscoveryMaxItems,
            300,
          )
        : current.kiabiDiscoveryMaxItems,
    kiabiNewProductsOnly:
      patch.kiabiNewProductsOnly ?? current.kiabiNewProductsOnly,
    lastTelegramFlushAt:
      patch.lastTelegramFlushAt !== undefined
        ? patch.lastTelegramFlushAt
        : current.lastTelegramFlushAt,
    telegramFlushResumeAt:
      patch.telegramFlushResumeAt !== undefined
        ? patch.telegramFlushResumeAt
        : current.telegramFlushResumeAt,
  };

  const now = new Date().toISOString();
  const client = createSupabaseServiceClient();

  const { data, error } = await client
    .from("app_settings")
    .upsert(
      {
        id: APP_SETTINGS_ID,
        telegram_min_score: merged.telegramMinScore,
        miravia_telegram_min_score: merged.miraviaTelegramMinScore,
        kiabi_telegram_min_score: merged.kiabiTelegramMinScore,
        telegram_batch_hours: merged.telegramBatchHours,
        telegram_flush_reschedule_minutes: merged.telegramFlushRescheduleMinutes,
        amazon_associate_tag: merged.amazonAssociateTag,
        amazon_flash_insert_limit: merged.amazonFlashInsertLimit,
        miravia_deals_enabled: merged.miraviaDealsEnabled,
        miravia_min_discount_percent: merged.miraviaMinDiscountPercent,
        miravia_discovery_max_items: merged.miraviaDiscoveryMaxItems,
        miravia_flash_limit: merged.miraviaFlashLimit,
        miravia_flash_update_limit: merged.miraviaFlashUpdateLimit,
        kiabi_deals_enabled: merged.kiabiDealsEnabled,
        kiabi_min_discount_percent: merged.kiabiMinDiscountPercent,
        kiabi_discovery_max_items: merged.kiabiDiscoveryMaxItems,
        kiabi_new_products_only: merged.kiabiNewProductsOnly,
        last_telegram_flush_at: merged.lastTelegramFlushAt,
        telegram_flush_resume_at: merged.telegramFlushResumeAt,
        updated_at: now,
      },
      { onConflict: "id" },
    )
    .select(SETTINGS_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "No se pudo guardar app_settings. ¿Aplicaste las migraciones 0017–0026?",
    );
  }

  const settings = mapRow(data as AppSettingsRow);
  setSettingsCache(settings);
  return settings;
}

export async function updateTelegramMinScore(
  score: number,
): Promise<AppSettings> {
  return updateAppSettings({ telegramMinScore: score });
}
