import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { runAmazonPriceCheck } from "@/services/amazonPriceCheck";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const client = createSupabaseServiceClient();

    const { data, error } = await client
      .from("products")
      .select("last_checked_at, is_active, amazon_url")
      .eq("is_active", true);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    const checked = rows
      .map((row) => row.last_checked_at)
      .filter((value): value is string => Boolean(value))
      .sort()
      .reverse();

    return NextResponse.json({
      ok: true,
      activeProducts: rows.length,
      withAmazonUrl: rows.filter((row) => Boolean(row.amazon_url)).length,
      lastCheckedAt: checked[0] ?? null,
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
      limit?: number;
      notify?: boolean;
      asins?: string[];
      provider?: "html" | "keepa" | "creators" | "auto";
    };

    const result = await runAmazonPriceCheck({
      limit: body.limit ?? 5,
      notify: body.notify ?? false,
      asins: body.asins,
      provider: body.provider ?? "html",
      delayMs: 700,
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
