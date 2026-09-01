import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import {
  DEFAULT_PRICE_CHECK_BATCH,
  runAmazonPriceCheck,
} from "@/services/amazonPriceCheck";
import { runRetailPriceCheck } from "@/services/retailPriceCheck";
import { notifyCronFailure } from "@/services/cronNotify";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron rotativo de precios: cada ejecución revisa un lote pequeño
 * (los más antiguos / nunca chequeados) para cubrir el catálogo al día
 * sin saturar Amazon. Respeta pausa preventiva ante denegaciones.
 * También revisa un lote retail (Miravia / Kiabi / Carrefour).
 *
 * Query: ?limit=10&force=1&retailLimit=4
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const parsed = limitParam ? Number.parseInt(limitParam, 10) : NaN;
    const limit =
      Number.isFinite(parsed) && parsed > 0
        ? parsed
        : DEFAULT_PRICE_CHECK_BATCH;
    const force = request.nextUrl.searchParams.get("force") === "1";
    const retailLimitParam = request.nextUrl.searchParams.get("retailLimit");
    const retailParsed = retailLimitParam
      ? Number.parseInt(retailLimitParam, 10)
      : NaN;
    const retailLimit =
      Number.isFinite(retailParsed) && retailParsed > 0 ? retailParsed : 4;

    const amazon = await runAmazonPriceCheck({
      limit,
      notify: true,
      force,
      delayMs: 1_100,
    });

    const retail = await runRetailPriceCheck({
      limit: retailLimit,
      delayMs: 1_800,
    });

    const { maybeFlushTelegramBatch } = await import("@/services/telegramFlush");
    const telegramFlush = await maybeFlushTelegramBatch();

    return NextResponse.json({ ...amazon, retail, telegramFlush });
  } catch (error) {
    const message = formatEnvError(error);
    const paused = message.includes("Cron en pausa");
    if (!message.includes("No autorizado") && !paused) {
      await notifyCronFailure({ job: "check-prices", error });
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
