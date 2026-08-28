import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { formatEnvError } from "@/lib/env";
import { previewAmazonProductPage } from "@/providers/price";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const denied = requireAdminApi(request);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as {
      amazonUrl?: string;
      url?: string;
      asin?: string;
    };

    const input =
      body.amazonUrl?.trim() || body.url?.trim() || body.asin?.trim() || "";

    if (!input) {
      return NextResponse.json(
        { ok: false, error: "Indica una URL de Amazon o un ASIN." },
        { status: 400 },
      );
    }

    const preview = await previewAmazonProductPage(input);

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
      asin: preview.asin,
      title: preview.title ?? null,
      price: preview.price,
      listPrice: preview.listPrice,
      referencePrice: preview.listPrice ?? preview.price,
      discountPercentage: preview.discountPercentage,
      isFlashDeal: preview.isFlashDeal,
      amazonUrl: preview.amazonUrl,
      availability: preview.availability,
      categorySlug: preview.categorySlug ?? null,
      breadcrumbs: preview.breadcrumbs ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: formatEnvError(error) },
      { status: 500 },
    );
  }
}
