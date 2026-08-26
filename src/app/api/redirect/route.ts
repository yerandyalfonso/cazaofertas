import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  getExpectedAdminToken,
} from "@/lib/admin-auth";
import { generateAffiliateUrl } from "@/lib/affiliate";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/** Cookie de admin real (no trata AUTH_DISABLED como admin para no marcar todo el tráfico local). */
function hasAdminTrackingCookie(request: NextRequest): boolean {
  const expected = getExpectedAdminToken();
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(expected && cookie && cookie === expected);
}

/**
 * Tracking de clics de afiliado.
 * GET /api/redirect?product=<uuid>&source=web&article=<uuid>&test=true
 */
export async function GET(request: NextRequest) {
  const productId = request.nextUrl.searchParams.get("product")?.trim();
  const articleId = request.nextUrl.searchParams.get("article")?.trim() || null;
  const sourceRaw = request.nextUrl.searchParams.get("source")?.trim() || "web";
  const source = sourceRaw.slice(0, 64) || "web";
  const testParam = request.nextUrl.searchParams.get("test") === "true";
  const isAdmin = hasAdminTrackingCookie(request);
  const isTest = testParam || isAdmin;

  if (!productId) {
    return NextResponse.json(
      { ok: false, error: "Falta el parámetro product." },
      { status: 400 },
    );
  }

  try {
    const client = createSupabaseServiceClient();
    const { data: product, error } = await client
      .from("products")
      .select("id, asin, amazon_url, affiliate_url, is_active")
      .eq("id", productId)
      .maybeSingle();

    if (error) {
      console.error("[redirect] product lookup", error.message);
      return NextResponse.json(
        { ok: false, error: "No se pudo resolver el producto." },
        { status: 500 },
      );
    }

    if (!product || product.is_active === false) {
      return NextResponse.json(
        { ok: false, error: "Producto no encontrado." },
        { status: 404 },
      );
    }

    let resolvedArticleId: string | null = null;
    if (articleId) {
      const { data: article } = await client
        .from("articles")
        .select("id")
        .eq("id", articleId)
        .maybeSingle();
      resolvedArticleId = article?.id ?? null;
    }

    const clickRow = {
      product_id: product.id,
      article_id: resolvedArticleId,
      source: isTest
        ? source.startsWith("admin")
          ? source
          : `admin:${source}`
        : source,
      is_test: isTest,
    };

    const { error: insertError } = await client
      .from("affiliate_clicks")
      .insert(clickRow);

    if (insertError) {
      // Fallback si la migración 0009 aún no está aplicada (sin is_test/article_id).
      const needsFallback =
        /is_test|article_id/i.test(insertError.message) ||
        insertError.code === "42703";
      if (needsFallback) {
        const { error: fallbackError } = await client
          .from("affiliate_clicks")
          .insert({
            product_id: product.id,
            source: isTest ? `test:${source}` : source,
          });
        if (fallbackError) {
          console.error("[redirect] click insert fallback", fallbackError.message);
        }
      } else {
        console.error("[redirect] click insert", insertError.message);
      }
    }

    const destination = generateAffiliateUrl({
      amazon_url: product.amazon_url,
      affiliate_url: product.affiliate_url,
      asin: product.asin,
    });

    const response = NextResponse.redirect(destination, 302);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch (error) {
    console.error("[redirect]", error);
    return NextResponse.json(
      { ok: false, error: "Error al redirigir." },
      { status: 500 },
    );
  }
}
