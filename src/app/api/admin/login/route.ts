import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, getExpectedAdminToken } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";

export async function POST(request: NextRequest) {
  try {
    const expected = getExpectedAdminToken();
    if (!expected) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Admin no configurado: define ADMIN_PASSWORD (o CRON_SECRET) en el entorno.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      password?: string;
    };
    const password = body.password?.trim() ?? "";

    if (password !== expected) {
      return NextResponse.json(
        { ok: false, error: "Contraseña incorrecta." },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, password, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
