import { z } from "zod";

function normalizeSupabaseUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.origin;
}

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .transform(normalizeSupabaseUrl),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, {
    message:
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local (Settings > API > service_role).",
  }),
  AMAZON_ASSOCIATE_TAG: z.string().optional(),
  AMAZON_MARKETPLACE: z.string().default("ES"),
  AMAZON_API_ACCESS_KEY: z.string().optional(),
  AMAZON_API_SECRET: z.string().optional(),
  KEEPA_API_KEY: z.string().optional(),
  PRICE_PROVIDER: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  TELEGRAM_PUBLIC_CHANNEL_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_MIN_SCORE: z.string().optional(),
  FACEBOOK_PAGE_ID: z.string().optional(),
  FACEBOOK_PAGE_ACCESS_TOKEN: z.string().optional(),
  FACEBOOK_GRAPH_API_VERSION: z.string().optional(),
  INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const telegramEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, {
    message: "Falta TELEGRAM_BOT_TOKEN en .env.local.",
  }),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
});

export type TelegramEnv = z.infer<typeof telegramEnvSchema>;

export function formatEnvError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Error de configuración.";
}

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function getServerEnv(): ServerEnv {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local. Cópiala desde Supabase → Project Settings → API → service_role.",
    );
  }

  return serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    AMAZON_ASSOCIATE_TAG: process.env.AMAZON_ASSOCIATE_TAG,
    AMAZON_MARKETPLACE: process.env.AMAZON_MARKETPLACE ?? "ES",
    AMAZON_API_ACCESS_KEY: process.env.AMAZON_API_ACCESS_KEY,
    AMAZON_API_SECRET: process.env.AMAZON_API_SECRET,
    KEEPA_API_KEY: process.env.KEEPA_API_KEY,
    PRICE_PROVIDER: process.env.PRICE_PROVIDER,
    CRON_SECRET: process.env.CRON_SECRET,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
    TELEGRAM_PUBLIC_CHANNEL_ID: process.env.TELEGRAM_PUBLIC_CHANNEL_ID,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    TELEGRAM_MIN_SCORE: process.env.TELEGRAM_MIN_SCORE,
    FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID,
    FACEBOOK_PAGE_ACCESS_TOKEN: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    FACEBOOK_GRAPH_API_VERSION: process.env.FACEBOOK_GRAPH_API_VERSION,
    INSTAGRAM_BUSINESS_ACCOUNT_ID: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
  });
}

export function getTelegramEnv(): TelegramEnv {
  return telegramEnvSchema.parse({
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  });
}

/** Chat/canal destino para alertas broadcast (-100… o @canal). Grupo con temas. */
export function getTelegramChannelId(): string | number | null {
  const raw = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw.startsWith("@") ? raw : `@${raw}`;
}

/**
 * Canal público de difusión (p. ej. @cazador_de_ofertas).
 * Mismas ofertas que el grupo, pero con links en el texto (sin botones).
 */
export function getTelegramPublicChannelId(): string | number | null {
  const raw =
    process.env.TELEGRAM_PUBLIC_CHANNEL_ID?.trim() ||
    process.env.TELEGRAM_BROADCAST_CHANNEL_ID?.trim();
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw.startsWith("@") ? raw : `@${raw}`;
}

export function getTelegramMinScore(): number {
  const parsed = Number.parseFloat(process.env.TELEGRAM_MIN_SCORE ?? "75");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 75;
}

export function getFacebookPageId(): string | null {
  const raw = process.env.FACEBOOK_PAGE_ID?.trim();
  return raw || null;
}

export function getFacebookPageAccessToken(): string | null {
  const raw = process.env.FACEBOOK_PAGE_ACCESS_TOKEN?.trim();
  return raw || null;
}

/** Graph API version (v18 está obsoleto). Override: FACEBOOK_GRAPH_API_VERSION. */
export function getFacebookGraphApiVersion(): string {
  const raw = process.env.FACEBOOK_GRAPH_API_VERSION?.trim();
  if (!raw) return "v23.0";
  return raw.startsWith("v") ? raw : `v${raw}`;
}

export function isFacebookPageConfigured(): boolean {
  return Boolean(getFacebookPageId() && getFacebookPageAccessToken());
}

/** IG User ID (Instagram Business / Creator vinculado a la Página). */
export function getInstagramBusinessAccountId(): string | null {
  const raw = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim();
  return raw || null;
}

export function isInstagramPublishingConfigured(): boolean {
  return Boolean(
    getInstagramBusinessAccountId() && getFacebookPageAccessToken(),
  );
}

export function getEnvStatus() {
  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    telegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramChannelId: Boolean(process.env.TELEGRAM_CHANNEL_ID),
    telegramPublicChannelId: Boolean(
      process.env.TELEGRAM_PUBLIC_CHANNEL_ID ||
        process.env.TELEGRAM_BROADCAST_CHANNEL_ID,
    ),
    telegramWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
    facebookPageId: Boolean(process.env.FACEBOOK_PAGE_ID),
    facebookPageAccessToken: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN),
    instagramBusinessAccountId: Boolean(
      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    ),
  };
}
