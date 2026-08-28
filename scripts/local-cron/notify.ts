import type { AmazonPriceCheckResult } from "@/services/amazonPriceCheck";
import {
  notifyCronAlert,
  notifyCronFailure,
} from "@/services/cronNotify";
import type { FlashDealsRunResult } from "@/services/flashDeals";
import type { UserUrlAlertsResult } from "@/services/userUrlAlerts";

const JOB_PREFIX = "local";

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
): Promise<void> {
  const job = jobId("check-prices");
  const errors = result.stats.errors ?? [];

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

  if (errors.length === 0) return;

  const allFailed =
    result.scoped > 0 && errors.length >= result.scoped;
  const mostlyFailed =
    result.stats.processed > 0 &&
    errors.length / result.stats.processed >= 0.5;

  if (!allFailed && !mostlyFailed && errors.length < 2) return;

  const sample = errors
    .slice(0, 3)
    .map((e) => `• ${e.asin}: ${e.message}`)
    .join("\n");

  await notifyCronAlert({
    job,
    headline: "Errores en revisión de precios",
    lines: [
      `Procesados: ${result.stats.processed}`,
      `Errores: ${errors.length}/${result.scoped}`,
      sample,
      errors.length > 3 ? `… y ${errors.length - 3} más` : "",
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
