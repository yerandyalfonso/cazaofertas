import { NextRequest, NextResponse } from "next/server";
import {
  generateAffiliateUrl,
} from "@/lib/affiliate";
import {
  resolveAmazonProductCategoryId,
  resolveCategoryIdBySlug,
} from "@/lib/categories";
import { inferCarrefourCategorySlug } from "@/lib/carrefour-category";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { toNumber } from "@/lib/money";
import { availabilityLabel } from "@/lib/out-of-stock-policy";
import {
  detectRetailerFromUrl,
  extractExternalId,
  getRetailerDefinition,
  isProductRetailer,
  resolveCanonicalProductUrl,
  syntheticAsinForRetailer,
  type ProductRetailer,
} from "@/lib/retailers";
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

const ADMIN_PRODUCT_SORT_KEYS = [
  "title",
  "asin",
  "currentPrice",
  "referencePrice",
  "dealScore",
  "category",
  "lastCheckedAt",
] as const;

type AdminProductSortKey = (typeof ADMIN_PRODUCT_SORT_KEYS)[number];

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function resolveProductSort(
  sort: string | null,
  dir: string | null,
): {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
  foreignTable?: string;
} {
  const key = ADMIN_PRODUCT_SORT_KEYS.includes(sort as AdminProductSortKey)
    ? (sort as AdminProductSortKey)
    : "lastCheckedAt";
  const ascending = dir === "asc";

  switch (key) {
    case "title":
      return { column: "title", ascending, nullsFirst: false };
    case "asin":
      return { column: "asin", ascending, nullsFirst: false };
    case "currentPrice":
      return { column: "current_price", ascending, nullsFirst: false };
    case "referencePrice":
      return { column: "previous_price", ascending, nullsFirst: ascending };
    case "dealScore":
      return { column: "discount_percentage", ascending, nullsFirst: ascending };
    case "category":
      return {
        column: "name",
        ascending,
        nullsFirst: ascending,
        foreignTable: "categories",
      };
    case "lastCheckedAt":
    default:
      return {
        column: "last_checked_at",
        ascending,
        nullsFirst: ascending,
      };
  }
}

export async function GET(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const client = createSupabaseServiceClient();
    const { searchParams } = new URL(request.url);

    const rawLimit = Number.parseInt(searchParams.get("limit") ?? "100", 10);
    const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 200)
        : 100;
    const offset =
      Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

    const sort = resolveProductSort(
      searchParams.get("sort"),
      searchParams.get("dir"),
    );
    const q = searchParams.get("q")?.trim() ?? "";
    const categoryId = searchParams.get("category")?.trim() ?? "";
    const retailer = searchParams.get("retailer")?.trim() ?? "";
    const stale = searchParams.get("stale")?.trim() ?? "all";
    const deal = searchParams.get("deal")?.trim() ?? "all";
    const staleCutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();

    let query = client
      .from("products")
      .select("*, categories(id, name, slug)", { count: "exact" });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    if (retailer) {
      query = query.eq("retailer", retailer);
    }
    if (q) {
      const needle = escapeIlike(q);
      query = query.or(
        `title.ilike.%${needle}%,asin.ilike.%${needle}%,brand.ilike.%${needle}%,external_id.ilike.%${needle}%`,
      );
    }
    if (stale === "never") {
      query = query.is("last_checked_at", null);
    } else if (stale === "fresh") {
      query = query.gte("last_checked_at", staleCutoff);
    } else if (stale === "stale") {
      query = query.or(
        `last_checked_at.is.null,last_checked_at.lt.${staleCutoff}`,
      );
    }
    if (deal === "offer") {
      query = query
        .eq("is_active", true)
        .neq("availability", ProductAvailability.OUT_OF_STOCK)
        .gte("discount_percentage", 5);
    } else if (deal === "normal") {
      query = query.or(
        `discount_percentage.lt.5,discount_percentage.is.null,is_active.eq.false,availability.eq.${ProductAvailability.OUT_OF_STOCK}`,
      );
    }

    query = query.order(sort.column, {
      ascending: sort.ascending,
      nullsFirst: sort.nullsFirst,
      ...(sort.foreignTable ? { foreignTable: sort.foreignTable } : {}),
    });

    const { data, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );

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
        retailer: row.retailer ?? "amazon",
        externalId: row.external_id,
        brand: row.brand,
        description: row.description,
        productUrl: row.product_url ?? row.amazon_url,
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

    const total = count ?? products.length;
    const hasMore = offset + products.length < total;

    // Categorías solo en la primera página (evita repetir en cada lote).
    let categories: Array<{ id: string; name: string; slug: string }> | undefined;
    if (offset === 0) {
      const { data: categoryRows } = await client
        .from("categories")
        .select("id, name, slug")
        .eq("is_active", true)
        .order("name");
      categories = categoryRows ?? [];
    }

    return NextResponse.json({
      ok: true,
      products,
      total,
      offset,
      limit,
      hasMore,
      ...(categories ? { categories } : {}),
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
      retailer?: string;
      productUrl?: string;
      amazonUrl?: string;
      externalId?: string;
      title?: string;
      categoryId?: string;
      referencePrice?: number;
      currentPrice?: number;
      asin?: string;
      slug?: string;
      brand?: string;
      imageUrl?: string;
      description?: string;
    };

    const productUrlInput =
      body.productUrl?.trim() || body.amazonUrl?.trim() || "";
    const retailer: ProductRetailer =
      body.retailer && isProductRetailer(body.retailer)
        ? body.retailer
        : detectRetailerFromUrl(productUrlInput) ?? "amazon";

    const definition = getRetailerDefinition(retailer);
    const externalId =
      body.externalId?.trim() ||
      extractExternalId(retailer, productUrlInput) ||
      extractExternalId(retailer, body.asin ?? "");

    if (!externalId) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se pudo obtener el identificador del producto (${definition.externalIdHint}).`,
        },
        { status: 400 },
      );
    }

    const asin =
      retailer === "amazon"
        ? externalId
        : syntheticAsinForRetailer(retailer, externalId);

    const title = body.title?.trim();
    if (!title) {
      return NextResponse.json(
        { ok: false, error: "El título es obligatorio." },
        { status: 400 },
      );
    }

    const resolvedUrl = resolveCanonicalProductUrl(
      retailer,
      productUrlInput,
      externalId,
    );

    if (!resolvedUrl) {
      return NextResponse.json(
        { ok: false, error: "La URL del producto es obligatoria." },
        { status: 400 },
      );
    }

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

    const price =
      Number.isFinite(currentPrice) && currentPrice > 0
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
      if (retailer === "amazon") {
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
      } else if (definition.defaultCategorySlug) {
        const category = await resolveCategoryIdBySlug(
          client,
          definition.defaultCategorySlug,
        );
        categoryId = category?.id ?? null;
      } else if (retailer === "carrefour") {
        const slug = inferCarrefourCategorySlug({
          title,
          feedUrl: resolvedUrl,
        });
        if (slug) {
          const category = await resolveCategoryIdBySlug(client, slug);
          categoryId = category?.id ?? null;
        }
      }
    }

    const affiliateUrl =
      retailer === "amazon"
        ? generateAffiliateUrl({
            amazon_url: resolvedUrl,
            asin,
          })
        : resolvedUrl;

    const { data, error } = await client
      .from("products")
      .upsert(
        {
          retailer,
          external_id: externalId,
          product_url: resolvedUrl,
          asin,
          title,
          slug,
          amazon_url: resolvedUrl,
          affiliate_url: affiliateUrl,
          brand: body.brand?.trim() || definition.defaultBrand || null,
          image_url: body.imageUrl?.trim() || null,
          description: body.description?.trim() || null,
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
      .select("id, asin, slug, title, retailer")
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
