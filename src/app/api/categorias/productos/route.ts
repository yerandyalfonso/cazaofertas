import { NextResponse } from "next/server";
import { CATEGORY_PAGE_SIZE, type CatalogProduct } from "@/lib/catalog";
import { getCategoryListing } from "@/lib/category-listing";

export interface CategoryProductsResponse {
  products: CatalogProduct[];
  total: number;
}

/** Siguiente tanda de ofertas de una categoría (scroll de la rejilla). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = params.get("slug")?.slice(0, 80) ?? "";
  const child = params.get("child")?.slice(0, 80) || null;
  const offset = Math.max(0, Math.floor(Number(params.get("offset")) || 0));
  if (!slug) {
    return NextResponse.json({ error: "Falta la categoría" }, { status: 400 });
  }

  const listing = await getCategoryListing(slug, child);
  if (!listing) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  return NextResponse.json<CategoryProductsResponse>(
    {
      products: listing.slice(offset, offset + CATEGORY_PAGE_SIZE),
      total: listing.length,
    },
    { headers: { "Cache-Control": "public, s-maxage=60" } },
  );
}
