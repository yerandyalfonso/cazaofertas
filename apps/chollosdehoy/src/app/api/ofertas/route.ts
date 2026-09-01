import { NextRequest, NextResponse } from "next/server";
import { queryMarketplaceProducts } from "@/lib/catalog";
import { searchParamsToFilters } from "@/lib/api-params";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { filters, page, pageSize } = searchParamsToFilters(
    request.nextUrl.searchParams,
  );

  try {
    const result = await queryMarketplaceProducts(filters, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/ofertas]", error);
    return NextResponse.json(
      { error: "No se pudo cargar el catálogo" },
      { status: 500 },
    );
  }
}
