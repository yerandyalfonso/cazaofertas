import { NextRequest, NextResponse } from "next/server";
import {
  extractAsin,
  generateAffiliateUrl,
  generateAmazonUrl,
} from "@/lib/affiliate";
import { resolveAmazonProductCategoryId } from "@/lib/categories";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { toNumber } from "@/lib/money";
import { availabilityLabel } from "@/lib/out-of-stock-policy";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { previewAmazonProductPage } from "@/providers/price";
import { dealScoringService } from "@/services/deal-scoring";
import { ProductAvailability } from "@/types";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const client = createSupabaseServiceClient();

    const { data, error } = await client
      .from("products")
      .select("*, categories(id, name, slug)")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      throw new Error(error.message);
    }

    const products = (data ?? []).map((row) => {
      const categoryRaw = row.categories;
      const category = Array.isArray(categoryRaw)
        ? categoryRaw[0]
        : categoryRaw;
      const currentPrice = toNumber(row.current_price) ?? 0;
      const previousPrice = toNumber(row.previous_price);
      const lowestPrice = toNumber(row.lowest_price);
      const scoring = dealScoringService.scoreProduct({
        currentPrice,
        previousPrice,
        lowestPrice,
        categorySlug: category?.slug,
      });

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        asin: row.asin,
        brand: row.brand,
        description: row.description,
        amazonUrl: row.amazon_url,
        affiliateUrl: row.affiliate_url,
        imageUrl: row.image_url,
        currentPrice,
        previousPrice,
        lowestPrice,
        highestPrice: toNumber(row.highest_price),
        averagePrice30d: toNumber(row.average_price_30d),
        averagePrice90d: toNumber(row.average_price_90d),
        referencePrice: previousPrice ?? currentPrice,
        dealScore: scoring.score,
        dealLabel: scoring.label,
        dealLevel: scoring.level,
        discountPercentage:
          toNumber(row.discount_percentage) ?? scoring.discountPercentage,
        currency: row.currency,
        availability: row.availability,
        availabilityLabel: availabilityLabel(row.availability),
        outOfStockAt: row.out_of_stock_at,
        category: category
          ? { id: category.id, name: category.name, slug: category.slug }
          : null,
        isActive: row.is_active,
        isFeatured: row.is_featured,
        lastCheckedAt: row.last_checked_at,
        lastTelegramNotifiedAt: row.last_telegram_notified_at,
        lastTelegramNotifiedPrice: toNumber(row.last_telegram_notified_price),
        lastTelegramNotifiedScore: toNumber(row.last_telegram_notified_score),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    const { data: categories } = await client
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name");

    return NextResponse.json({
      ok: true,
      products,
      categories: categories ?? [],
    });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      asin?: string;
      ids?: string[];
    };
    const ids = (body.ids ?? [])
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    if (ids.length > 0) {
      const client = createSupabaseServiceClient();
      const { error } = await client.from("products").delete().in("id", ids);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, deleted: ids.length });
    }

    const id = body.id?.trim() || searchParams.get("id")?.trim();
    const asin = (body.asin?.trim() || searchParams.get("asin")?.trim() || "")
      .toUpperCase();

    if (!id && !asin) {
      return NextResponse.json(
        { ok: false, error: "Indica id o ASIN del producto." },
        { status: 400 },
      );
    }

    const client = createSupabaseServiceClient();
    let query = client.from("products").delete();
    query = id ? query.eq("id", id) : query.eq("asin", asin);

    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json()) as {
      amazonUrl?: string;
      title?: string;
      categoryId?: string;
      referencePrice?: number;
      currentPrice?: number;
      asin?: string;
      slug?: string;
      brand?: string;
    };

    const amazonUrl = body.amazonUrl?.trim() ?? "";
    const asin =
      body.asin?.trim().toUpperCase() ||
      extractAsin(amazonUrl) ||
      extractAsin(body.asin ?? "");

    if (!asin) {
      return NextResponse.json(
        { ok: false, error: "ASIN o URL de Amazon no válidos." },
        { status: 400 },
      );
    }

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json(
        { ok: false, error: "El título es obligatorio." },
        { status: 400 },
      );
    }

    const resolvedUrl =
      amazonUrl || generateAmazonUrl(asin);
    const referencePrice = Number(body.referencePrice);
    const currentPrice = Number(
      body.currentPrice ?? body.referencePrice ?? NaN,
    );

    if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
      return NextResponse.json(
        { ok: false, error: "Precio de referencia inválido." },
        { status: 400 },
      );
    }

    const price = Number.isFinite(currentPrice) && currentPrice > 0
      ? currentPrice
      : referencePrice;

    const client = createSupabaseServiceClient();
    const slug = (body.slug?.trim() || slugify(title)).slice(0, 80);

    const { error: slugCleanupError } = await client
      .from("products")
      .delete()
      .eq("slug", slug)
      .neq("asin", asin);

    if (slugCleanupError) {
      throw new Error(slugCleanupError.message);
    }

    const discount =
      referencePrice > price
        ? Math.round(((referencePrice - price) / referencePrice) * 10000) / 100
        : 0;

    let categoryId = body.categoryId?.trim() || null;
    if (!categoryId) {
      try {
        const preview = await previewAmazonProductPage(resolvedUrl, {
          timeoutMs: 18_000,
        });
        categoryId = await resolveAmazonProductCategoryId(client, {
          categorySlug: preview.categorySlug,
          breadcrumbs: preview.breadcrumbs,
          title: preview.title ?? title,
          brand: body.brand?.trim() || preview.brand,
        });
      } catch {
        categoryId = await resolveAmazonProductCategoryId(client, {
          title,
          brand: body.brand?.trim() || null,
        });
      }
    }

    const { data, error } = await client
      .from("products")
      .upsert(
        {
          asin,
          title,
          slug,
          amazon_url: resolvedUrl,
          affiliate_url: generateAffiliateUrl({
            amazon_url: resolvedUrl,
            asin,
          }),
          brand: body.brand?.trim() || null,
          category_id: categoryId,
          current_price: price,
          previous_price: referencePrice,
          lowest_price: Math.min(price, referencePrice),
          highest_price: Math.max(price, referencePrice),
          discount_percentage: discount,
          currency: "EUR",
          availability: ProductAvailability.IN_STOCK,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "asin" },
      )
      .select("id, asin, slug, title")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, product: data });
  } catch (error) {
    const message = formatEnvError(error);
    const status = message.includes("No autorizado") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
