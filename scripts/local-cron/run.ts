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
  | "flash-deals"
  | "user-alerts"
  | "kiabi-deals"
  | "telegram-flush"
  | "coupons-discover";

const JOBS: LocalCronJob[] = [
  "check-prices",
  "flash-deals",
  "user-alerts",
  "kiabi-deals",
  "telegram-flush",
  "coupons-discover",
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
    limit: 2,
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

  await reviewCheckPricesResult(amazon);
  await reviewRetailPricesResult(retail);
}

async function runFlashDeals(): Promise<void> {
  const { runFlashDealsCheck } = await import("@/services/flashDeals");
  const { runMiraviaDealsCheck } = await import("@/services/miraviaDeals");
  const { maybePauseAfterAmazonErrors } = await import("@/services/cronControl");
  const { getAppSettings } = await import("@/services/appSettings");

  const appSettings = await getAppSettings();

  const result = await runFlashDealsCheck({
    limit: appSettings.amazonFlashInsertLimit,
    notify: true,
    allowSimulatedFallback: true,
    includeCatalog: false,
    delayMs: 2_500,
  });

  const miravia = await runMiraviaDealsCheck({
    limit: appSettings.miraviaFlashLimit,
    updateLimit: appSettings.miraviaFlashUpdateLimit,
    notify: true,
  });

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
    miravia,
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

async function runUserAlerts(): Promise<void> {
  const { runUserUrlAlerts } = await import("@/services/userUrlAlerts");
  const { reviewUserAlertsResult } = await import("./notify");
  const result = await runUserUrlAlerts({
    limit: 40,
    delayMs: 60_000,
  });
  console.log(JSON.stringify(result, null, 2));
  await reviewUserAlertsResult(result);
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
    case "flash-deals":
      await runFlashDeals();
      break;
    case "user-alerts":
      await runUserAlerts();
      break;
    case "kiabi-deals":
      await runKiabiDeals();
      break;
    case "telegram-flush":
      await runTelegramFlush();
      break;
    case "coupons-discover":
      await runCouponsDiscover();
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
