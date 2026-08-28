import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { runKiabiDealsCheck } from "@/services/kiabiDeals";
import { notifyCronFailure } from "@/services/cronNotify";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron Kiabi: descubre rebajas en listados y sincroniza catálogo + Telegram.
 * Query: ?limit=8
 * Requiere KIABI_DEALS_ENABLED=1
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const parsed = limitParam ? Number.parseInt(limitParam, 10) : NaN;
    const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 8;

    const result = await runKiabiDealsCheck({
      limit,
      notify: true,
      delayMs: 1_800,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    if (!message.includes("No autorizado")) {
      await notifyCronFailure({ job: "kiabi-deals", error });
    }
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
