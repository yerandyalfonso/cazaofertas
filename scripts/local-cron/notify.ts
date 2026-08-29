import type { AmazonPriceCheckResult } from "@/services/amazonPriceCheck";
import {
  notifyCronAlert,
  notifyCronFailure,
} from "@/services/cronNotify";
import type { FlashDealsRunResult } from "@/services/flashDeals";
import type { RetailPriceCheckResult } from "@/services/retailPriceCheck";
import type { KiabiDealsRunResult } from "@/services/kiabiDeals";
import type { UserUrlAlertsResult } from "@/services/userUrlAlerts";

const JOB_PREFIX = "local";

function isRetailBlockedError(message: string): boolean {
  return /403|datadome|anti-bot|bloqueó|cloudflare|blocked/i.test(message);
}

function jobId(name: string): string {
  return `${JOB_PREFIX}/${name}`;
}

export async function notifyLocalCronFailure(
  job: string,
  error: unknown,
): Promise<void> {
  await notifyCronFailure({ job: jobId(job), error });
}

export async function reviewCheckPricesResult(
  result: AmazonPriceCheckResult,
  extras?: {
    flash?: FlashDealsRunResult & {
      pause?: { activated: boolean; denials: number };
    };
  },
): Promise<void> {
  const job = jobId("check-prices");
  const errors = result.stats.errors ?? [];
  const flash = extras?.flash;
  const flashErrors = flash?.errors ?? [];
  const flashFeedErrors = flash?.discovery?.feedErrors ?? [];

  if (result.pause?.activated) {
    await notifyCronAlert({
      job,
      headline: "Cron en pausa (Amazon)",
      lines: [
        `Denegaciones: ${result.pause.denials}`,
        result.pause.state?.pauseReason
          ? `Motivo: ${result.pause.state.pauseReason}`
          : "",
        result.pause.state?.pausedUntil
          ? `Hasta: ${result.pause.state.pausedUntil}`
          : "",
      ],
    });
    return;
  }

  if (flash?.pause?.activated) {
    await notifyCronAlert({
      job,
      headline: "Flash: pausa preventiva",
      lines: [`Denegaciones: ${flash.pause.denials}`],
    });
    return;
  }

  const amazonFailed =
    errors.length > 0 &&
    ((result.scoped > 0 && errors.length >= result.scoped) ||
      (result.stats.processed > 0 &&
        errors.length / result.stats.processed >= 0.5) ||
      errors.length >= 2);

  if (amazonFailed || flashErrors.length > 0 || flashFeedErrors.length > 0) {
    await notifyCronAlert({
      job,
      headline: "Errores en revisión Amazon / flash",
      lines: [
        `Precios: ${result.stats.processed} procesados · ${errors.length} errores`,
        ...errors.slice(0, 2).map((e) => `• ${e.asin}: ${e.message}`),
        flash
          ? `Flash: ${
              (flash.inserted ?? 0) +
              (flash.updated ?? 0) +
              (flash.unchanged ?? 0)
            } procesados · ${flashErrors.length} errores`
          : "",
        ...flashErrors
          .slice(0, 2)
          .map((e) => `• Flash ${e.asin}: ${e.message}`),
        ...flashFeedErrors
          .slice(0, 1)
          .map((e) => `• Feed: ${e.message}`),
      ],
    });
    return;
  }

  const updated = result.stats.updated ?? 0;
  const unchanged = result.stats.unchanged ?? 0;
  const deals = result.stats.dealsDetected ?? 0;
  const flashInserted = flash?.inserted ?? 0;
  const flashUpdated = flash?.updated ?? 0;
  const flashUnchanged = flash?.unchanged ?? 0;
  const flashChannel = flash?.channelNotificationsSent ?? 0;

  await notifyCronAlert({
    job,
    headline: "Amazon: revisión OK",
    lines: [
      `${result.stats.processed} revisados · ${updated} actualizados · ${unchanged} sin cambios`,
      deals > 0 ? `Rebajas detectadas: ${deals}` : "",
      flash
        ? `Flash: ${flashInserted} nuevos · ${flashUpdated} actualizados · ${flashUnchanged} sin cambios` +
          (flashChannel > 0 ? ` · canal ${flashChannel}` : "")
        : "",
    ],
  });
}

export async function reviewRetailPricesResult(
  result: RetailPriceCheckResult,
): Promise<void> {
  const job = jobId("check-prices");
  const errors = result.stats.errors ?? [];
  const blockedOnly =
    errors.length > 0 &&
    errors.every((error) => isRetailBlockedError(error.message));

  // Anti-bot omitido es esperado (DataDome); no spamear Telegram cada 10 min.
  if (errors.length === 0) return;

  await notifyCronAlert({
    job,
    headline: blockedOnly
      ? "Kiabi: bloqueo al revisar precios"
      : "Errores en revisión de precios (Kiabi)",
    lines: [
      `Monitorizables: ${result.monitorable}`,
      `Procesados: ${result.stats.processed}`,
      `Actualizados: ${result.stats.updated}`,
      `Omitidos (bloqueo): ${result.stats.skippedBlocked}`,
      `Errores: ${errors.length}/${result.scoped}`,
      ...errors
        .slice(0, 3)
        .map((error) => `• ${error.asin}: ${error.message}`),
      blockedOnly
        ? "Exporta cookies del navegador → KIABI_COOKIES_FILE en .env.local"
        : "",
    ],
  });
}

export async function reviewFlashDealsResult(
  result: FlashDealsRunResult & {
    pause?: { activated: boolean; denials: number };
  },
): Promise<void> {
  const job = jobId("flash-deals");
  const errors = result.errors ?? [];

  if (result.pause?.activated) {
    await notifyCronAlert({
      job,
      headline: "Flash: pausa preventiva",
      lines: [`Denegaciones: ${result.pause.denials}`],
    });
    return;
  }

  const feedErrors = result.discovery?.feedErrors ?? [];
  if (errors.length === 0 && feedErrors.length === 0) return;

  const errorLines = errors
    .slice(0, 3)
    .map((e) => `• ${e.asin}: ${e.message}`);
  const feedLines = feedErrors
    .slice(0, 2)
    .map((e) => `• Feed: ${e.message}`);

  await notifyCronAlert({
    job,
    headline: "Errores en flash deals",
    lines: [
      `Errores producto: ${errors.length}`,
      ...errorLines,
      feedErrors.length > 0 ? `Feeds fallidos: ${feedErrors.length}` : "",
      ...feedLines,
    ],
  });
}

export async function reviewKiabiDealsResult(
  result: KiabiDealsRunResult,
): Promise<void> {
  const job = jobId("kiabi-deals");

  if (!result.enabled) {
    await notifyCronAlert({
      job,
      headline: "Kiabi desactivado",
      lines: [
        "KIABI_DEALS_ENABLED no está en 1/true/on.",
        "Añádelo a .env.local y reinicia el cron.",
      ],
    });
    return;
  }

  const errors = result.errors ?? [];
  const feedErrors = result.discovery?.feedErrors ?? [];
  const dataDomeOnly =
    feedErrors.length > 0 &&
    feedErrors.every((e) => isRetailBlockedError(e.message)) &&
    errors.length === 0;
  const hasWork =
    result.inserted > 0 ||
    result.updated > 0 ||
    result.channelNotificationsSent > 0;

  if (hasWork || errors.length > 0 || feedErrors.length > 0) {
    const headline = hasWork
      ? result.discovery.usedFallback
        ? "Kiabi: OK (lista de respaldo)"
        : "Kiabi: sincronización OK"
      : dataDomeOnly
        ? "Kiabi: DataDome bloqueó el scrape"
        : "Kiabi: revisión con incidencias";

    await notifyCronAlert({
      job,
      headline,
      lines: [
        `Candidatos: ${result.discovery.candidates}`,
        result.discovery.usedFallback
          ? "Usó JSON de respaldo (promociones no accesibles desde Node)."
          : "",
        `Procesados: ${result.processed}`,
        `Nuevos: ${result.inserted} · Actualizados: ${result.updated}`,
        `Sin rebaja: ${result.skippedNoDiscount}`,
        result.skippedExisting > 0
          ? `Ya en catálogo (omitidos): ${result.skippedExisting}`
          : "",
        `Canal Telegram: ${result.channelNotificationsSent} enviados`,
        errors.length > 0 ? `Errores ficha: ${errors.length}` : "",
        errors
          .slice(0, 2)
          .map((e) => `• ${e.externalId}: ${e.message}`)
          .join("\n"),
        feedErrors.length > 0
          ? feedErrors
              .slice(0, 1)
              .map((e) => `Feed: ${e.message}`)
              .join("\n")
          : "",
        dataDomeOnly && !hasWork
          ? "El cron disparó bien; Kiabi exige navegador. Opcional: KIABI_COOKIES_FILE en .env.local"
          : "",
      ],
    });
    return;
  }

  await notifyCronAlert({
    job,
    headline: "Kiabi: prueba OK (sin novedades)",
    lines: [
      `Candidatos en rebajas: ${result.discovery.candidates}`,
      "No hubo chollos nuevos que superen el umbral de descuento.",
      "El cron está operativo; se reintentará en el próximo horario.",
    ],
  });
}

export async function reviewUserAlertsResult(
  result: UserUrlAlertsResult,
): Promise<void> {
  if (result.failed <= 0) return;

  await notifyCronAlert({
    job: jobId("user-alerts"),
    headline: "Alertas de usuario con fallos",
    lines: [
      `Revisadas: ${result.checked}`,
      `Fallidas: ${result.failed}`,
      `Omitidas: ${result.skipped}`,
    ],
  });
}
