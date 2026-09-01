/**
 * Ajustes de producto en `app_settings` (fila `default`).
 * Los valores en BD tienen prioridad; si faltan, se usa .env como fallback.
 */

import { getTelegramMinScore as getTelegramMinScoreFromEnv } from "@/lib/env";
import {
  DEFAULT_AMAZON_FLASH_FEED_URLS,
  DEFAULT_KIABI_FEED_URLS,
  DEFAULT_MIRAVIA_FEED_URLS,
  effectiveFeedUrls,
} from "@/lib/default-feed-urls";
import {
  formatFeedUrlsText,
  parseFeedUrlsText,
  rotateFeedUrls,
} from "@/lib/feed-urls";
import { createSupabaseServiceClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

type AppSettingsInsert = Database["public"]["Tables"]["app_settings"]["Insert"];
type AppSettingsUpdate = Database["public"]["Tables"]["app_settings"]["Update"];

export const APP_SETTINGS_ID = "default";
export const DEFAULT_TELEGRAM_BATCH_HOURS = 4;
export const DEFAULT_TELEGRAM_FLUSH_RESCHEDULE_MINUTES = 20;
export const DEFAULT_AMAZON_ASSOCIATE_TAG = "cazaoferta-21";

export const DEFAULT_TELEGRAM_FLUSH_LIMIT = 40;

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
  amazonFlashFeedUrls: string[];
  miraviaFeedUrls: string[];
  kiabiFeedUrls: string[];
  amazonDepartmentFeedsPerRun: number;
  miraviaFeedsPerRun: number;
  kiabiFeedsPerRun: number;
  telegramFlushLimit: number;
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
    | "amazonFlashFeedUrls"
    | "miraviaFeedUrls"
    | "kiabiFeedUrls"
    | "amazonDepartmentFeedsPerRun"
    | "miraviaFeedsPerRun"
    | "kiabiFeedsPerRun"
    | "telegramFlushLimit"
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
  amazon_flash_feed_urls?: string | null;
  miravia_feed_urls?: string | null;
  kiabi_feed_urls?: string | null;
  amazon_department_feeds_per_run?: number | string | null;
  miravia_feeds_per_run?: number | string | null;
  kiabi_feeds_per_run?: number | string | null;
  telegram_flush_limit?: number | string | null;
  last_telegram_flush_at?: string | null;
  telegram_flush_resume_at?: string | null;
  updated_at?: string | null;
};

const SETTINGS_COLUMNS =
  "id, telegram_min_score, miravia_telegram_min_score, kiabi_telegram_min_score, telegram_batch_hours, telegram_flush_reschedule_minutes, amazon_associate_tag, amazon_flash_insert_limit, miravia_deals_enabled, miravia_min_discount_percent, miravia_discovery_max_items, miravia_flash_limit, miravia_flash_update_limit, kiabi_deals_enabled, kiabi_min_discount_percent, kiabi_discovery_max_items, kiabi_new_products_only, amazon_flash_feed_urls, miravia_feed_urls, kiabi_feed_urls, amazon_department_feeds_per_run, miravia_feeds_per_run, kiabi_feeds_per_run, telegram_flush_limit, last_telegram_flush_at, telegram_flush_resume_at, updated_at";

/** Sin columnas de feeds (0027). */
const SETTINGS_COLUMNS_WITHOUT_FEEDS =
  "id, telegram_min_score, miravia_telegram_min_score, kiabi_telegram_min_score, telegram_batch_hours, telegram_flush_reschedule_minutes, amazon_associate_tag, amazon_flash_insert_limit, miravia_deals_enabled, miravia_min_discount_percent, miravia_discovery_max_items, miravia_flash_limit, miravia_flash_update_limit, kiabi_deals_enabled, kiabi_min_discount_percent, kiabi_discovery_max_items, kiabi_new_products_only, last_telegram_flush_at, telegram_flush_resume_at, updated_at";

/** Solo Telegram batch (0018 + 0025). */
const SETTINGS_COLUMNS_TELEGRAM_BATCH =
  "id, telegram_min_score, telegram_batch_hours, last_telegram_flush_at, telegram_flush_resume_at, updated_at";

const SETTINGS_SELECT_TIERS = [
  SETTINGS_COLUMNS,
  SETTINGS_COLUMNS_WITHOUT_FEEDS,
  SETTINGS_COLUMNS_TELEGRAM_BATCH,
  "id, telegram_min_score, telegram_batch_hours, last_telegram_flush_at, updated_at",
  "id, telegram_min_score, updated_at",
] as const;

function isSchemaColumnError(error: { message?: string } | null): boolean {
  const msg = error?.message?.toLowerCase() ?? "";
  return (
    msg.includes("schema cache") ||
    (msg.includes("could not find") && msg.includes("column"))
  );
}

async function fetchSettingsRow(
  client: ReturnType<typeof createSupabaseServiceClient>,
): Promise<AppSettingsRow | null> {
  for (const columns of SETTINGS_SELECT_TIERS) {
    const { data, error } = await client
      .from("app_settings")
      .select(columns)
      .eq("id", APP_SETTINGS_ID)
      .maybeSingle();

    if (!error) {
      return (data ?? null) as AppSettingsRow | null;
    }
    if (!isSchemaColumnError(error)) {
      console.warn("[app_settings]", error.message);
      return null;
    }
  }
  return null;
}

export { formatFeedUrlsText };

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
    amazonFlashFeedUrls:
      parseFeedUrlsText(process.env.AMAZON_FLASH_FEED_URLS).length > 0
        ? parseFeedUrlsText(process.env.AMAZON_FLASH_FEED_URLS)
        : [...DEFAULT_AMAZON_FLASH_FEED_URLS],
    miraviaFeedUrls:
      parseFeedUrlsText(process.env.MIRAVIA_FEED_URLS).length > 0
        ? parseFeedUrlsText(process.env.MIRAVIA_FEED_URLS)
        : [...DEFAULT_MIRAVIA_FEED_URLS],
    kiabiFeedUrls:
      parseFeedUrlsText(process.env.KIABI_FEED_URLS).length > 0
        ? parseFeedUrlsText(process.env.KIABI_FEED_URLS)
        : [...DEFAULT_KIABI_FEED_URLS],
    amazonDepartmentFeedsPerRun: Number(
      process.env.AMAZON_FLASH_DEPARTMENT_FEEDS_PER_RUN ?? "3",
    ),
    miraviaFeedsPerRun: 1,
    kiabiFeedsPerRun: 1,
    telegramFlushLimit: DEFAULT_TELEGRAM_FLUSH_LIMIT,
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
    amazonFlashFeedUrls: row.amazon_flash_feed_urls?.trim()
      ? parseFeedUrlsText(row.amazon_flash_feed_urls)
      : env.amazonFlashFeedUrls,
    miraviaFeedUrls: row.miravia_feed_urls?.trim()
      ? parseFeedUrlsText(row.miravia_feed_urls)
      : env.miraviaFeedUrls,
    kiabiFeedUrls: row.kiabi_feed_urls?.trim()
      ? parseFeedUrlsText(row.kiabi_feed_urls)
      : env.kiabiFeedUrls,
    amazonDepartmentFeedsPerRun: clampSmallInt(
      Number(
        row.amazon_department_feeds_per_run ?? env.amazonDepartmentFeedsPerRun,
      ),
      env.amazonDepartmentFeedsPerRun,
      8,
    ),
    miraviaFeedsPerRun: clampSmallInt(
      Number(row.miravia_feeds_per_run ?? env.miraviaFeedsPerRun),
      env.miraviaFeedsPerRun,
      5,
    ),
    kiabiFeedsPerRun: clampSmallInt(
      Number(row.kiabi_feeds_per_run ?? env.kiabiFeedsPerRun),
      env.kiabiFeedsPerRun,
      5,
    ),
    telegramFlushLimit: clampSmallInt(
      Number(row.telegram_flush_limit ?? env.telegramFlushLimit),
      env.telegramFlushLimit,
      80,
    ),
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
    const existing = await fetchSettingsRow(client);
    if (existing) return existing;

    const env = envDefaults();
    const insertAttempts: AppSettingsInsert[] = [
      {
        id: APP_SETTINGS_ID,
        telegram_min_score: env.telegramMinScore,
        telegram_batch_hours: env.telegramBatchHours,
      },
      {
        id: APP_SETTINGS_ID,
        telegram_min_score: env.telegramMinScore,
      },
    ];

    for (const payload of insertAttempts) {
      const { error: insertError } = await client
        .from("app_settings")
        .insert(payload);
      if (!insertError) {
        return fetchSettingsRow(client);
      }
      if (!isSchemaColumnError(insertError)) {
        console.warn("[app_settings] insert", insertError.message);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.warn(
      "[app_settings]",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Actualiza solo el timestamp del último lote Telegram (sin upsert completo). */
export async function persistTelegramFlushAt(
  lastFlushAt: string,
): Promise<void> {
  const client = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const attempts: AppSettingsUpdate[] = [
    {
      last_telegram_flush_at: lastFlushAt,
      telegram_flush_resume_at: null,
      updated_at: now,
    },
    {
      last_telegram_flush_at: lastFlushAt,
      updated_at: now,
    },
  ];

  for (const patch of attempts) {
    const { error } = await client
      .from("app_settings")
      .update(patch)
      .eq("id", APP_SETTINGS_ID);
    if (!error) {
      if (settingsCache) {
        settingsCache = {
          value: {
            ...settingsCache.value,
            lastTelegramFlushAt: lastFlushAt,
            telegramFlushResumeAt: null,
          },
          expiresAt: settingsCache.expiresAt,
        };
      }
      return;
    }
    if (!isSchemaColumnError(error)) {
      throw new Error(error.message);
    }
  }

  throw new Error(
    "No se pudo guardar last_telegram_flush_at. Aplica las migraciones 0018–0027 en Supabase.",
  );
}

export async function clearTelegramFlushResumeAt(): Promise<void> {
  const client = createSupabaseServiceClient();
  const { error } = await client
    .from("app_settings")
    .update({
      telegram_flush_resume_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", APP_SETTINGS_ID);

  if (error && !isSchemaColumnError(error)) {
    console.warn("[app_settings] clear resume", error.message);
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
    amazonFlashFeedUrls:
      patch.amazonFlashFeedUrls !== undefined
        ? patch.amazonFlashFeedUrls
        : current.amazonFlashFeedUrls,
    miraviaFeedUrls:
      patch.miraviaFeedUrls !== undefined
        ? patch.miraviaFeedUrls
        : current.miraviaFeedUrls,
    kiabiFeedUrls:
      patch.kiabiFeedUrls !== undefined
        ? patch.kiabiFeedUrls
        : current.kiabiFeedUrls,
    amazonDepartmentFeedsPerRun:
      patch.amazonDepartmentFeedsPerRun !== undefined
        ? clampSmallInt(
            patch.amazonDepartmentFeedsPerRun,
            current.amazonDepartmentFeedsPerRun,
            8,
          )
        : current.amazonDepartmentFeedsPerRun,
    miraviaFeedsPerRun:
      patch.miraviaFeedsPerRun !== undefined
        ? clampSmallInt(patch.miraviaFeedsPerRun, current.miraviaFeedsPerRun, 5)
        : current.miraviaFeedsPerRun,
    kiabiFeedsPerRun:
      patch.kiabiFeedsPerRun !== undefined
        ? clampSmallInt(patch.kiabiFeedsPerRun, current.kiabiFeedsPerRun, 5)
        : current.kiabiFeedsPerRun,
    telegramFlushLimit:
      patch.telegramFlushLimit !== undefined
        ? clampSmallInt(patch.telegramFlushLimit, current.telegramFlushLimit, 80)
        : current.telegramFlushLimit,
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
        amazon_flash_feed_urls: formatFeedUrlsText(merged.amazonFlashFeedUrls),
        miravia_feed_urls: formatFeedUrlsText(merged.miraviaFeedUrls),
        kiabi_feed_urls: formatFeedUrlsText(merged.kiabiFeedUrls),
        amazon_department_feeds_per_run: merged.amazonDepartmentFeedsPerRun,
        miravia_feeds_per_run: merged.miraviaFeedsPerRun,
        kiabi_feeds_per_run: merged.kiabiFeedsPerRun,
        telegram_flush_limit: merged.telegramFlushLimit,
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
        "No se pudo guardar app_settings. Aplica en Supabase las migraciones 0025–0027 (scripts/supabase-pending-app-settings.sql).",
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

export async function resolveAmazonFlashFeedUrlsForRun(): Promise<string[]> {
  const settings = await getAppSettings();
  const pool = effectiveFeedUrls(
    settings.amazonFlashFeedUrls,
    DEFAULT_AMAZON_FLASH_FEED_URLS,
  );
  return rotateFeedUrls(pool, {
    perRun: settings.amazonDepartmentFeedsPerRun,
  });
}

export async function resolveMiraviaFeedUrlsForRun(): Promise<string[]> {
  const settings = await getAppSettings();
  const pool = effectiveFeedUrls(
    settings.miraviaFeedUrls,
    DEFAULT_MIRAVIA_FEED_URLS,
  );
  return rotateFeedUrls(pool, { perRun: settings.miraviaFeedsPerRun });
}

export async function resolveKiabiFeedUrlsForRun(): Promise<string[]> {
  const settings = await getAppSettings();
  const pool = effectiveFeedUrls(
    settings.kiabiFeedUrls,
    DEFAULT_KIABI_FEED_URLS,
  );
  return rotateFeedUrls(pool, { perRun: settings.kiabiFeedsPerRun });
}

export async function resolveTelegramFlushLimit(): Promise<number> {
  return (await getAppSettings()).telegramFlushLimit;
}
