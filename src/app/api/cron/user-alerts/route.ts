import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { notifyCronFailure } from "@/services/cronNotify";
import { runUserUrlAlerts } from "@/services/userUrlAlerts";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron diario: comprueba precios de alertas de usuario con URL de Amazon.
 * Protegido con CRON_SECRET (Authorization: Bearer … o ?secret=).
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const result = await runUserUrlAlerts({
      limit: Number.isFinite(limit) && (limit as number) > 0 ? limit : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    if (!message.includes("No autorizado")) {
      await notifyCronFailure({ job: "user-alerts", error });
    }
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
