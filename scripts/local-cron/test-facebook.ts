/**
 * Verifica (o publica una prueba) en la Página de Facebook.
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
  const shouldPost = process.argv.includes("--post");

  console.log("[test-facebook] Comprobando PAGE_ID + token…");
  const check = await verifyFacebookPageCredentials();
  if (!check.ok) {
    throw new Error(check.error ?? "No se pudo verificar Facebook.");
  }
  console.log(
    `[test-facebook] OK — ${check.pageName ?? "Página"} (${check.pageId})`,
  );

  if (!shouldPost) {
    console.log(
      "[test-facebook] Sin publicar. Pasa --post para enviar un mensaje de prueba a la Página.",
    );
    return;
  }

  const { DealLevel } = await import("@/types");
  const result = await postDealToFacebookPage({
    productId: "00000000-0000-0000-0000-000000000000",
    asin: "TESTFACEBOOK",
    title: "Prueba CazaOferta — ignora este post (Facebook Graph API)",
    brand: "CazaOferta",
    categoryId: null,
    categoryName: "Tecnología",
    categorySlug: "tecnologia",
    currentPrice: 9.99,
    previousPrice: 19.99,
    discountPercentage: 50,
    dealLevel: DealLevel.GOOD_DEAL,
    affiliateUrl: "https://cazaoferta.es",
    nearHistoricalLow: false,
    score: 80,
    detectedAt: new Date().toISOString(),
  });

  if (!result.ok) {
    throw new Error(result.error ?? result.reason ?? "Publicación de prueba fallida.");
  }
  console.log("[test-facebook] Publicado.", result.postId ?? "");
}

main().catch((error) => {
  console.error(
    "[test-facebook] error:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
