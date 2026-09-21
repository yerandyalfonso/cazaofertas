import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, getExpectedAdminToken } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
/** En memoria: suficiente para una sola instancia; se resetea al reiniciar. */
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const entry = failedAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    failedAttempts.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearFailures(ip: string): void {
  failedAttempts.delete(ip);
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
        },
        { status: 429 },
      );
    }

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
      recordFailure(ip);
      return NextResponse.json(
        { ok: false, error: "Contraseña incorrecta." },
        { status: 401 },
      );
    }

    clearFailures(ip);
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
