import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { notifyCronFailure } from "@/services/cronNotify";
import { runCouponDiscovery } from "@/services/coupon-discovery/runDiscovery";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron cupones: scrape Amazon/Kiabi/Miravia/Carrefour → tabla `coupons`.
 * Auth: Bearer CRON_SECRET (o ?secret=).
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);

    if (process.env.COUPON_DISCOVERY_ENABLED === "0") {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "COUPON_DISCOVERY_ENABLED=0",
      });
    }

    const result = await runCouponDiscovery({ writeBackupJson: false });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = formatEnvError(error);
    if (!message.includes("No autorizado")) {
      await notifyCronFailure({ job: "coupons-discover", error });
    }
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
