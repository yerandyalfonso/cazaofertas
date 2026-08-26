import { NextRequest, NextResponse } from "next/server";
import { generateAffiliateUrl } from "@/lib/affiliate";
import { formatEnvError } from "@/lib/env";
import { assertInternalAccess } from "@/lib/internal-auth";
import { roundMoney } from "@/lib/money";
import { createSupabaseServiceClient } from "@/lib/supabase";
import type { DealCandidate } from "@/services/alertMatching";
import { sendDealAlertMessage } from "@/services/telegram/bot";
import { DealLevel } from "@/types";

function capitalizeKeyword(keyword: string): string {
  return keyword
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildSimulatedDeal(keyword: string): DealCandidate {
  const previousPrice = 249.99;
  const currentPrice = roundMoney(previousPrice * 0.72);
  const discountPercentage = roundMoney(
    ((previousPrice - currentPrice) / previousPrice) * 100,
  );
  const asin = "B0TESTTRIGGER";
  const title = `${capitalizeKeyword(keyword)} Premium — Oferta de prueba CazaOferta`;

  return {
    productId: "test-trigger",
    asin,
    title,
    brand: "CazaOferta Demo",
    categoryId: null,
    categoryName: "Pruebas",
    currentPrice,
    previousPrice,
    discountPercentage,
    dealLevel: DealLevel.GREAT_DEAL,
    affiliateUrl: generateAffiliateUrl({ asin }),
    nearHistoricalLow: true,
  };
}

export async function GET(request: NextRequest) {
  try {
    assertInternalAccess(request);

    const client = createSupabaseServiceClient();
    const { data: alerts, error } = await client
      .from("alerts")
      .select("id, keyword, user_id, users(id, telegram_id, telegram_username)")
      .eq("is_active", true)
      .not("keyword", "is", null);

    if (error) {
      console.error("[test-trigger] Error al leer alertas", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { ok: false, error: `No se pudieron leer alertas: ${error.message}` },
        { status: 500 },
      );
    }

    const results: Array<{
      alertId: string;
      keyword: string;
      telegramId: number | null;
      status: "sent" | "skipped" | "failed";
      reason?: string;
      productTitle?: string;
      affiliateUrl?: string;
    }> = [];

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of alerts ?? []) {
      const keyword = row.keyword?.trim();
      if (!keyword) {
        skipped += 1;
        results.push({
          alertId: row.id,
          keyword: "",
          telegramId: null,
          status: "skipped",
          reason: "Sin keyword",
        });
        continue;
      }

      const user = Array.isArray(row.users) ? row.users[0] : row.users;
      const telegramId = user?.telegram_id ?? null;

      if (telegramId === null) {
        skipped += 1;
        results.push({
          alertId: row.id,
          keyword,
          telegramId: null,
          status: "skipped",
          reason: "Usuario sin telegram_id",
        });
        continue;
      }

      const deal = buildSimulatedDeal(keyword);

      try {
        await sendDealAlertMessage({
          chatId: telegramId,
          deal,
        });

        sent += 1;
        results.push({
          alertId: row.id,
          keyword,
          telegramId,
          status: "sent",
          productTitle: deal.title,
          affiliateUrl: deal.affiliateUrl,
        });
      } catch (sendError) {
        failed += 1;
        console.error("[test-trigger] Fallo al enviar a Telegram", {
          alertId: row.id,
          telegramId,
          keyword,
          error: sendError instanceof Error ? sendError.message : sendError,
        });
        results.push({
          alertId: row.id,
          keyword,
          telegramId,
          status: "failed",
          reason:
            sendError instanceof Error
              ? sendError.message
              : "Error desconocido al enviar",
          productTitle: deal.title,
          affiliateUrl: deal.affiliateUrl,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      message: "Prueba de disparo de ofertas ejecutada con éxito.",
      associateTag: process.env.AMAZON_ASSOCIATE_TAG || "cazaoferta-21",
      stats: {
        alertsFound: alerts?.length ?? 0,
        sent,
        skipped,
        failed,
      },
      results,
    });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
