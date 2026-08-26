import { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "cazaoferta_admin";

export function getAdminPassword(): string {
  return (
    process.env.ADMIN_PASSWORD?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "cazaoferta-local"
  );
}

export function isAdminAuthDisabled(): boolean {
  return (
    process.env.ADMIN_AUTH_DISABLED === "1" ||
    process.env.ADMIN_AUTH_DISABLED === "true"
  );
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (isAdminAuthDisabled()) return true;
  if (process.env.NODE_ENV !== "production" && !process.env.ADMIN_PASSWORD) {
    // Desarrollo local sin ADMIN_PASSWORD: acceso directo.
    return true;
  }

  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  return Boolean(token && token === getAdminPassword());
}

export function assertAdminRequest(request: NextRequest): void {
  if (isAdminAuthDisabled()) return;

  if (process.env.NODE_ENV !== "production" && !process.env.ADMIN_PASSWORD) {
    return;
  }

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const password = getAdminPassword();

  if (cookie === password || bearer === password) {
    return;
  }

  throw new Error("No autorizado.");
}
