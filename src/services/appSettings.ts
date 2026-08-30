/**
 * Ajustes de producto en `app_settings` (fila `default`).
 */

import { getTelegramMinScore as getTelegramMinScoreFromEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const APP_SETTINGS_ID = "default";
export const DEFAULT_TELEGRAM_BATCH_HOURS = 4;

export interface AppSettings {
  id: string;
  telegramMinScore: number;
  telegramBatchHours: number;
  lastTelegramFlushAt: string | null;
  updatedAt: string | null;
  source: "database" | "env";
}

type AppSettingsRow = {
  id: string;
  telegram_min_score?: number | string | null;
  telegram_batch_hours?: number | string | null;
  last_telegram_flush_at?: string | null;
  updated_at?: string | null;
};

function clampTelegramMinScore(value: number): number {
  if (!Number.isFinite(value)) return getTelegramMinScoreFromEnv();
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

export function clampTelegramBatchHours(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TELEGRAM_BATCH_HOURS;
  return Math.min(24, Math.max(1, Math.round(value * 10) / 10));
}

function mapRow(row: AppSettingsRow): AppSettings {
  return {
    id: row.id,
    telegramMinScore: clampTelegramMinScore(Number(row.telegram_min_score)),
    telegramBatchHours: clampTelegramBatchHours(
      Number(row.telegram_batch_hours ?? DEFAULT_TELEGRAM_BATCH_HOURS),
    ),
    lastTelegramFlushAt: row.last_telegram_flush_at ?? null,
    updatedAt: row.updated_at ?? null,
    source: "database",
  };
}

function envFallback(): AppSettings {
  return {
    id: APP_SETTINGS_ID,
    telegramMinScore: getTelegramMinScoreFromEnv(),
    telegramBatchHours: DEFAULT_TELEGRAM_BATCH_HOURS,
    lastTelegramFlushAt: null,
    updatedAt: null,
    source: "env",
  };
}

async function ensureRow(): Promise<AppSettingsRow | null> {
  try {
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("app_settings")
      .select(
        "id, telegram_min_score, telegram_batch_hours, last_telegram_flush_at, updated_at",
      )
      .eq("id", APP_SETTINGS_ID)
      .maybeSingle();

    if (error) {
      console.warn("[app_settings]", error.message);
      return null;
    }
    if (data) return data as AppSettingsRow;

    const { data: inserted, error: insertError } = await client
      .from("app_settings")
      .insert({
        id: APP_SETTINGS_ID,
        telegram_min_score: getTelegramMinScoreFromEnv(),
        telegram_batch_hours: DEFAULT_TELEGRAM_BATCH_HOURS,
      })
      .select(
        "id, telegram_min_score, telegram_batch_hours, last_telegram_flush_at, updated_at",
      )
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
  if (row) return mapRow(row);
  return envFallback();
}

export async function resolveTelegramMinScore(): Promise<number> {
  const settings = await getAppSettings();
  return settings.telegramMinScore;
}

export async function updateAppSettings(patch: {
  telegramMinScore?: number;
  telegramBatchHours?: number;
  lastTelegramFlushAt?: string | null;
}): Promise<AppSettings> {
  const current = await getAppSettings();
  const telegramMinScore =
    patch.telegramMinScore !== undefined
      ? clampTelegramMinScore(patch.telegramMinScore)
      : current.telegramMinScore;
  const telegramBatchHours =
    patch.telegramBatchHours !== undefined
      ? clampTelegramBatchHours(patch.telegramBatchHours)
      : current.telegramBatchHours;
  const lastTelegramFlushAt =
    patch.lastTelegramFlushAt !== undefined
      ? patch.lastTelegramFlushAt
      : current.lastTelegramFlushAt;
  const now = new Date().toISOString();
  const client = createSupabaseServiceClient();

  const { data, error } = await client
    .from("app_settings")
    .upsert(
      {
        id: APP_SETTINGS_ID,
        telegram_min_score: telegramMinScore,
        telegram_batch_hours: telegramBatchHours,
        last_telegram_flush_at: lastTelegramFlushAt,
        updated_at: now,
      },
      { onConflict: "id" },
    )
    .select(
      "id, telegram_min_score, telegram_batch_hours, last_telegram_flush_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "No se pudo guardar app_settings. ¿Aplicaste las migraciones 0017/0018?",
    );
  }

  return mapRow(data as AppSettingsRow);
}

export async function updateTelegramMinScore(
  score: number,
): Promise<AppSettings> {
  return updateAppSettings({ telegramMinScore: score });
}
