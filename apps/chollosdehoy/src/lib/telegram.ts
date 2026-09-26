/**
 * Enlaces a Telegram (mismo bot y canal que CazaOfertas). Los deep links
 * `?start=asin_…` / `?start=cat_…` abren el asistente de alertas del bot con
 * el producto o la categoría ya puestos — ver `parseTelegramStartPayload`.
 */
const TELEGRAM_BOT_URL = (
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL ?? "https://t.me/cazandor_de_ofertas_bot"
).replace(/\/$/, "");

/** Canal público de difusión (el grupo con temas es privado). */
export const TELEGRAM_CHANNEL_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ?? "https://t.me/cazador_de_ofertas";

function botUrl(startPayload: string): string {
  return `${TELEGRAM_BOT_URL}?start=${encodeURIComponent(startPayload)}`;
}

export function telegramAlertForAsin(asin: string): string {
  return botUrl(`asin_${asin.trim().toUpperCase()}`);
}

export function telegramAlertForCategory(slug: string): string {
  return botUrl(`cat_${slug.trim().toLowerCase()}`);
}
