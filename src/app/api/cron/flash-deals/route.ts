import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import {
  assertCronAllowed,
  maybePauseAfterAmazonErrors,
} from "@/services/cronControl";
import { notifyCronFailure } from "@/services/cronNotify";
import { runFlashDealsCheck } from "@/services/flashDeals";
import { runMiraviaDealsCheck } from "@/services/miraviaDeals";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron discovery-first de Ofertas Flash (Amazon + Miravia misma pasada).
 * Respeta pausa preventiva ante denegaciones Amazon.
 *
 * Query: ?limit=&feeds=url1,url2&asins=B0...,B0...&simulate=0&force=1&miravia=1
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);
    const force = request.nextUrl.searchParams.get("force") === "1";
    await assertCronAllowed({ force });

    const limitParam = request.nextUrl.searchParams.get("limit");
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : NaN;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
    const feedParam = request.nextUrl.searchParams.get("feeds");
    const feedUrls = feedParam
      ? feedParam.split(",").map((url) => url.trim()).filter(Boolean)
      : undefined;
    const asinsParam = request.nextUrl.searchParams.get("asins");
    const injectedAsins = asinsParam
      ? asinsParam.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined;
    const allowSimulatedFallback =
      request.nextUrl.searchParams.get("simulate") !== "0";
    // Miravia va en cron propio; solo si ?miravia=1
    const runMiravia = request.nextUrl.searchParams.get("miravia") === "1";

    const result = await runFlashDealsCheck({
      limit,
      feedUrls,
      injectedAsins,
      allowSimulatedFallback,
      includeCatalog: false,
      notify: request.nextUrl.searchParams.get("notify") !== "0",
      delayMs: 1_300,
    });

    const miravia = runMiravia
      ? await runMiraviaDealsCheck({
          notify: request.nextUrl.searchParams.get("notify") !== "0",
        })
      : null;

    const processed =
      (result.inserted ?? 0) +
      (result.updated ?? 0) +
      (result.unchanged ?? 0) +
      (result.errors?.length ?? 0);

    const pause = await maybePauseAfterAmazonErrors(
      result.errors ?? [],
      processed,
    );

    return NextResponse.json({
      ...result,
      miravia,
      pause: {
        activated: pause.paused,
        denials: pause.denials,
        state: pause.state,
      },
    });
  } catch (error) {
    const message = formatEnvError(error);
    const paused = message.includes("Cron en pausa");
    if (!message.includes("No autorizado") && !paused) {
      await notifyCronFailure({ job: "flash-deals", error });
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
  try {
    assertInternalAccess(request);

    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      feedUrls?: string[];
      injectedAsins?: string[];
      allowSimulatedFallback?: boolean;
      notify?: boolean;
      force?: boolean;
      miravia?: boolean;
      telegramFlush?: boolean;
    };

    await assertCronAllowed({ force: body.force });

    const result = await runFlashDealsCheck({
      limit: body.limit && body.limit > 0 ? body.limit : undefined,
      feedUrls: body.feedUrls,
      injectedAsins: body.injectedAsins,
      allowSimulatedFallback: body.allowSimulatedFallback ?? true,
      includeCatalog: false,
      notify: body.notify ?? true,
      delayMs: 1_300,
    });

    const miravia =
      body.miravia === true
        ? await runMiraviaDealsCheck({
            notify: body.notify ?? true,
          })
        : null;

    const processed =
      (result.inserted ?? 0) +
      (result.updated ?? 0) +
      (result.unchanged ?? 0) +
      (result.errors?.length ?? 0);

    const pause = await maybePauseAfterAmazonErrors(
      result.errors ?? [],
      processed,
    );

    return NextResponse.json({
      ...result,
      miravia,
      pause: {
        activated: pause.paused,
        denials: pause.denials,
        state: pause.state,
      },
    });
  } catch (error) {
    const message = formatEnvError(error);
    const paused = message.includes("Cron en pausa");
    if (!message.includes("No autorizado") && !paused) {
      await notifyCronFailure({ job: "flash-deals", error });
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
