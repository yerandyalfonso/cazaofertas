import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { runFlashDealsCheck } from "@/services/flashDeals";
import { runMiraviaDealsCheck } from "@/services/miraviaDeals";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Proxy admin → descubridor flash (Amazon + Miravia). */
export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      feedUrls?: string[];
      injectedAsins?: string[];
      allowSimulatedFallback?: boolean;
      notify?: boolean;
      miravia?: boolean;
    };

    const result = await runFlashDealsCheck({
      limit: body.limit ?? 20,
      feedUrls: body.feedUrls,
      injectedAsins: body.injectedAsins,
      allowSimulatedFallback: body.allowSimulatedFallback ?? true,
      includeCatalog: false,
      notify: body.notify ?? true,
    });

    const miravia =
      body.miravia === false
        ? null
        : await runMiraviaDealsCheck({
            notify: body.notify ?? true,
          });

    return NextResponse.json({ ...result, miravia });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
