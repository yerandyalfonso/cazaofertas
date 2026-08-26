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

/**
 * Aviso interno al chat privado del admin (TELEGRAM_ADMIN_CHAT_ID).
 * No usa el canal público. No lanza: el endpoint debe seguir devolviendo el 500.
 */
export async function notifyCronFailure(options: {
  job: string;
  error: unknown;
}): Promise<void> {
  if (!isTelegramConfigured()) return;

  const chatId = resolveAdminChatId();
  if (!chatId) {
    console.warn(
      "[cron] Falta TELEGRAM_ADMIN_CHAT_ID; no se envió aviso de fallo.",
    );
    return;
  }

  const detail = formatEnvError(options.error).slice(0, 500);

  try {
    await sendTelegramMessage({
      chatId,
      text: [
        "⚠️ <b>Cron fallido</b>",
        "",
        `Job: <code>${options.job}</code>`,
        `Error: ${detail}`,
        "",
        `<i>${new Date().toISOString()}</i>`,
      ].join("\n"),
      disableWebPagePreview: true,
    });
  } catch (notifyError) {
    console.error("[cron] No se pudo avisar por Telegram:", notifyError);
  }
}
