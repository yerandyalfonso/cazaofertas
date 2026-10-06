import { NextRequest, NextResponse } from "next/server";
import { expandAffiliateSource } from "@/lib/affiliate-tracking";
import { handleAffiliateRedirect } from "@/lib/affiliate-redirect";

export const runtime = "nodejs";

/**
 * Enlace corto de afiliado: /ir/<ASIN o código de tienda>?s=tg
 * Mismo tracking que /api/redirect, pero legible en Telegram y Facebook.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = decodeURIComponent((await params).code).trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,64}$/.test(code)) {
    return NextResponse.json(
      { ok: false, error: "Código de producto no válido." },
      { status: 400 },
    );
  }
  const search = request.nextUrl.searchParams;
  return handleAffiliateRedirect(request, {
    lookup: { column: "asin", value: code },
    source: expandAffiliateSource(search.get("s")),
    articleId: null,
    testParam: search.get("t") === "1",
  });
}
