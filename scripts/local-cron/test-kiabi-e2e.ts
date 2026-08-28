/**
 * Prueba E2E Kiabi: discovery → scrape → Supabase → Telegram canal.
 * Solo usa datos reales (precio rebajado + precio de referencia tachado).
 *
 * Uso: npm run cron:local:kiabi-e2e
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  const { runKiabiDealsCheck } = await import("@/services/kiabiDeals");
  const { reviewKiabiDealsResult } = await import("./notify");
  const { notifyCronAlert } = await import("@/services/cronNotify");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }

  console.log("[kiabi-e2e] Ejecutando cron Kiabi (promociones con rebaja real)…");
  const result = await runKiabiDealsCheck({
    limit: 2,
    notify: true,
    delayMs: 2_000,
    feedUrls: ["https://www.kiabi.es/promociones_464410"],
  });
  console.log(JSON.stringify(result, null, 2));

  await reviewKiabiDealsResult(result);

  const ok =
    result.inserted > 0 ||
    result.updated > 0 ||
    result.channelNotificationsSent > 0;

  if (!ok) {
    await notifyCronAlert({
      job: "local/kiabi-e2e",
      headline: "Kiabi E2E sin chollos",
      lines: [
        `Candidatos: ${result.discovery.candidates}`,
        `Procesados: ${result.processed}`,
        `Sin rebaja real: ${result.skippedNoDiscount}`,
        result.discovery.feedErrors[0]?.message ??
          "Puede ser bloqueo DataDome o ningún producto con precio tachado.",
      ],
    });
    throw new Error(
      "E2E Kiabi: no hubo productos con rebaja real (precio tachado).",
    );
  }

  await notifyCronAlert({
    job: "local/kiabi-e2e",
    headline: "Kiabi E2E OK",
    lines: [
      `Nuevos: ${result.inserted} · Actualizados: ${result.updated}`,
      `Telegram canal: ${result.channelNotificationsSent}`,
      "Revisa el canal: la alerta debería incluir foto del producto.",
    ],
  });

  console.log("[kiabi-e2e] OK — pipeline completo verificado.");
}

main().catch((error) => {
  console.error(
    "[kiabi-e2e] error:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
