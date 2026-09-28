import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/catalog";
import { searchArticles } from "@/services/blog";

export interface SearchResponse {
  articles: Array<{
    slug: string;
    title: string;
    category: string;
    readingTime: string;
    coverImage: string;
  }>;
  products: Array<{
    slug: string;
    title: string;
    imageUrl: string | null;
    currentPrice: number;
    discountPercentage: number;
  }>;
}

/** Buscador de la cabecera: artículos del blog + productos del catálogo. */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 80) ?? "";
  if (query.trim().length < 2) {
    return NextResponse.json<SearchResponse>({ articles: [], products: [] });
  }

  const [articles, products] = await Promise.all([
    searchArticles(query),
    searchProducts(query),
  ]);

  return NextResponse.json<SearchResponse>(
    {
      articles: articles.map((post) => ({
        slug: post.slug,
        title: post.title,
        category: post.category,
        readingTime: post.readingTime,
        coverImage: post.coverImage,
      })),
      products: products.map((product) => ({
        slug: product.slug,
        title: product.title,
        imageUrl: product.imageUrl,
        currentPrice: product.currentPrice,
        discountPercentage: product.discountPercentage,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
