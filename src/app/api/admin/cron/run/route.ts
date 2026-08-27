import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { runAmazonPriceCheck } from "@/services/amazonPriceCheck";
import {
  getCronControlState,
  pauseCronJobs,
  resumeCronJobs,
} from "@/services/cronControl";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const client = createSupabaseServiceClient();

    const [{ data, error }, cronControl] = await Promise.all([
      client
        .from("products")
        .select("last_checked_at, is_active, amazon_url")
        .eq("is_active", true),
      getCronControlState().catch(() => null),
    ]);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    const checked = rows
      .map((row) => row.last_checked_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .reverse();
    const neverChecked = rows.filter((row) => !row.last_checked_at).length;
    const oldest = rows
      .map((row) => row.last_checked_at)
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    return NextResponse.json({
      ok: true,
      activeProducts: rows.length,
      withAmazonUrl: rows.filter((row) => Boolean(row.amazon_url)).length,
      lastCheckedAt: checked[0] ?? null,
      oldestCheckedAt: oldest ?? null,
      neverChecked,
      cronControl,
    });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as {
      action?: "run" | "pause" | "resume";
      limit?: number;
      notify?: boolean;
      asins?: string[];
      provider?: "html" | "keepa" | "creators" | "auto";
      force?: boolean;
      minutes?: number;
      reason?: string;
    };

    if (body.action === "pause") {
      const state = await pauseCronJobs({
        minutes: body.minutes,
        reason: body.reason?.trim() || "Pausa manual desde admin",
      });
      return NextResponse.json({ ok: true, cronControl: state });
    }

    if (body.action === "resume") {
      const state = await resumeCronJobs();
      return NextResponse.json({ ok: true, cronControl: state });
    }

    const result = await runAmazonPriceCheck({
      limit: body.limit ?? 10,
      notify: body.notify ?? false,
      asins: body.asins,
      provider: body.provider ?? "auto",
      delayMs: process.env.VERCEL ? 2_200 : 1_100,
      force: body.force ?? true,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = formatEnvError(error);
    console.error("[admin/cron/run]", message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
