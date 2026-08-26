import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { runFlashDealsCheck } from "@/services/flashDeals";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Proxy admin → cron discovery-first (insert novedades + update precio). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      feedUrls?: string[];
      injectedAsins?: string[];
      allowSimulatedFallback?: boolean;
      notify?: boolean;
    };

    const result = await runFlashDealsCheck({
      limit: body.limit ?? 20,
      feedUrls: body.feedUrls,
      injectedAsins: body.injectedAsins,
      allowSimulatedFallback: body.allowSimulatedFallback ?? true,
      includeCatalog: false,
      notify: body.notify ?? true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
