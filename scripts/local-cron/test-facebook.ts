/**
 * Verifica y publica prueba en Facebook + Instagram (plantilla YIR).
 * Uso:
 *   npm run cron:local:test-facebook
 *   npm run cron:local:test-facebook -- --post
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  const { verifyFacebookPageCredentials, postDealToFacebookPage } = await import(
    "@/services/facebook"
  );
  const { postDealToInstagram, resolveInstagramBusinessAccountId } = await import(
    "@/services/instagram"
  );
  const shouldPost = process.argv.includes("--post");

  console.log("[test-social] Comprobando Facebook PAGE_ID + token…");
  const check = await verifyFacebookPageCredentials();
  if (!check.ok) {
    throw new Error(check.error ?? "No se pudo verificar Facebook.");
  }
  console.log(
    `[test-social] Facebook OK — ${check.pageName ?? "Página"} (${check.pageId})`,
  );

  console.log("[test-social] Comprobando Instagram Business…");
  const ig = await resolveInstagramBusinessAccountId();
  if (ig.ok) {
    console.log(
      `[test-social] Instagram OK — @${ig.username ?? "?"} (${ig.igUserId})`,
    );
  } else {
    console.warn("[test-social] Instagram:", ig.error);
  }

  if (!shouldPost) {
    console.log(
      "[test-social] Sin publicar. Pasa --post para enviar prueba a Facebook + Instagram.",
    );
    return;
  }

  const { DealLevel } = await import("@/types");
  const deal = {
    productId: "00000000-0000-0000-0000-000000000000",
    asin: "TESTSOCIAL",
    title: "Prueba CazaOferta — IG 1080×1350 (ignorar)",
    brand: "CazaOferta",
    categoryId: null,
    categoryName: "Tecnología",
    categorySlug: "tecnologia",
    parentCategorySlug: "tecnologia",
    parentCategoryName: "Tecnología",
    currentPrice: 21.17,
    previousPrice: 59.99,
    discountPercentage: 65,
    dealLevel: DealLevel.GOOD_DEAL,
    affiliateUrl: "https://cazaoferta.es",
    nearHistoricalLow: false,
    score: 82,
    detectedAt: new Date().toISOString(),
    // Auriculares verticales → contain debe respetar altura completa.
    imageUrl:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
  };

  console.log("[test-social] Publicando en Facebook (tema blue / tecnología)…");
  const fb = await postDealToFacebookPage(deal);
  if (!fb.ok) {
    throw new Error(fb.error ?? fb.reason ?? "Facebook falló.");
  }
  console.log("[test-social] Facebook OK.", fb.postId ?? "");

  console.log("[test-social] Publicando en Instagram…");
  const insta = await postDealToInstagram(deal);
  if (insta.skipped) {
    console.warn("[test-social] Instagram omitido:", insta.reason);
  } else if (!insta.ok) {
    throw new Error(insta.error ?? "Instagram falló.");
  } else {
    console.log("[test-social] Instagram OK.", insta.mediaId ?? "");
  }

  console.log("[test-social] Listo. Revisa la Página y @chollosdhoy.");
}

main().catch((error) => {
  console.error(
    "[test-social] error:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
