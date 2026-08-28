import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { isProductRetailer } from "@/lib/retailers";
import { previewProductPage } from "@/services/productScrape";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as {
      amazonUrl?: string;
      productUrl?: string;
      url?: string;
      asin?: string;
      retailer?: string;
    };

    const input =
      body.productUrl?.trim() ||
      body.amazonUrl?.trim() ||
      body.url?.trim() ||
      body.asin?.trim() ||
      "";

    if (!input) {
      return NextResponse.json(
        { ok: false, error: "Indica la URL del producto o su identificador." },
        { status: 400 },
      );
    }

    const retailerHint =
      body.retailer && isProductRetailer(body.retailer)
        ? body.retailer
        : undefined;

    const preview = await previewProductPage(input, { retailer: retailerHint });

    if (!preview.title && preview.price === null) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo extraer título ni precio de la ficha.",
          preview,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      partial: preview.partial ?? false,
      warning: preview.warning ?? null,
      retailer: preview.retailer,
      externalId: preview.externalId,
      asin: preview.asin,
      title: preview.title,
      brand: preview.brand,
      price: preview.price,
      listPrice: preview.listPrice,
      referencePrice: preview.referencePrice,
      discountPercentage: preview.discountPercentage,
      productUrl: preview.productUrl,
      amazonUrl: preview.productUrl,
      imageUrl: preview.imageUrl,
      categorySlug: preview.categorySlug,
      breadcrumbs: preview.breadcrumbs,
      description: preview.description ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
