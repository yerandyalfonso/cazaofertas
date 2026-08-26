import { NextRequest } from "next/server";

export function assertInternalAccess(request: NextRequest): void {
  const secret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== "production" && !secret) {
    return;
  }

  if (!secret) {
    throw new Error("No autorizado: falta CRON_SECRET.");
  }

  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (bearer !== secret && querySecret !== secret) {
    throw new Error("No autorizado.");
  }
}
