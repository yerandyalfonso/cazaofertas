import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { notifyCronFailure } from "@/services/cronNotify";
import { runFlashDealsCheck } from "@/services/flashDeals";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Cron discovery-first de Ofertas Flash.
 * 1. Lee Gold Box / Deals (o feeds/simulación)
 * 2. Compara ASINs con Supabase
 * 3. INSERT de productos nuevos; UPDATE de precio solo si ya existen
 *
 * Query: ?limit=&feeds=url1,url2&asins=B0...,B0...&simulate=0
 * Protegido con CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 25;
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

    const result = await runFlashDealsCheck({
      limit: Number.isFinite(limit) && limit > 0 ? limit : 25,
      feedUrls,
      injectedAsins,
      allowSimulatedFallback,
      includeCatalog: false,
      notify: request.nextUrl.searchParams.get("notify") !== "0",
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    if (!message.includes("No autorizado")) {
      await notifyCronFailure({ job: "flash-deals", error });
    }
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
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
    };

    const result = await runFlashDealsCheck({
      limit: body.limit,
      feedUrls: body.feedUrls,
      injectedAsins: body.injectedAsins,
      allowSimulatedFallback: body.allowSimulatedFallback ?? true,
      includeCatalog: false,
      notify: body.notify ?? true,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    if (!message.includes("No autorizado")) {
      await notifyCronFailure({ job: "flash-deals", error });
    }
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
