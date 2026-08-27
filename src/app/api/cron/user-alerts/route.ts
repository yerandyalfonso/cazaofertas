import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { assertCronAllowed } from "@/services/cronControl";
import { notifyCronFailure } from "@/services/cronNotify";
import { runUserUrlAlerts } from "@/services/userUrlAlerts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron de alertas por URL de usuario.
 * Lotes pequeños + respeta pausa preventiva Amazon.
 *
 * Query: ?limit=15&force=1
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);
    const force = request.nextUrl.searchParams.get("force") === "1";
    await assertCronAllowed({ force });

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 15;

    const result = await runUserUrlAlerts({
      limit: Number.isFinite(limit) && limit > 0 ? limit : 15,
      delayMs: 1_400,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    const paused = message.includes("Cron en pausa");
    if (!message.includes("No autorizado") && !paused) {
      await notifyCronFailure({ job: "user-alerts", error });
    }
    const status = message.includes("No autorizado")
      ? 401
      : paused
        ? 503
        : 500;
    return NextResponse.json(
      { ok: false, skipped: paused, error: message },
      { status },
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
