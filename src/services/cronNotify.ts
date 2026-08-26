import { formatEnvError } from "@/lib/env";
import {
  isTelegramConfigured,
  sendTelegramMessage,
} from "@/services/telegram/bot";

function resolveAdminChatId(): string | number | null {
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (admin) {
    const asNumber = Number(admin);
    return Number.isFinite(asNumber) && admin === String(asNumber)
      ? asNumber
      : admin;
  }

  // Fallback: canal principal (mensaje marcado como admin/cron).
  const channel = process.env.TELEGRAM_CHANNEL_ID?.trim();
  return channel || null;
}

/**
 * Aviso interno si un cron falla por completo.
 * No lanza: el endpoint debe seguir devolviendo el 500 original.
 */
export async function notifyCronFailure(options: {
  job: string;
  error: unknown;
}): Promise<void> {
  if (!isTelegramConfigured()) return;

  const chatId = resolveAdminChatId();
  if (!chatId) return;

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
