/**
 * Cron local (Mac): scrape Amazon con IP residencial y escribe en Supabase.
 * Uso: npm run cron:local -- check-prices|flash-deals|user-alerts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

type LocalCronJob =
  | "check-prices"
  | "amazon-price-check"
  | "flash-deals"
  | "miravia-deals"
  | "user-alerts"
  | "user-alerts-residential"
  | "kiabi-deals"
  | "mediamarkt-deals"
  | "pccomponentes-deals"
  | "telegram-flush"
  | "coupons-discover"
  | "admin-digest"
  | "alert-load-report";

const JOBS: LocalCronJob[] = [
  "check-prices",
  "amazon-price-check",
  "flash-deals",
  "miravia-deals",
  "user-alerts",
  "user-alerts-residential",
  "kiabi-deals",
  "mediamarkt-deals",
  "pccomponentes-deals",
  "telegram-flush",
  "coupons-discover",
  "admin-digest",
  "alert-load-report",
];

function parseJob(raw: string | undefined): LocalCronJob {
  const job = (raw ?? "check-prices").trim().toLowerCase();
  if (JOBS.includes(job as LocalCronJob)) return job as LocalCronJob;
  throw new Error(
    `Job desconocido: "${raw}". Usa: ${JOBS.join(", ")}`,
  );
}

async function runCheckPrices(): Promise<void> {
  const { runAmazonPriceCheck } = await import("@/services/amazonPriceCheck");
  const { runRetailPriceCheck } = await import("@/services/retailPriceCheck");
  const { reviewCheckPricesResult, reviewRetailPricesResult } = await import(
    "./notify"
  );

  const amazon = await runAmazonPriceCheck({
    limit: Number(process.env.AMAZON_PRICE_CHECK_LIMIT ?? "2") || 2,
    notify: true,
    provider: "html",
    force: true,
    delayMs: 2_500,
  });
  console.log(JSON.stringify({ amazon }, null, 2));

  const retail = await runRetailPriceCheck({
    limit: Number(process.env.RETAIL_PRICE_CHECK_LIMIT ?? "4") || 4,
    delayMs: 1_800,
  });
  console.log(JSON.stringify({ retail }, null, 2));

  const { maybeFlushTelegramBatch } = await import("@/services/telegramFlush");
  const telegramFlush = await maybeFlushTelegramBatch();
  console.log(JSON.stringify({ telegramFlush }, null, 2));

  // Solo en una máquina (el VPS): Mac y VPS corren check-prices a la vez y
  // publicarían el mismo lote en Facebook/Instagram.
  if (process.env.CAZAOFERTAS_META_FLUSH === "1") {
    const { maybeFlushMetaBatch } = await import("@/services/metaPostQueue");
    const metaFlush = await maybeFlushMetaBatch();
    console.log(JSON.stringify({ metaFlush }, null, 2));
  }

  await reviewCheckPricesResult(amazon);
  await reviewRetailPricesResult(retail);
}

/**
 * Solo Amazon, sin retail ni flush de Telegram (eso ya lo hace el VPS).
 * Pensado para correr desde la Mac (IP residencial): mucho menos riesgo de
 * bloqueo que la IP del VPS, así que aquí sí respetamos la pausa preventiva
 * en vez de forzar (a mayor límite, más vale ser conservador si Amazon
 * empieza a denegar).
 */
async function runAmazonOnlyCheck(): Promise<void> {
  const { runAmazonPriceCheck } = await import("@/services/amazonPriceCheck");
  const { reviewCheckPricesResult } = await import("./notify");

  const amazon = await runAmazonPriceCheck({
    limit: Number(process.env.AMAZON_PRICE_CHECK_LIMIT_MAC ?? "10") || 10,
    notify: true,
    provider: "html",
    force: process.argv.includes("--force"),
    delayMs: 2_500,
  });
  console.log(JSON.stringify({ amazon }, null, 2));
  await reviewCheckPricesResult(amazon);
}

async function runFlashDeals(): Promise<void> {
  const { runFlashDealsCheck } = await import("@/services/flashDeals");
  const { maybePauseAfterAmazonErrors } = await import("@/services/cronControl");
  const { getAppSettings } = await import("@/services/appSettings");

  const appSettings = await getAppSettings();
  const includeMiravia =
    process.env.CAZAOFERTAS_FLASH_INCLUDE_MIRAVIA === "1" ||
    process.env.CAZAOFERTAS_FLASH_INCLUDE_MIRAVIA === "true";

  const result = await runFlashDealsCheck({
    limit: appSettings.amazonFlashInsertLimit,
    notify: true,
    allowSimulatedFallback: true,
    includeCatalog: false,
    delayMs: 2_500,
  });

  let miravia: Awaited<
    ReturnType<typeof import("@/services/miraviaDeals").runMiraviaDealsCheck>
  > | null = null;

  if (includeMiravia) {
    const { runMiraviaDealsCheck } = await import("@/services/miraviaDeals");
    miravia = await runMiraviaDealsCheck({
      limit: appSettings.miraviaFlashLimit,
      updateLimit: appSettings.miraviaFlashUpdateLimit,
      notify: true,
    });
  }

  const processed =
    (result.inserted ?? 0) +
    (result.updated ?? 0) +
    (result.unchanged ?? 0) +
    (result.errors?.length ?? 0);

  const pause = await maybePauseAfterAmazonErrors(
    result.errors ?? [],
    processed,
  );

  const payload = {
    ...result,
    ...(miravia ? { miravia } : {}),
    pause: {
      activated: pause.paused,
      denials: pause.denials,
      state: pause.state,
    },
  };
  console.log(JSON.stringify(payload, null, 2));

  const { reviewFlashDealsResult } = await import("./notify");
  await reviewFlashDealsResult(payload);
}

async function runMiraviaDeals(): Promise<void> {
  const { runMiraviaDealsCheck } = await import("@/services/miraviaDeals");
  const { getAppSettings } = await import("@/services/appSettings");
  const { reviewFlashDealsResult } = await import("./notify");

  const appSettings = await getAppSettings();
  const miravia = await runMiraviaDealsCheck({
    limit: appSettings.miraviaFlashLimit,
    updateLimit: appSettings.miraviaFlashUpdateLimit,
    notify: true,
  });

  console.log(JSON.stringify({ miravia }, null, 2));
  await reviewFlashDealsResult({
    ok: true,
    finishedAt: miravia.finishedAt,
    focus: "discovery-insert",
    discovery: {
      feedsFetched: miravia.discovery.feedsFetched,
      candidates: miravia.discovery.candidates,
      newAsins: 0,
      existingAsins: miravia.skippedExisting,
      usedSimulation: false,
      feedErrors: miravia.discovery.feedErrors,
    },
    catalogScanned: miravia.processed,
    flashDealsDetected: miravia.inserted + miravia.updated,
    inserted: miravia.inserted,
    updated: miravia.updated,
    unchanged: miravia.skippedExisting,
    newLows: 0,
    channelNotificationsSent: miravia.channelNotificationsSent,
    channelNotificationsSkipped: miravia.channelNotificationsSkipped,
    channelNotificationsQueued: miravia.channelNotificationsQueued,
    skippedCooldown: 0,
    skippedNoPrice: miravia.skippedNoDiscount,
    products: [],
    errors: miravia.errors.map((error) => ({
      asin: error.externalId,
      message: error.message,
    })),
    miravia,
  });
}

async function runUserAlerts(): Promise<void> {
  const { runUserUrlAlerts } = await import("@/services/userUrlAlerts");
  const { reviewUserAlertsResult } = await import("./notify");
  // Ritmo configurable por máquina. Por defecto, el del Mac (40 alertas, 40 s
  // entre cada una, cada 30 min). El VPS va algo más rápido (35 alertas, 30 s,
  // cada 20 min) con un drop-in de systemd: ver scripts/local-cron/schedules.md.
  const limit = Number(process.env.CAZAOFERTAS_USER_ALERTS_LIMIT) || 40;
  const delayMs = Number(process.env.CAZAOFERTAS_USER_ALERTS_DELAY_MS) || 40_000;
  const startedAt = new Date();
  const result = await runUserUrlAlerts({ limit, delayMs });
  const { recordUserAlertRun } = await import("@/services/alertLoadTest");
  await recordUserAlertRun(startedAt, result);
  console.log(JSON.stringify(result, null, 2));
  await reviewUserAlertsResult(result);
}

/**
 * Alertas de tiendas que solo pasan el bloqueo anti-bot desde IP residencial
 * (PcComponentes: Cloudflare Turnstile bloquea la IP del VPS aunque se use
 * navegador headless real; MediaMarkt da 403 a la IP del VPS). Corre solo
 * desde el Mac.
 */
async function runUserAlertsResidential(): Promise<void> {
  const { runUserUrlAlerts } = await import("@/services/userUrlAlerts");
  const { reviewUserAlertsResult } = await import("./notify");
  const result = await runUserUrlAlerts({
    limit: 10,
    delayMs: 3_000,
    retailers: ["pccomponentes", "carrefour", "mediamarkt"],
  });
  console.log(JSON.stringify(result, null, 2));
  await reviewUserAlertsResult(result);

  // Productos Carrefour creados por alertas: su foto (static.carrefour.es) da
  // 403 a Telegram; se sube a Storage antes de que haya un aviso de bajada.
  const { backfillCarrefourProductImages } = await import("@/services/carrefourDeals");
  try {
    console.log("carrefour images", await backfillCarrefourProductImages());
  } catch (error) {
    console.warn("[user-alerts-residential] fotos Carrefour:", error);
  }
}

/**
 * Rebajas MediaMarkt desde los listados de categoría. Solo Mac: a la IP del
 * VPS MediaMarkt le da 403. `MEDIAMARKT_DEALS_DRY_RUN=1` no escribe nada;
 * `MEDIAMARKT_DEALS_NOTIFY=1` avisa al canal y a las alertas de usuario.
 */
async function runMediaMarktDeals(): Promise<void> {
  const { runMediaMarktDealsCheck } = await import("@/services/mediamarktDeals");
  const result = await runMediaMarktDealsCheck({
    limit: Number(process.env.MEDIAMARKT_DEALS_LIMIT) || 20,
    dryRun: process.env.MEDIAMARKT_DEALS_DRY_RUN === "1",
    // Avisos al canal y a las alertas: se activan con MEDIAMARKT_DEALS_NOTIFY=1.
    notify: process.env.MEDIAMARKT_DEALS_NOTIFY === "1",
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.discovery.pagesFetched === 0 && result.discovery.feedErrors.length > 0) {
    throw new Error(
      `MediaMarkt: ningún listado cargó (${result.discovery.feedErrors[0]!.message})`,
    );
  }
}

/**
 * Rebajas PcComponentes (PVPR tachado) desde los listados de categoría. Solo
 * Mac: Cloudflare exige Google Chrome con ventana e IP residencial.
 * `PCCOMPONENTES_DEALS_DRY_RUN=1` no escribe nada; `PCCOMPONENTES_DEALS_NOTIFY=1`
 * avisa al canal y a las alertas de usuario.
 */
async function runPcComponentesDeals(): Promise<void> {
  const { runPcComponentesDealsCheck } = await import("@/services/pccomponentesDeals");
  const result = await runPcComponentesDealsCheck({
    limit: Number(process.env.PCCOMPONENTES_DEALS_LIMIT) || 20,
    dryRun: process.env.PCCOMPONENTES_DEALS_DRY_RUN === "1",
    notify: process.env.PCCOMPONENTES_DEALS_NOTIFY === "1",
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.discovery.pagesFetched === 0 && result.discovery.feedErrors.length > 0) {
    throw new Error(
      `PcComponentes: ningún listado cargó (${result.discovery.feedErrors[0]!.message})`,
    );
  }
}

async function runKiabiDeals(): Promise<void> {
  const { runKiabiDealsCheck } = await import("@/services/kiabiDeals");
  const { reviewKiabiDealsResult } = await import("./notify");
  const result = await runKiabiDealsCheck({
    limit: 6,
    notify: true,
    delayMs: 2_000,
  });
  console.log(JSON.stringify(result, null, 2));
  await reviewKiabiDealsResult(result);
}

async function runTelegramFlush(): Promise<void> {
  const { flushPendingChannelNotifications } = await import(
    "@/services/telegramFlush"
  );
  const force = process.argv.includes("--force");
  const result = await flushPendingChannelNotifications({ force });
  console.log(JSON.stringify(result, null, 2));
}

async function runCouponsDiscover(): Promise<void> {
  const { runCouponDiscovery } = await import(
    "@/services/coupon-discovery/runDiscovery"
  );
  const result = await runCouponDiscovery({ writeBackupJson: true });
  console.log(JSON.stringify(result, null, 2));
}

async function runAdminDigest(): Promise<void> {
  const { buildAdminDigestReport, formatAdminDigestMessage, sendAdminDigest } =
    await import("@/services/adminDigest");
  const report = await buildAdminDigestReport();
  console.log(formatAdminDigestMessage(report));
  await sendAdminDigest();
}

/** Estadísticas del test de carga de alertas al chat del admin (si hay test). */
async function runAlertLoadReport(): Promise<void> {
  const { sendAlertLoadReport } = await import("@/services/alertLoadTest");
  const text = await sendAlertLoadReport(2);
  console.log(text ?? "Sin usuarios de prueba: no se envía informe.");
}

async function main(): Promise<void> {
  const job = parseJob(process.argv[2]);
  const started = new Date().toISOString();
  console.log(`[local-cron] ${job} started ${started}`);

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en .env.local (necesario para escribir precios).",
    );
  }

  switch (job) {
    case "check-prices":
      await runCheckPrices();
      break;
    case "amazon-price-check":
      await runAmazonOnlyCheck();
      break;
    case "flash-deals":
      await runFlashDeals();
      break;
    case "miravia-deals":
      await runMiraviaDeals();
      break;
    case "user-alerts":
      await runUserAlerts();
      break;
    case "user-alerts-residential":
      await runUserAlertsResidential();
      break;
    case "kiabi-deals":
      await runKiabiDeals();
      break;
    case "mediamarkt-deals":
      await runMediaMarktDeals();
      break;
    case "pccomponentes-deals":
      await runPcComponentesDeals();
      break;
    case "telegram-flush":
      await runTelegramFlush();
      break;
    case "coupons-discover":
      await runCouponsDiscover();
      break;
    case "alert-load-report":
      await runAlertLoadReport();
      break;
    case "admin-digest":
      await runAdminDigest();
      break;
  }

  console.log(`[local-cron] ${job} finished ${new Date().toISOString()}`);
}

main().catch(async (error) => {
  const job = process.argv[2] ?? "unknown";
  console.error(
    "[local-cron] error:",
    error instanceof Error ? error.message : error,
  );
  try {
    const { notifyLocalCronFailure } = await import("./notify");
    await notifyLocalCronFailure(job, error);
  } catch (notifyError) {
    console.error("[local-cron] No se pudo avisar por Telegram:", notifyError);
  }
  process.exit(1);
});
