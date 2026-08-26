import { TELEGRAM_BOT_URL } from "@/lib/catalog";

/** Deep-links t.me → /start <payload> en el bot. */
export function telegramBotUrl(startPayload?: string | null): string {
  const base = TELEGRAM_BOT_URL.replace(/\/$/, "");
  if (!startPayload?.trim()) return base;
  return `${base}?start=${encodeURIComponent(startPayload.trim())}`;
}

export function telegramAlertForAsin(asin: string): string {
  return telegramBotUrl(`asin_${asin.trim().toUpperCase()}`);
}

export function telegramAlertForCategorySlug(slug: string): string {
  return telegramBotUrl(`cat_${slug.trim().toLowerCase()}`);
}

export function telegramAlertForKeyword(keyword: string): string {
  const safe = keyword.trim().slice(0, 64).replace(/\s+/g, "_");
  return telegramBotUrl(`kw_${safe}`);
}

export function parseTelegramStartPayload(raw: string | undefined | null): {
  type: "asin" | "cat" | "kw";
  value: string;
} | null {
  const text = raw?.trim();
  if (!text) return null;
  if (text.startsWith("asin_")) {
    const value = text.slice(5).trim().toUpperCase();
    return value ? { type: "asin", value } : null;
  }
  if (text.startsWith("cat_")) {
    const value = text.slice(4).trim().toLowerCase();
    return value ? { type: "cat", value } : null;
  }
  if (text.startsWith("kw_")) {
    const value = text.slice(3).trim().replace(/_/g, " ");
    return value ? { type: "kw", value } : null;
  }
  return null;
}
