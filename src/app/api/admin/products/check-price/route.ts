import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { runAmazonPriceCheck } from "@/services/amazonPriceCheck";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      asin?: string;
      asins?: string[];
      notify?: boolean;
    };

    const asins = [
      ...(body.asin ? [body.asin] : []),
      ...(body.asins ?? []),
    ]
      .map((asin) => asin.trim().toUpperCase())
      .filter(Boolean);

    if (asins.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Indica al menos un ASIN." },
        { status: 400 },
      );
    }

    const result = await runAmazonPriceCheck({
      asins,
      notify: body.notify ?? false,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
