import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { notifyCronFailure } from "@/services/cronNotify";
import { flushPendingChannelNotifications } from "@/services/telegramFlush";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Publica el lote pendiente de Telegram si ha pasado el intervalo de admin.
 * ?force=1 ignora el intervalo.
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);
    const force = request.nextUrl.searchParams.get("force") === "1";
    const result = await flushPendingChannelNotifications({ force });
    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    if (!message.includes("No autorizado")) {
      await notifyCronFailure({ job: "telegram-flush", error });
    }
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
