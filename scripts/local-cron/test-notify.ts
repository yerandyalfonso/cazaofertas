/**
 * Envía mensajes de prueba al chat admin (TELEGRAM_ADMIN_CHAT_ID).
 * Uso: npm run cron:local:test-notify
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  const { notifyCronAlert, notifyCronFailure } = await import(
    "@/services/cronNotify"
  );

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new Error("Falta TELEGRAM_BOT_TOKEN en .env.local");
  }
  if (!process.env.TELEGRAM_ADMIN_CHAT_ID?.trim()) {
    throw new Error(
      "Falta TELEGRAM_ADMIN_CHAT_ID en .env.local (tu chat privado con el bot).",
    );
  }

  console.log("[test-notify] Enviando aviso de fallo fatal…");
  await notifyCronFailure({
    job: "local/check-prices",
    error: new Error("[PRUEBA] Simulación de cron caído — ignora este mensaje."),
  });

  console.log("[test-notify] Enviando aviso de errores parciales…");
  await notifyCronAlert({
    job: "local/check-prices",
    headline: "[PRUEBA] Errores en revisión de precios",
    lines: [
      "Procesados: 2",
      "Errores: 2/2",
      "• B000000000: Amazon devolvió un challenge anti-bot (bloqueado).",
      "• B000000001: Amazon temporalmente no disponible (HTTP 503).",
    ],
  });

  console.log("[test-notify] Enviando aviso de pausa…");
  await notifyCronAlert({
    job: "local/flash-deals",
    headline: "[PRUEBA] Cron en pausa (Amazon)",
    lines: [
      "Denegaciones: 3",
      "Motivo: Demasiadas denegaciones Amazon en el lote",
      "Hasta: 2026-08-28T14:00:00.000Z",
    ],
  });

  console.log(
    "[test-notify] Listo. Revisa Telegram (3 mensajes de prueba).",
  );
}

main().catch((error) => {
  console.error(
    "[test-notify] error:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
