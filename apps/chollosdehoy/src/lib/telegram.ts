/**
 * Enlaces a Telegram (mismo bot y canal que CazaOfertas). Los deep links
 * `?start=asin_…` / `?start=cat_…` abren el asistente de alertas del bot con
 * el producto o la categoría ya puestos — ver `parseTelegramStartPayload`.
 */
const TELEGRAM_BOT_URL = (
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ?? "https://t.me/cazando_ofertas_bot"
).replace(/\/$/, "");

/** Grupo público con temas por categoría (@chollosdhoy). */
export const TELEGRAM_GROUP_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_GROUP_URL ?? "https://t.me/chollosdhoy";

function botUrl(startPayload: string): string {
  return `${TELEGRAM_BOT_URL}?start=${encodeURIComponent(startPayload)}`;
}

export function telegramAlertForAsin(asin: string): string {
  return botUrl(`asin_${asin.trim().toUpperCase()}`);
}

export function telegramAlertForCategory(slug: string): string {
  return botUrl(`cat_${slug.trim().toLowerCase()}`);
}
