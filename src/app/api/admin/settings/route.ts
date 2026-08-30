import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import {
  getAppSettings,
  updateTelegramMinScore,
} from "@/services/appSettings";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const settings = await getAppSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const body = (await request.json().catch(() => ({}))) as {
      telegramMinScore?: number | string;
    };

    if (body.telegramMinScore === undefined || body.telegramMinScore === "") {
      return NextResponse.json(
        { ok: false, error: "Indica telegramMinScore (0–100)." },
        { status: 400 },
      );
    }

    const parsed = Number(body.telegramMinScore);
    if (!Number.isFinite(parsed)) {
      return NextResponse.json(
        { ok: false, error: "telegramMinScore no es un número válido." },
        { status: 400 },
      );
    }

    const settings = await updateTelegramMinScore(parsed);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
