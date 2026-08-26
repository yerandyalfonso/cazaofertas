import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { runPriceDetection } from "@/services/priceDetection";
import type { MockPriceMode } from "@/providers/price";

function parseMode(value: string | null): MockPriceMode {
  if (value === "drop" || value === "stable" || value === "random") {
    return value;
  }
  return "random";
}

export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);
    const mode = parseMode(request.nextUrl.searchParams.get("mode"));
    const stats = await runPriceDetection({ mode, source: "mock" });
    return NextResponse.json({ ok: true, mode, stats });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
