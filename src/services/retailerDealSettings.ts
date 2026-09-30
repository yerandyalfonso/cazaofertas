/**
 * Ajustes de los jobs de ofertas de las tiendas nuevas (Carrefour, MediaMarkt),
 * en `app_settings.retailer_deal_settings` (JSON por tienda, migración 0055).
 * Lo guardado desde el admin tiene prioridad; lo que falte sale del .env.local
 * de la máquina que corre el job (hoy el Mac). Sin la columna, solo entorno.
 */

import { parseFeedUrlsText } from "@/lib/feed-urls";
import { RETAILER_DEAL_JOBS, type RetailerDealJob } from "@/lib/retailerDealJobs";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { APP_SETTINGS_ID } from "@/services/appSettings";
import type { Json } from "@/types/database";

export { RETAILER_DEAL_JOBS, type RetailerDealJob };

export interface RetailerDealSettings {
  enabled: boolean;
  minDiscountPercent: number;
  pagesPerFeed: number;
  /** Vacío = listados por defecto del job. */
  feedUrls: string[];
  /** Solo MediaMarkt: incluir ofertas de vendedores externos. */
  includeMarketplace: boolean;
}

export type RetailerDealSettingsMap = Record<RetailerDealJob, RetailerDealSettings>;
export type RetailerDealSettingsPatch = Partial<
  Record<RetailerDealJob, Partial<RetailerDealSettings>>
>;

const ENV_PREFIX: Record<RetailerDealJob, string> = {
  carrefour: "CARREFOUR",
  mediamarkt: "MEDIAMARKT",
};

/** Variable de entorno con los listados que recorre cada job. */
const ENV_FEED_VAR: Record<RetailerDealJob, string> = {
  carrefour: "CARREFOUR_BROWSER_FEED_URLS",
  mediamarkt: "MEDIAMARKT_FEED_URLS",
};

const DEFAULT_PAGES_PER_FEED: Record<RetailerDealJob, number> = {
  carrefour: 5,
  mediamarkt: 3,
};

const MAX_PAGES_PER_FEED = 10;

function clampPercent(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(90, Math.max(1, Math.round(value)));
}

function clampPages(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_PAGES_PER_FEED, Math.max(1, Math.round(value)));
}

function envNumber(name: string): number {
  const raw = process.env[name]?.trim();
  return raw ? Number(raw) : Number.NaN;
}

function envDefaults(job: RetailerDealJob): RetailerDealSettings {
  const prefix = ENV_PREFIX[job];
  return {
    enabled: process.env[`${prefix}_DEALS_ENABLED`]?.trim().toLowerCase() !== "false",
    minDiscountPercent: clampPercent(envNumber(`${prefix}_DEALS_MIN_DISCOUNT`), 15),
    pagesPerFeed: clampPages(
      envNumber(`${prefix}_DEALS_PAGES_PER_FEED`),
      DEFAULT_PAGES_PER_FEED[job],
    ),
    feedUrls: parseFeedUrlsText(process.env[ENV_FEED_VAR[job]]),
    includeMarketplace: process.env[`${prefix}_DEALS_INCLUDE_MARKETPLACE`] === "1",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeStored(job: RetailerDealJob, stored: unknown): RetailerDealSettings {
  const env = envDefaults(job);
  const row = asRecord(stored);
  return {
    enabled: typeof row.enabled === "boolean" ? row.enabled : env.enabled,
    minDiscountPercent:
      row.minDiscountPercent != null
        ? clampPercent(Number(row.minDiscountPercent), env.minDiscountPercent)
        : env.minDiscountPercent,
    pagesPerFeed:
      row.pagesPerFeed != null
        ? clampPages(Number(row.pagesPerFeed), env.pagesPerFeed)
        : env.pagesPerFeed,
    feedUrls:
      Array.isArray(row.feedUrls) && row.feedUrls.length > 0
        ? row.feedUrls.filter((url): url is string => typeof url === "string")
        : env.feedUrls,
    includeMarketplace:
      typeof row.includeMarketplace === "boolean"
        ? row.includeMarketplace
        : env.includeMarketplace,
  };
}

async function fetchStored(): Promise<Record<string, unknown> | null> {
  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("app_settings")
    .select("retailer_deal_settings")
    .eq("id", APP_SETTINGS_ID)
    .maybeSingle();
  if (error) {
    console.warn("[retailer-deal-settings]", error.message);
    return null;
  }
  return asRecord(data?.retailer_deal_settings);
}

export async function getRetailerDealSettingsMap(): Promise<RetailerDealSettingsMap> {
  const stored = (await fetchStored()) ?? {};
  return {
    carrefour: mergeStored("carrefour", stored.carrefour),
    mediamarkt: mergeStored("mediamarkt", stored.mediamarkt),
  };
}

export async function getRetailerDealSettings(
  job: RetailerDealJob,
): Promise<RetailerDealSettings> {
  return (await getRetailerDealSettingsMap())[job];
}

/** Guarda desde el admin; solo se tocan las tiendas y campos que llegan. */
export async function updateRetailerDealSettings(
  patch: RetailerDealSettingsPatch,
): Promise<RetailerDealSettingsMap> {
  const stored = await fetchStored();
  if (stored === null) {
    throw new Error(
      "No se pudo leer retailer_deal_settings. Aplica la migración 0055_app_settings_retailer_deals.sql.",
    );
  }

  const next: Record<string, unknown> = { ...stored };
  for (const job of RETAILER_DEAL_JOBS) {
    const changes = patch[job];
    if (!changes) continue;
    const current = mergeStored(job, stored[job]);
    next[job] = {
      ...asRecord(stored[job]),
      ...(changes.enabled !== undefined ? { enabled: changes.enabled } : {}),
      ...(changes.minDiscountPercent !== undefined
        ? {
            minDiscountPercent: clampPercent(
              changes.minDiscountPercent,
              current.minDiscountPercent,
            ),
          }
        : {}),
      ...(changes.pagesPerFeed !== undefined
        ? { pagesPerFeed: clampPages(changes.pagesPerFeed, current.pagesPerFeed) }
        : {}),
      ...(changes.feedUrls !== undefined ? { feedUrls: changes.feedUrls } : {}),
      ...(changes.includeMarketplace !== undefined
        ? { includeMarketplace: changes.includeMarketplace }
        : {}),
    };
  }

  const client = createSupabaseServiceClient();
  const { error } = await client
    .from("app_settings")
    .update({
      retailer_deal_settings: next as Json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", APP_SETTINGS_ID);
  if (error) {
    throw new Error(`No se pudo guardar retailer_deal_settings: ${error.message}`);
  }

  return getRetailerDealSettingsMap();
}
