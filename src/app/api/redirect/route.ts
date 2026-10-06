import { NextRequest, NextResponse } from "next/server";
import { handleAffiliateRedirect } from "@/lib/affiliate-redirect";

export const runtime = "nodejs";

/**
 * Tracking de clics de afiliado (formato antiguo; los enlaces nuevos usan /ir/<código>).
 * GET /api/redirect?product=<uuid>&source=web&article=<uuid>&test=true
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const productId = params.get("product")?.trim();
  if (!productId) {
    return NextResponse.json(
      { ok: false, error: "Falta el parámetro product." },
      { status: 400 },
    );
  }
  return handleAffiliateRedirect(request, {
    lookup: { column: "id", value: productId },
    source: (params.get("source")?.trim() || "web").slice(0, 64) || "web",
    articleId: params.get("article")?.trim() || null,
    testParam: params.get("test") === "true",
  });
}
