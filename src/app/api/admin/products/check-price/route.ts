import { NextRequest, NextResponse } from "next/server";
import { resolveAmazonProductCategoryId } from "@/lib/categories";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { roundMoney, toNumber } from "@/lib/money";
import { buildOutOfStockUpdate, inStockAvailabilityPatch } from "@/lib/out-of-stock-policy";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { previewAmazonProductPage } from "@/providers/price";
import { runAmazonPriceCheck } from "@/services/amazonPriceCheck";
import { ProductAvailability } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Admin «Revisar»: scrape HTML directo de la ficha Amazon ES y escribe precio/lista.
 * Así el toast muestra exactamente lo leído (y no un proveedor desfasado).
 */
async function syncAsinsFromHtml(asins: string[]) {
  const client = createSupabaseServiceClient();
  const quotes: Array<{
    asin: string;
    price: number | null;
    listPrice: number | null;
    discountPercentage: number | null;
    isFlashDeal: boolean;
    title?: string;
    updated: boolean;
    unavailable?: boolean;
  }> = [];
  const errors: Array<{ asin: string; message: string }> = [];

  for (const asin of asins) {
    try {
      const { data: product, error: lookupError } = await client
        .from("products")
        .select(
          "id, asin, title, brand, category_id, current_price, previous_price, lowest_price, highest_price, amazon_url, availability, out_of_stock_at, is_active",
        )
        .eq("asin", asin)
        .eq("is_active", true)
        .maybeSingle();

      if (lookupError) throw new Error(lookupError.message);
      if (!product) {
        errors.push({ asin, message: "Producto no encontrado en el catálogo." });
        continue;
      }

      const preview = await previewAmazonProductPage(
        product.amazon_url || asin,
        { timeoutMs: 18_000 },
      );

      if (preview.price === null) {
        if (preview.availability === ProductAvailability.OUT_OF_STOCK) {
          const now = new Date().toISOString();
          const oosPatch = buildOutOfStockUpdate(product, now, {
            ...(preview.title ? { title: preview.title } : {}),
            ...(preview.imageUrl ? { image_url: preview.imageUrl } : {}),
            ...(preview.brand ? { brand: preview.brand } : {}),
            ...(preview.description ? { description: preview.description } : {}),
          });
          const { error: updateError } = await client
            .from("products")
            .update(oosPatch)
            .eq("id", product.id);

          if (updateError) throw new Error(updateError.message);

          quotes.push({
            asin,
            price: null,
            listPrice: null,
            discountPercentage: null,
            isFlashDeal: false,
            title: preview.title,
            updated: false,
            unavailable: true,
          });
          continue;
        }

        errors.push({
          asin,
          message:
            "No se pudo leer el precio del buy box de Amazon (posible bloqueo anti-bot). Reintenta en unos segundos.",
        });
        continue;
      }

      const nextPrice = roundMoney(preview.price);
      const listPrice =
        preview.listPrice != null && preview.listPrice > nextPrice
          ? roundMoney(preview.listPrice)
          : null;
      const discount =
        preview.discountPercentage != null && preview.discountPercentage > 0
          ? roundMoney(preview.discountPercentage)
          : listPrice != null
            ? roundMoney(((listPrice - nextPrice) / listPrice) * 100)
            : null;

      const storedCurrent = toNumber(product.current_price);
      const storedPrevious = toNumber(product.previous_price);
      const previousLowest = toNumber(product.lowest_price);
      const previousHighest = toNumber(product.highest_price);
      const reference = listPrice ?? (storedPrevious != null && storedPrevious > nextPrice
        ? storedPrevious
        : null);
      const changed = storedCurrent === null || storedCurrent !== nextPrice;
      const now = new Date().toISOString();
      const categoryId =
        product.category_id ??
        (await resolveAmazonProductCategoryId(client, {
          categorySlug: preview.categorySlug,
          breadcrumbs: preview.breadcrumbs,
          title: preview.title ?? product.title,
          brand: preview.brand ?? product.brand,
        }));

      const { error: updateError } = await client
        .from("products")
        .update({
          current_price: nextPrice,
          previous_price: reference ?? storedPrevious ?? nextPrice,
          discount_percentage: discount,
          lowest_price:
            previousLowest === null
              ? nextPrice
              : roundMoney(Math.min(previousLowest, nextPrice)),
          highest_price: roundMoney(
            Math.max(
              previousHighest ?? nextPrice,
              nextPrice,
              reference ?? nextPrice,
            ),
          ),
          availability: preview.availability,
          last_checked_at: now,
          updated_at: now,
          ...inStockAvailabilityPatch(preview.availability),
          ...(preview.title ? { title: preview.title } : {}),
          ...(preview.imageUrl ? { image_url: preview.imageUrl } : {}),
          ...(preview.brand ? { brand: preview.brand } : {}),
          ...(preview.description ? { description: preview.description } : {}),
          ...(!product.category_id && categoryId ? { category_id: categoryId } : {}),
        })
        .eq("id", product.id);

      if (updateError) throw new Error(updateError.message);

      if (changed) {
        await client.from("price_history").insert({
          product_id: product.id,
          price: nextPrice,
          source: "amazon",
        });
      }

      quotes.push({
        asin,
        price: nextPrice,
        listPrice: reference,
        discountPercentage: discount,
        isFlashDeal: preview.isFlashDeal,
        title: preview.title,
        updated: changed,
      });
    } catch (error) {
      errors.push({
        asin,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }

  return {
    ok: true as const,
    provider: "html" as const,
    quotes,
    stats: {
      processed: asins.length,
      updated: quotes.filter((q) => q.updated).length,
      unchanged: quotes.filter((q) => !q.updated).length,
      dealsDetected: quotes.filter((q) => q.isFlashDeal).length,
      errors,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as {
      asin?: string;
      asins?: string[];
      notify?: boolean;
    };

    const asins = [
      ...(body.asin ? [body.asin] : []),
      ...(body.asins ?? []),
    ]
      .map((asin) => asin.trim().toUpperCase())
      .filter(Boolean);

    if (asins.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Indica al menos un ASIN." },
        { status: 400 },
      );
    }

    // 1–3 ASINs: sync HTML directo (más fiable para flash / admin Revisar).
    if (asins.length <= 3) {
      const result = await syncAsinsFromHtml(asins);
      return NextResponse.json(result);
    }

    const result = await runAmazonPriceCheck({
      asins,
      notify: body.notify ?? false,
      provider: "auto",
      delayMs: process.env.VERCEL ? 2_200 : 900,
      force: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
