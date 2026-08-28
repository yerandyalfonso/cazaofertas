/**
 * Prueba real Kiabi: ingesta candidatos ya descubiertos (p. ej. desde navegador)
 * y envía al canal Telegram. Solo procesa novedades (no re-publica los mismos).
 *
 * Uso:
 *   npm run cron:local:kiabi-real
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

import type { KiabiDiscoveredItem } from "@/providers/retail/kiabi/types";

async function main(): Promise<void> {
  const itemsPath = resolve(
    process.cwd(),
    process.argv[2] ?? "scripts/local-cron/.kiabi-browser-items.json",
  );
  const raw = readFileSync(itemsPath, "utf8");
  const items = JSON.parse(raw) as KiabiDiscoveredItem[];

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Sin candidatos en ${itemsPath}`);
  }

  const { runKiabiDealsCheck } = await import("@/services/kiabiDeals");
  const { reviewKiabiDealsResult } = await import("./notify");
  const { notifyCronAlert } = await import("@/services/cronNotify");

  console.log(
    `[kiabi-real] ${items.length} candidatos en JSON (modo solo novedades)…`,
  );

  const result = await runKiabiDealsCheck({
    onlyItems: items,
    limit: items.length,
    notify: true,
    delayMs: 1_500,
    newProductsOnly: true,
  });

  console.log(JSON.stringify(result, null, 2));
  await reviewKiabiDealsResult(result);

  if (result.processed === 0 && result.skippedExisting > 0) {
    await notifyCronAlert({
      job: "local/kiabi-real-test",
      headline: "Kiabi: sin novedades",
      lines: [
        `${result.skippedExisting} productos ya estaban en catálogo al mismo precio.`,
        "No se reenvían al canal (evita duplicados).",
        "Actualiza el JSON con más artículos de promociones o espera al cron.",
      ],
    });
    console.log(
      "[kiabi-real] Sin novedades: todos los candidatos ya están en catálogo.",
    );
    return;
  }

  await notifyCronAlert({
    job: "local/kiabi-real-test",
    headline: "Kiabi: prueba real en Telegram",
    lines: [
      `Candidatos en JSON: ${items.length}`,
      `Omitidos (ya en catálogo): ${result.skippedExisting}`,
      `Nuevos en BD: ${result.inserted}`,
      `Actualizados: ${result.updated}`,
      `Alertas canal: ${result.channelNotificationsSent}`,
      result.channelNotificationsSent > 0
        ? "Revisa @cazador_de_ofertas (con foto)."
        : "Sin envío al canal (cooldown o score).",
    ],
  });

  if (
    result.inserted === 0 &&
    result.updated === 0 &&
    result.channelNotificationsSent === 0 &&
    result.processed === 0
  ) {
    throw new Error("No se insertó ni notificó ningún chollo Kiabi.");
  }
}

main().catch((error) => {
  console.error(
    "[kiabi-real] error:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
