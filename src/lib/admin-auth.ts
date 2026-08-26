import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "cazaoferta_admin";

/**
 * Token esperado en la cookie httpOnly.
 * Producción: ADMIN_PASSWORD o CRON_SECRET (obligatorio).
 * Local: fallback de desarrollo si no hay env.
 */
export function getExpectedAdminToken(): string | null {
  const fromEnv =
    process.env.ADMIN_PASSWORD?.trim() || process.env.CRON_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return null;
  return "cazaoferta-local";
}

/** @deprecated Prefer getExpectedAdminToken — se mantiene por compatibilidad. */
export function getAdminPassword(): string {
  return getExpectedAdminToken() ?? "cazaoferta-local";
}

export function isAdminAuthDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.ADMIN_AUTH_DISABLED === "1" ||
    process.env.ADMIN_AUTH_DISABLED === "true"
  );
}

export function isValidAdminToken(value: string | undefined | null): boolean {
  if (isAdminAuthDisabled()) return true;
  const expected = getExpectedAdminToken();
  if (!expected || !value) return false;
  return value === expected;
}

export function hasValidAdminSession(request: NextRequest): boolean {
  if (isAdminAuthDisabled()) return true;
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  return isValidAdminToken(cookie) || isValidAdminToken(bearer);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (isAdminAuthDisabled()) return true;
  const expected = getExpectedAdminToken();
  if (!expected) return false;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return isValidAdminToken(token);
}

export function assertAdminRequest(request: NextRequest): void {
  if (hasValidAdminSession(request)) return;
  throw new Error("No autorizado.");
}

/** Respuesta 401 estándar para APIs admin. */
export function unauthorizedAdminResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "No autorizado." },
    { status: 401 },
  );
}

/**
 * Si la sesión no es válida, devuelve 401; si lo es, null.
 * Úsalo al inicio de handlers /api/admin/* (salvo login/logout).
 */
export function requireAdminApi(request: NextRequest): NextResponse | null {
  if (hasValidAdminSession(request)) return null;
  return unauthorizedAdminResponse();
}
