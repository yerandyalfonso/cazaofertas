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
  CRON_SECRET: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHANNEL_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_MIN_SCORE: z.string().optional(),
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
    CRON_SECRET: process.env.CRON_SECRET,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    TELEGRAM_MIN_SCORE: process.env.TELEGRAM_MIN_SCORE,
  });
}

export function getTelegramEnv(): TelegramEnv {
  return telegramEnvSchema.parse({
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHANNEL_ID: process.env.TELEGRAM_CHANNEL_ID,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  });
}

/** Chat/canal destino para alertas broadcast (-100… o @canal). */
export function getTelegramChannelId(): string | number | null {
  const raw = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  return raw.startsWith("@") ? raw : `@${raw}`;
}

export function getTelegramMinScore(): number {
  const parsed = Number.parseFloat(process.env.TELEGRAM_MIN_SCORE ?? "75");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 75;
}

export function getEnvStatus() {
  return {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    telegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramChannelId: Boolean(process.env.TELEGRAM_CHANNEL_ID),
    telegramWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
  };
}
