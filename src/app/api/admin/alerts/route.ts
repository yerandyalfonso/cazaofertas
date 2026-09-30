import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import {
  listAdminAlertRuns,
  listAdminUserAlerts,
  setAdminAlertActive,
} from "@/services/adminUserAlerts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const [alerts, runs] = await Promise.all([listAdminUserAlerts(), listAdminAlertRuns()]);
    return NextResponse.json({ ok: true, alerts, runs });
  } catch (error) {
    return NextResponse.json({ ok: false, error: formatEnvError(error) }, { status: 500 });
  }
}

/** { id, isActive }: pausa o reactiva una alerta. */
export async function PATCH(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;

    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown;
      isActive?: unknown;
    };
    if (typeof body.id !== "string" || !body.id || typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { ok: false, error: "Faltan id (texto) e isActive (true/false)." },
        { status: 400 },
      );
    }
    await setAdminAlertActive(body.id, body.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: formatEnvError(error) }, { status: 500 });
  }
}
