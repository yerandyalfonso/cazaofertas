import { formatEnvError } from "@/lib/env";
import {
  isTelegramConfigured,
  sendTelegramMessage,
} from "@/services/telegram/bot";

function resolveAdminChatId(): string | number | null {
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!admin) return null;

  const asNumber = Number(admin);
  return Number.isFinite(asNumber) && admin === String(asNumber)
    ? asNumber
    : admin;
}

async function sendAdminCronTelegram(text: string): Promise<void> {
  if (!isTelegramConfigured()) return;

  const chatId = resolveAdminChatId();
  if (!chatId) {
    console.warn(
      "[cron] Falta TELEGRAM_ADMIN_CHAT_ID; no se envió aviso de fallo.",
    );
    return;
  }

  try {
    await sendTelegramMessage({
      chatId,
      text,
      disableWebPagePreview: true,
    });
  } catch (notifyError) {
    console.error("[cron] No se pudo avisar por Telegram:", notifyError);
  }
}

/**
 * Aviso interno al chat privado del admin (TELEGRAM_ADMIN_CHAT_ID).
 * No usa el canal público. No lanza: el endpoint debe seguir devolviendo el 500.
 */
export async function notifyCronFailure(options: {
  job: string;
  error: unknown;
}): Promise<void> {
  const detail = formatEnvError(options.error).slice(0, 500);
  await sendAdminCronTelegram(
    [
      "⚠️ <b>Cron fallido</b>",
      "",
      `Job: <code>${options.job}</code>`,
      `Error: ${detail}`,
      "",
      `<i>${new Date().toISOString()}</i>`,
    ].join("\n"),
  );
}

/** Aviso de ejecución con errores parciales (lote con fallos, pausa, etc.). */
export async function notifyCronAlert(options: {
  job: string;
  headline: string;
  lines: string[];
}): Promise<void> {
  const body = options.lines.map((line) => line.trim()).filter(Boolean).join("\n");
  await sendAdminCronTelegram(
    [
      `⚠️ <b>${options.headline}</b>`,
      "",
      `Job: <code>${options.job}</code>`,
      body,
      "",
      `<i>${new Date().toISOString()}</i>`,
    ].join("\n"),
  );
}
