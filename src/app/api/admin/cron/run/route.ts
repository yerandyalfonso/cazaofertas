import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError, isFacebookPageConfigured } from "@/lib/env";
import { runAmazonPriceCheck } from "@/services/amazonPriceCheck";
import { getAdminCatalogStats } from "@/services/adminDashboard";
import { getAppSettings } from "@/services/appSettings";
import {
  getCronControlState,
  pauseCronJobs,
  resumeCronJobs,
} from "@/services/cronControl";
import {
  getChannelNotificationQueueStats,
  getTelegramBatchSchedule,
} from "@/services/telegramFlush";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const [catalog, cronControl, appSettings, telegramQueue, telegramBatch] =
      await Promise.all([
        getAdminCatalogStats(),
        getCronControlState().catch(() => null),
        getAppSettings().catch(() => null),
        getChannelNotificationQueueStats(),
        getTelegramBatchSchedule(),
      ]);

    return NextResponse.json({
      ok: true,
      activeProducts: catalog.activeProducts,
      withAmazonUrl: catalog.amazonMonitorable,
      retailMonitorable: catalog.retailMonitorable,
      lastCheckedAt: catalog.lastCheckedAt,
      oldestCheckedAt: catalog.oldestCheckedAt,
      neverChecked: catalog.neverChecked,
      byRetailer: catalog.byRetailer,
      cronControl,
      settings: appSettings,
      pendingTelegram: telegramQueue.pending,
      failedTelegram: telegramQueue.failed,
      queuedTelegram: telegramQueue.queued,
      telegramBatchDue: telegramBatch.batchDue,
      telegramNextFlushAt: telegramBatch.nextFlushAt,
      facebookConfigured: isFacebookPageConfigured(),
    });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as {
      action?: "run" | "pause" | "resume";
      limit?: number;
      notify?: boolean;
      asins?: string[];
      provider?: "html" | "keepa" | "creators" | "auto";
      force?: boolean;
      minutes?: number;
      reason?: string;
    };

    if (body.action === "pause") {
      const state = await pauseCronJobs({
        minutes: body.minutes,
        reason: body.reason?.trim() || "Pausa manual desde admin",
      });
      return NextResponse.json({ ok: true, cronControl: state });
    }

    if (body.action === "resume") {
      const state = await resumeCronJobs();
      return NextResponse.json({ ok: true, cronControl: state });
    }

    const result = await runAmazonPriceCheck({
      limit: body.limit ?? 10,
      notify: body.notify ?? false,
      asins: body.asins,
      provider: body.provider ?? "auto",
      delayMs: process.env.VERCEL ? 2_200 : 1_100,
      force: body.force ?? true,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    console.error("[admin/cron/run]", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
