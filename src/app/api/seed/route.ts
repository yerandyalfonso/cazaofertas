import { NextRequest, NextResponse } from "next/server";
import { formatEnvError } from "@/lib/env";
import { seedDatabase } from "@/lib/seed";
import { assertInternalAccess } from "@/lib/internal-auth";

export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);
    const result = await seedDatabase();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
