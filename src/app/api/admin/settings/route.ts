import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { getAppSettings, updateAppSettings } from "@/services/appSettings";

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
      telegramBatchHours?: number | string;
    };

    const patch: {
      telegramMinScore?: number;
      telegramBatchHours?: number;
    } = {};

    if (body.telegramMinScore !== undefined && body.telegramMinScore !== "") {
      const parsed = Number(body.telegramMinScore);
      if (!Number.isFinite(parsed)) {
        return NextResponse.json(
          { ok: false, error: "telegramMinScore no es un número válido." },
          { status: 400 },
        );
      }
      patch.telegramMinScore = parsed;
    }

    if (
      body.telegramBatchHours !== undefined &&
      body.telegramBatchHours !== ""
    ) {
      const parsed = Number(body.telegramBatchHours);
      if (!Number.isFinite(parsed)) {
        return NextResponse.json(
          { ok: false, error: "telegramBatchHours no es un número válido." },
          { status: 400 },
        );
      }
      patch.telegramBatchHours = parsed;
    }

    if (patch.telegramMinScore === undefined && patch.telegramBatchHours === undefined) {
      return NextResponse.json(
        { ok: false, error: "Indica telegramMinScore o telegramBatchHours." },
        { status: 400 },
      );
    }

    const settings = await updateAppSettings(patch);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
