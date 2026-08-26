import { NextRequest, NextResponse } from "next/server";
import {
  extractAsin,
  generateAffiliateUrl,
  generateAmazonUrl,
} from "@/lib/affiliate";
import { formatEnvError } from "@/lib/env";
import { toNumber } from "@/lib/money";
import { createSupabaseServiceClient } from "@/lib/supabase";
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

export async function GET() {
  try {
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
        amazonUrl: row.amazon_url,
        currentPrice,
        previousPrice,
        referencePrice: previousPrice ?? currentPrice,
        dealScore: scoring.score,
        dealLabel: scoring.label,
        discountPercentage:
          toNumber(row.discount_percentage) ?? scoring.discountPercentage,
        category: category
          ? { id: category.id, name: category.name, slug: category.slug }
          : null,
        isActive: row.is_active,
        lastCheckedAt: row.last_checked_at,
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
    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      id?: string;
      asin?: string;
    };
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
          category_id: body.categoryId || null,
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
