import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  getExpectedAdminToken,
} from "@/lib/admin-auth";
import { resolveProductBuyUrl } from "@/lib/retailers";
import { createSupabaseServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

/** Cookie de admin real (no trata AUTH_DISABLED como admin para no marcar todo el tráfico local). */
function hasAdminTrackingCookie(request: NextRequest): boolean {
  const expected = getExpectedAdminToken();
  const cookie = request.cookies.get(ADMIN_COOKIE)?.value;
  return Boolean(expected && cookie && cookie === expected);
}

/**
 * Rastreadores que abren los enlaces para generar vistas previas o indexar
 * (p. ej. facebookexternalhit, que llegó a registrar ~290 «clics»/min).
 * Se les redirige igual, pero no cuentan como clic.
 */
const BOT_USER_AGENT =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|meta-externalagent|whatsapp|telegrambot|twitterbot|linkedinbot|discordbot|skypeuripreview|embedly|preview|headless|python-requests|curl|wget|go-http-client|axios|node-fetch/i;

function isBotRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get("user-agent") ?? "";
  return !userAgent || BOT_USER_AGENT.test(userAgent);
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
      .select("id, asin, retailer, product_url, amazon_url, affiliate_url, is_active")
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

    const { error: insertError } = isBotRequest(request)
      ? { error: null }
      : await client.from("affiliate_clicks").insert(clickRow);

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

    const destination = resolveProductBuyUrl(product);

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
