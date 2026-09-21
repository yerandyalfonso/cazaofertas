/**
 * Envía un mensaje de PRUEBA directo al canal real de Telegram (no pasa por la cola).
 * Uso: tsx --env-file=.env.local scripts/local-cron/test-telegram-channel.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  const { sendTelegramMessage } = await import("@/services/telegram/bot");
  const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!chatId) throw new Error("Falta TELEGRAM_CHANNEL_ID en .env.local");

  console.log("[test-telegram] Enviando mensaje de prueba al canal…");
  const result = await sendTelegramMessage({
    chatId,
    text: "🧪 <b>Prueba CazaOferta</b> — verificación del sistema tras la migración al VPS. Ignora este mensaje.",
  });
  console.log("[test-telegram] Enviado. message_id:", result.message_id);
}

main().catch((error) => {
  console.error("[test-telegram] error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
