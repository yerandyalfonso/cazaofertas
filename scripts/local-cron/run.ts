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
  | "kiabi-deals";

const JOBS: LocalCronJob[] = [
  "check-prices",
  "flash-deals",
  "user-alerts",
  "kiabi-deals",
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
  const { reviewCheckPricesResult } = await import("./notify");
  const result = await runAmazonPriceCheck({
    limit: 2,
    notify: true,
    provider: "html",
    force: true,
    delayMs: 2_500,
  });
  console.log(JSON.stringify(result, null, 2));
  await reviewCheckPricesResult(result);
}

async function runFlashDeals(): Promise<void> {
  const { runFlashDealsCheck } = await import("@/services/flashDeals");
  const { maybePauseAfterAmazonErrors } = await import("@/services/cronControl");

  const result = await runFlashDealsCheck({
    limit: 3,
    notify: true,
    allowSimulatedFallback: true,
    includeCatalog: false,
    delayMs: 300_000,
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
