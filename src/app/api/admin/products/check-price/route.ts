import { NextRequest, NextResponse } from "next/server";
import { resolveAmazonProductCategoryId } from "@/lib/categories";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { roundMoney, toNumber } from "@/lib/money";
import {
  buildOutOfStockUpdate,
  inStockAvailabilityPatch,
} from "@/lib/out-of-stock-policy";
import {
  normalizeRetailer,
  resolveProductPageUrl,
  retailerScrapeSupported,
} from "@/lib/retailers";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { previewAmazonProductPage } from "@/providers/price";
import { runAmazonPriceCheck } from "@/services/amazonPriceCheck";
import { inferRetailerFromAsin } from "@/services/products";
import { previewProductPage } from "@/services/productScrape";
import { ProductAvailability } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type QuoteResult = {
  asin: string;
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  isFlashDeal: boolean;
  title?: string;
  updated: boolean;
  unavailable?: boolean;
  retailer?: string;
};

/**
 * Admin «Revisar precio»: scrape directo de la ficha y escribe precio/lista.
 * Amazon → HTML Amazon ES; resto de tiendas con scrape → previewProductPage.
 */
async function syncAsinsFromHtml(asins: string[]) {
  const client = createSupabaseServiceClient();
  const quotes: QuoteResult[] = [];
  const errors: Array<{ asin: string; message: string }> = [];

  for (const asin of asins) {
    try {
      const { data: product, error: lookupError } = await client
        .from("products")
        .select(
          "id, asin, retailer, title, brand, category_id, current_price, previous_price, lowest_price, highest_price, amazon_url, product_url, availability, out_of_stock_at, is_active",
        )
        .eq("asin", asin)
        .eq("is_active", true)
        .maybeSingle();

      if (lookupError) throw new Error(lookupError.message);
      if (!product) {
        errors.push({ asin, message: "Producto no encontrado en el catálogo." });
        continue;
      }

      const retailer =
        product.retailer != null
          ? normalizeRetailer(product.retailer)
          : inferRetailerFromAsin(product.asin);

      if (retailer !== "amazon" && !retailerScrapeSupported(retailer)) {
        errors.push({
          asin,
          message: `Revisión de precio no soportada para ${retailer}.`,
        });
        continue;
      }

      if (retailer === "amazon") {
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
              ...(preview.description
                ? { description: preview.description }
                : {}),
            });
            const { error: updateError } = await client
              .from("products")
              .update(oosPatch)
              .eq("id", product.id);

            if (updateError) throw new Error(updateError.message);

            quotes.push({
              asin,
              retailer,
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
        const reference =
          listPrice ??
          (storedPrevious != null && storedPrevious > nextPrice
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
            ...(preview.description
              ? { description: preview.description }
              : {}),
            ...(!product.category_id && categoryId
              ? { category_id: categoryId }
              : {}),
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
          retailer,
          price: nextPrice,
          listPrice: reference,
          discountPercentage: discount,
          isFlashDeal: preview.isFlashDeal,
          title: preview.title,
          updated: changed,
        });
        continue;
      }

      // Miravia / Kiabi / otras con scrape
      const productUrl = resolveProductPageUrl(product);
      if (!productUrl) {
        errors.push({
          asin,
          message: "No hay URL de producto para revisar.",
        });
        continue;
      }

      const preview = await previewProductPage(productUrl, { retailer });
      if (preview.price == null) {
        errors.push({
          asin,
          message:
            preview.warning ||
            "La tienda no devolvió precio para este producto.",
        });
        continue;
      }

      const nextPrice = roundMoney(preview.price);
      const listPrice =
        preview.listPrice != null && preview.listPrice > nextPrice
          ? roundMoney(preview.listPrice)
          : null;
      const storedCurrent = toNumber(product.current_price);
      const storedPrevious = toNumber(product.previous_price);
      const reference =
        listPrice ??
        (storedPrevious != null && storedPrevious > nextPrice
          ? storedPrevious
          : nextPrice);
      const discount =
        reference > nextPrice
          ? roundMoney(((reference - nextPrice) / reference) * 100)
          : 0;
      const changed =
        storedCurrent === null || Math.abs(storedCurrent - nextPrice) >= 0.01;
      const now = new Date().toISOString();

      const { error: updateError } = await client
        .from("products")
        .update({
          current_price: nextPrice,
          previous_price: reference,
          discount_percentage: discount,
          lowest_price:
            toNumber(product.lowest_price) == null
              ? nextPrice
              : roundMoney(
                  Math.min(toNumber(product.lowest_price)!, nextPrice),
                ),
          highest_price: roundMoney(
            Math.max(
              toNumber(product.highest_price) ?? nextPrice,
              nextPrice,
              reference,
            ),
          ),
          availability: ProductAvailability.IN_STOCK,
          last_checked_at: now,
          updated_at: now,
          ...inStockAvailabilityPatch(ProductAvailability.IN_STOCK),
          ...(preview.title ? { title: preview.title } : {}),
          ...(preview.brand ? { brand: preview.brand } : {}),
          ...(preview.imageUrl ? { image_url: preview.imageUrl } : {}),
          ...(preview.description ? { description: preview.description } : {}),
        })
        .eq("id", product.id);

      if (updateError) throw new Error(updateError.message);

      if (changed) {
        await client.from("price_history").insert({
          product_id: product.id,
          price: nextPrice,
          source: retailer === "kiabi" ? "kiabi" : "miravia",
        });
      }

      quotes.push({
        asin,
        retailer,
        price: nextPrice,
        listPrice: listPrice ?? reference,
        discountPercentage: discount > 0 ? discount : null,
        isFlashDeal: false,
        title: preview.title ?? undefined,
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

    // 1–3 ASINs: sync HTML directo (Amazon + retail).
    if (asins.length <= 3) {
      const result = await syncAsinsFromHtml(asins);
      return NextResponse.json(result);
    }

    // Lotes grandes: solo Amazon batch (retail se revisa 1 a 1 desde admin).
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
