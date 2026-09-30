import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { maybeFlushMetaBatch } from "@/services/metaPostQueue";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as {
      force?: boolean;
    };
    const result = await maybeFlushMetaBatch({ force: body.force ?? true });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
