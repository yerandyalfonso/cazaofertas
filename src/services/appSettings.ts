/**
 * Ajustes de producto en `app_settings` (fila `default`).
 * El umbral Telegram puede overridear TELEGRAM_MIN_SCORE del entorno.
 */

import { getTelegramMinScore as getTelegramMinScoreFromEnv } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const APP_SETTINGS_ID = "default";

export interface AppSettings {
  id: string;
  telegramMinScore: number;
  updatedAt: string | null;
  /** true si el valor viene de BD; false si es fallback env. */
  source: "database" | "env";
}

type AppSettingsRow = {
  id: string;
  telegram_min_score: number | string;
  updated_at: string;
};

function clampTelegramMinScore(value: number): number {
  if (!Number.isFinite(value)) return getTelegramMinScoreFromEnv();
  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

function mapRow(row: AppSettingsRow): AppSettings {
  return {
    id: row.id,
    telegramMinScore: clampTelegramMinScore(Number(row.telegram_min_score)),
    updatedAt: row.updated_at ?? null,
    source: "database",
  };
}

async function ensureRow(): Promise<AppSettingsRow | null> {
  try {
    const client = createSupabaseServiceClient();
    const { data, error } = await client
      .from("app_settings")
      .select("id, telegram_min_score, updated_at")
      .eq("id", APP_SETTINGS_ID)
      .maybeSingle();

    if (error) {
      // Tabla aún no migrada → fallback silencioso al env.
      console.warn("[app_settings]", error.message);
      return null;
    }
    if (data) return data as AppSettingsRow;

    const { data: inserted, error: insertError } = await client
      .from("app_settings")
      .insert({
        id: APP_SETTINGS_ID,
        telegram_min_score: getTelegramMinScoreFromEnv(),
      })
      .select("id, telegram_min_score, updated_at")
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
  return {
    id: APP_SETTINGS_ID,
    telegramMinScore: getTelegramMinScoreFromEnv(),
    updatedAt: null,
    source: "env",
  };
}

/** Umbral mínimo de score para publicar en el canal/grupo de Telegram. */
export async function resolveTelegramMinScore(): Promise<number> {
  const settings = await getAppSettings();
  return settings.telegramMinScore;
}

export async function updateTelegramMinScore(
  score: number,
): Promise<AppSettings> {
  const telegramMinScore = clampTelegramMinScore(score);
  const client = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("app_settings")
    .upsert(
      {
        id: APP_SETTINGS_ID,
        telegram_min_score: telegramMinScore,
        updated_at: now,
      },
      { onConflict: "id" },
    )
    .select("id, telegram_min_score, updated_at")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ??
        "No se pudo guardar app_settings. ¿Aplicaste la migración 0017?",
    );
  }

  return mapRow(data as AppSettingsRow);
}
