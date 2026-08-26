import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { runAmazonPriceCheck } from "@/services/amazonPriceCheck";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron de comprobación de precios reales vía HTML de Amazon.
 * Protegido con CRON_SECRET (Authorization: Bearer … o ?secret=).
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    const result = await runAmazonPriceCheck({
      limit: Number.isFinite(limit) && (limit as number) > 0 ? limit : undefined,
      notify: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
