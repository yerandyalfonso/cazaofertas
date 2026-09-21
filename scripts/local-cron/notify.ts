import type { AmazonPriceCheckResult } from "@/services/amazonPriceCheck";
import {
  markAsinFailureActionTaken,
  getPersistFailureThreshold,
  recordAsinScrapeFailure,
} from "@/services/asinScrapeFailures";
import {
  notifyCronAlert,
  notifyCronFailure,
} from "@/services/cronNotify";
import type { FlashDealsRunResult } from "@/services/flashDeals";
import type { RetailPriceCheckResult } from "@/services/retailPriceCheck";
import type { KiabiDealsRunResult } from "@/services/kiabiDeals";
import type { MiraviaDealsRunResult } from "@/services/miraviaDeals";
import type { UserUrlAlertsResult } from "@/services/userUrlAlerts";
import { createSupabaseServiceClient } from "@/lib/supabase";

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

async function deactivatePersistentAsin(asin: string): Promise<boolean> {
  const client = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("products")
    .update({
      is_active: false,
      last_checked_at: now,
      updated_at: now,
    })
    .eq("asin", asin.toUpperCase())
    .eq("is_active", true);

  if (error) {
    console.error(`[cron] No se pudo desactivar ${asin}:`, error.message);
    return false;
  }
  await markAsinFailureActionTaken(asin);
  return true;
}

/**
 * Filtra errores repetidos del mismo ASIN: solo avisa al 1.er fallo,
 * al umbral de persistencia (y desactiva), o tras cooldown.
 */
async function filterAsinErrorsForAlert(
  errors: Array<{ asin: string; message: string }>,
): Promise<{
  lines: string[];
  deactivated: string[];
}> {
  const lines: string[] = [];
  const deactivated: string[] = [];

  for (const error of errors) {
    const decision = await recordAsinScrapeFailure(error.asin, error.message);
    if (!decision.notify) continue;

    const suffix =
      decision.reason === "persistent"
        ? ` · ${decision.record.count} fallos → desactivar`
        : decision.reason === "renotify"
          ? ` · sigue fallando (${decision.record.count}×)`
          : "";

    lines.push(`• ${error.asin}: ${error.message}${suffix}`);

    if (decision.shouldDeactivate) {
      const ok = await deactivatePersistentAsin(error.asin);
      if (ok) deactivated.push(error.asin);
    }
  }

  return { lines, deactivated };
}

/** Solo errores / pausas. Nunca “revisión OK”. */
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

  const amazonAlert = await filterAsinErrorsForAlert(errors);
  const flashAlert = await filterAsinErrorsForAlert(flashErrors);

  if (
    amazonAlert.lines.length === 0 &&
    flashAlert.lines.length === 0 &&
    flashFeedErrors.length === 0 &&
    amazonAlert.deactivated.length === 0 &&
    flashAlert.deactivated.length === 0
  ) {
    return;
  }

  await notifyCronAlert({
    job,
    headline: "Errores en revisión Amazon / flash",
    lines: [
      errors.length > 0
        ? `Precios: ${result.stats.processed} procesados · ${errors.length} errores`
        : "",
      ...amazonAlert.lines.slice(0, 4),
      flash && flashErrors.length > 0
        ? `Flash: ${flashErrors.length} errores`
        : "",
      ...flashAlert.lines.slice(0, 3).map((line) =>
        line.startsWith("• ") ? `• Flash ${line.slice(2)}` : line,
      ),
      ...flashFeedErrors
        .slice(0, 1)
        .map((e) => `• Feed: ${e.message}`),
      amazonAlert.deactivated.length > 0
        ? `Desactivados tras ${getPersistFailureThreshold()} fallos: ${amazonAlert.deactivated.join(", ")}`
        : "",
      flashAlert.deactivated.length > 0
        ? `Flash desactivados: ${flashAlert.deactivated.join(", ")}`
        : "",
    ],
  });
}

export async function reviewRetailPricesResult(
  result: RetailPriceCheckResult,
): Promise<void> {
  const job = jobId("check-prices");
  const errors = (result.stats.errors ?? []).filter(
    (error) => !isRetailBlockedError(error.message),
  );

  // Anti-bot esperado (DataDome): no spamear Telegram.
  if (errors.length === 0) return;

  const alert = await filterAsinErrorsForAlert(errors);
  if (alert.lines.length === 0 && alert.deactivated.length === 0) return;

  await notifyCronAlert({
    job,
    headline: "Errores en revisión retail",
    lines: [
      `Procesados: ${result.stats.processed} · Errores: ${errors.length}`,
      ...alert.lines.slice(0, 4),
      alert.deactivated.length > 0
        ? `Desactivados: ${alert.deactivated.join(", ")}`
        : "",
    ],
  });
}

export async function reviewFlashDealsResult(
  result: FlashDealsRunResult & {
    pause?: { activated: boolean; denials: number };
    miravia?: MiraviaDealsRunResult | null;
  },
): Promise<void> {
  const job = jobId("flash-deals");
  const errors = result.errors ?? [];
  const miravia = result.miravia;

  if (result.pause?.activated) {
    await notifyCronAlert({
      job,
      headline: "Flash: pausa preventiva",
      lines: [`Denegaciones: ${result.pause.denials}`],
    });
    return;
  }

  const feedErrors = result.discovery?.feedErrors ?? [];
  const miraviaErrors = miravia?.errors ?? [];
  const miraviaFeedErrors = miravia?.discovery?.feedErrors ?? [];

  const amazonAlert = await filterAsinErrorsForAlert(errors);

  if (
    amazonAlert.lines.length === 0 &&
    feedErrors.length === 0 &&
    miraviaErrors.length === 0 &&
    miraviaFeedErrors.length === 0 &&
    amazonAlert.deactivated.length === 0
  ) {
    return;
  }

  await notifyCronAlert({
    job,
    headline: "Errores en flash deals",
    lines: [
      amazonAlert.lines.length > 0
        ? `Errores producto: ${errors.length}`
        : "",
      ...amazonAlert.lines.slice(0, 3),
      feedErrors.length > 0 ? `Feeds fallidos: ${feedErrors.length}` : "",
      ...feedErrors.slice(0, 2).map((e) => `• Feed: ${e.message}`),
      miraviaErrors.length > 0
        ? `Miravia: ${miraviaErrors.length} errores`
        : "",
      ...miraviaErrors
        .slice(0, 2)
        .map((e) => `• Miravia ${e.externalId}: ${e.message}`),
      ...miraviaFeedErrors
        .slice(0, 2)
        .map((e) => `• Miravia feed: ${e.message}`),
      amazonAlert.deactivated.length > 0
        ? `Desactivados: ${amazonAlert.deactivated.join(", ")}`
        : "",
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
        "Kiabi está apagado en Ajustes (app_settings.kiabi_deals_enabled).",
        "Actívalo en Admin → Ajustes → Kiabi, o pon kiabi_deals_enabled=true en Supabase.",
        "KIABI_DEALS_ENABLED en .env.local solo aplica si la fila de BD no define el valor.",
      ],
    });
    return;
  }

  const errors = result.errors ?? [];
  const feedErrors = (result.discovery?.feedErrors ?? []).filter(
    (e) => !isRetailBlockedError(e.message),
  );

  // DataDome / sin novedades: silencio. Solo errores reales de ficha o feed.
  if (errors.length === 0 && feedErrors.length === 0) return;

  await notifyCronAlert({
    job,
    headline: "Errores en Kiabi",
    lines: [
      errors.length > 0 ? `Errores ficha: ${errors.length}` : "",
      ...errors
        .slice(0, 3)
        .map((e) => `• ${e.externalId}: ${e.message}`),
      ...feedErrors.slice(0, 2).map((e) => `• Feed: ${e.message}`),
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
