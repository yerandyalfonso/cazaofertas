/**
 * Envía un chollo de prueba (formato actual: fecha DD/MM/YYYY, #slug, score ≤100).
 * Uso: npx tsx --env-file=.env.local scripts/local-cron/test-deal-format.ts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main(): Promise<void> {
  const {
    sendDealAlertMessage,
    sendChannelDealAlert,
  } = await import("@/services/telegram/bot");
  const { getTelegramChannelId, getTelegramPublicChannelId } = await import(
    "@/lib/env"
  );
  const { DealLevel } = await import("@/types");

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    throw new Error("Falta TELEGRAM_BOT_TOKEN en .env.local");
  }

  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!admin) {
    throw new Error("Falta TELEGRAM_ADMIN_CHAT_ID en .env.local");
  }

  const deal = {
    productId: "00000000-0000-4000-8000-000000000099",
    asin: "B0TESTFORMAT",
    title: "[PRUEBA] Crema facial hidratante — ignora este mensaje",
    brand: "CazaOferta",
    categoryId: null,
    categoryName: "Belleza y cuidado personal",
    categorySlug: "belleza",
    retailer: "amazon",
    currentPrice: 12.99,
    previousPrice: 24.99,
    discountPercentage: 48,
    dealLevel: DealLevel.GREAT_DEAL,
    score: 100,
    dealLabel: "Gran oferta",
    productSlug: null,
    imageUrl: null as string | null,
    summary: "Mensaje de prueba de formato",
    affiliateUrl: "https://www.amazon.es",
    nearHistoricalLow: false,
    detectedAt: new Date().toISOString(),
  };

  console.log("[test-deal] Enviando al admin…");
  await sendDealAlertMessage({
    chatId: admin,
    deal,
    linkMode: "links",
  });
  console.log("[test-deal] Admin OK");

  console.log(
    "[test-deal] Grupo:",
    getTelegramChannelId(),
    "Canal:",
    getTelegramPublicChannelId(),
  );

  try {
    await sendChannelDealAlert(deal);
    console.log("[test-deal] Grupo/canal OK");
  } catch (error) {
    console.error(
      "[test-deal] Grupo/canal falló:",
      error instanceof Error ? error.message : error,
    );
  }

  console.log("[test-deal] Listo — revisa Telegram (admin + grupo/canal).");
}

main().catch((error) => {
  console.error(
    "[test-deal] error:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
