/**
 * Umbral de descuento y espaciado mínimo para publicar en Facebook/Instagram
 * (Meta), en `app_settings` (misma fila `default`, columnas propias —
 * ver migración 0041). Independiente del umbral de Telegram: Meta bloqueó
 * temporalmente la página por volumen de publicación (Facebook 368,
 * Instagram 9), así que aquí el umbral va más alto y se espacian los envíos.
 */

import { createSupabaseServiceClient } from "@/lib/supabase";
import { APP_SETTINGS_ID } from "@/services/appSettings";

export interface MetaSocialSettings {
  minDiscountPercent: number;
  postIntervalMinutes: number;
  /** Nº de chollos por publicación (carrusel Facebook + Instagram). */
  batchSize: number;
  lastPostAt: string | null;
}

const DEFAULT_MIN_DISCOUNT_PERCENT = 70;
const DEFAULT_POST_INTERVAL_MINUTES = 30;
const DEFAULT_BATCH_SIZE = 10;
/** Instagram no admite más de 10 elementos por carrusel. */
const MAX_BATCH_SIZE = 10;

function clampPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(99, Math.max(0, Math.round(value * 100) / 100));
}

function clampIntervalMinutes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(720, Math.max(0, Math.round(value)));
}

function clampBatchSize(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_BATCH_SIZE, Math.max(2, Math.round(value)));
}

function envDefaults(): Omit<MetaSocialSettings, "lastPostAt"> {
  return {
    minDiscountPercent: clampPercent(
      Number.parseFloat(process.env.META_MIN_DISCOUNT_PERCENT ?? "70"),
      DEFAULT_MIN_DISCOUNT_PERCENT,
    ),
    postIntervalMinutes: clampIntervalMinutes(
      Number.parseInt(process.env.META_POST_INTERVAL_MINUTES ?? "30", 10),
      DEFAULT_POST_INTERVAL_MINUTES,
    ),
    batchSize: clampBatchSize(
      Number.parseInt(process.env.META_BATCH_SIZE ?? "10", 10),
      DEFAULT_BATCH_SIZE,
    ),
  };
}

export async function getMetaSocialSettings(): Promise<MetaSocialSettings> {
  const client = createSupabaseServiceClient();
  const env = envDefaults();

  const { data, error } = await client
    .from("app_settings")
    .select(
      "meta_min_discount_percent, meta_post_interval_minutes, meta_batch_size, last_meta_post_at",
    )
    .eq("id", APP_SETTINGS_ID)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("[meta-social-settings]", error.message);
    return { ...env, lastPostAt: null };
  }

  return {
    minDiscountPercent: clampPercent(
      Number(data.meta_min_discount_percent ?? env.minDiscountPercent),
      env.minDiscountPercent,
    ),
    postIntervalMinutes: clampIntervalMinutes(
      Number(data.meta_post_interval_minutes ?? env.postIntervalMinutes),
      env.postIntervalMinutes,
    ),
    batchSize: clampBatchSize(
      Number(data.meta_batch_size ?? env.batchSize),
      env.batchSize,
    ),
    lastPostAt: data.last_meta_post_at ?? null,
  };
}

export async function resolveMetaMinDiscountPercent(): Promise<number> {
  return (await getMetaSocialSettings()).minDiscountPercent;
}

/** ¿Ya pasó el espaciado mínimo desde la última publicación en Meta? */
export async function isMetaPostIntervalElapsed(
  settings?: MetaSocialSettings,
): Promise<boolean> {
  const resolved = settings ?? (await getMetaSocialSettings());
  if (!resolved.lastPostAt || resolved.postIntervalMinutes <= 0) return true;
  const elapsedMs = Date.now() - new Date(resolved.lastPostAt).getTime();
  return elapsedMs >= resolved.postIntervalMinutes * 60_000;
}

/** Guarda desde el admin el umbral de descuento, el espaciado y/o el tamaño de lote. */
export async function updateMetaSocialSettings(patch: {
  minDiscountPercent?: number;
  postIntervalMinutes?: number;
  batchSize?: number;
}): Promise<MetaSocialSettings> {
  const current = await getMetaSocialSettings();
  const client = createSupabaseServiceClient();

  const update: {
    updated_at: string;
    meta_min_discount_percent?: number;
    meta_post_interval_minutes?: number;
    meta_batch_size?: number;
  } = { updated_at: new Date().toISOString() };
  if (patch.minDiscountPercent !== undefined) {
    update.meta_min_discount_percent = clampPercent(
      patch.minDiscountPercent,
      current.minDiscountPercent,
    );
  }
  if (patch.postIntervalMinutes !== undefined) {
    update.meta_post_interval_minutes = clampIntervalMinutes(
      patch.postIntervalMinutes,
      current.postIntervalMinutes,
    );
  }
  if (patch.batchSize !== undefined) {
    update.meta_batch_size = clampBatchSize(patch.batchSize, current.batchSize);
  }

  const { error } = await client
    .from("app_settings")
    .update(update)
    .eq("id", APP_SETTINGS_ID);
  if (error) {
    throw new Error(error.message);
  }

  return getMetaSocialSettings();
}

/** Marca "se acaba de publicar en Meta" (Facebook y/o Instagram). */
export async function recordMetaPostSent(): Promise<void> {
  const client = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("app_settings")
    .update({ last_meta_post_at: now, updated_at: now })
    .eq("id", APP_SETTINGS_ID);
  if (error) {
    console.warn("[meta-social-settings] no se pudo guardar last_meta_post_at", error.message);
  }
}
