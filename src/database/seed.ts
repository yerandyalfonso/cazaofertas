import { generateAffiliateUrl, generateAmazonUrl } from "@/lib/affiliate";
import { BLOG_POSTS, collectProductSlugs } from "@/lib/blog";
import { SITE_CATEGORIES } from "@/lib/site-categories";
import { createSupabaseServiceClient, type TypedSupabaseClient } from "@/lib/supabase";
import {
  DEFAULT_MOCK_CATALOG,
  MockPriceProvider,
  type MockCatalogItem,
} from "@/providers/price";
import { dealScoringService } from "@/services/deal-scoring";
import { ProductAvailability } from "@/types";
import type { Json } from "@/types/database";

export interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  image_url: string;
}

export interface MockProductMeta {
  slug: string;
  description: string;
  is_featured?: boolean;
}

export const SEED_CATEGORIES: SeedCategory[] = SITE_CATEGORIES.map(
  ({ name, slug, description, image_url }) => ({
    name,
    slug,
    description,
    image_url,
  }),
);

/** Metadatos editoriales por ASIN (precios vienen del MockPriceProvider). */
export const MOCK_PRODUCT_META: Record<string, MockProductMeta> = {
  B0CAZA0006: {
    slug: "auriculares-anc-wireless",
    description:
      "Hasta 30 h de autonomía, cancelación activa de ruido y estuche compacto.",
    is_featured: true,
  },
  B0CAZA0018: {
    slug: "monitor-27-qhd-165hz",
    description: "Panel IPS QHD 165 Hz con soporte ergonómico.",
    is_featured: true,
  },
  B0CAZA0012: {
    slug: "zapatillas-running-asfalto",
    description: "Entresuela reactiva y upper transpirable para asfalto.",
    is_featured: true,
  },
  B0CAZA0002: {
    slug: "freidora-aire-5-5l",
    description: "Freidora sin aceite de 5,5 L con 8 programas predefinidos.",
  },
  B0CAZA0016: {
    slug: "ssd-nvme-1tb-pcie4",
    description: "SSD NVMe PCIe 4.0 de 1 TB con disipador incluido.",
    is_featured: true,
  },
  B0CAZA0004: {
    slug: "secador-ionico-profesional",
    description: "Secador profesional con motor AC e iones.",
  },
  B0CAZA0009: {
    slug: "esterilla-yoga-antideslizante",
    description: "Esterilla TPE de 6 mm con línea de alineación.",
  },
  B0CAZA0010: {
    slug: "reloj-deportivo-gps",
    description: "GPS, pulsómetro óptico y más de 80 modos deportivos.",
    is_featured: true,
  },
  B0CAZA0007: {
    slug: "altavoz-inteligente-compacto",
    description: "Altavoz 360º con asistente de voz integrado.",
  },
  B0CAZA0014: {
    slug: "set-construccion-ciudad-1200",
    description: "Set de construcción de 1.200 piezas con minifiguras.",
  },
  B0HBXKQCX7: {
    slug: "webcam-1080p-microfono",
    description:
      "Webcam Full HD 1080p con micrófono, cancelación de ruido y tapa de privacidad.",
    is_featured: true,
  },
  B0GY8H7WHX: {
    slug: "mochila-urbana-impermeable",
    description:
      "Mochila ultraligera impermeable para uso urbano, excursiones y senderismo.",
    is_featured: true,
  },
  B0DCZF5X4P: {
    slug: "monitor-aoc-gaming-q27g4xf",
    description:
      "Monitor gaming AOC Q27G4XF QHD con soporte ajustable y DisplayPort.",
    is_featured: true,
  },
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function metaForItem(item: MockCatalogItem): MockProductMeta {
  return (
    MOCK_PRODUCT_META[item.asin] ?? {
      slug: slugify(item.title ?? item.asin),
      description: `Producto de prueba ${item.brand ?? "CazaOferta"} en categoría ${item.categorySlug ?? "general"}.`,
    }
  );
}

function categoriesForCatalog(catalog: MockCatalogItem[]): SeedCategory[] {
  const slugs = new Set(
    catalog.map((item) => item.categorySlug).filter(Boolean) as string[],
  );
  return SEED_CATEGORIES.filter((category) => slugs.has(category.slug));
}

export interface SeedResult {
  categories: number;
  products: number;
  priceHistory: number;
  articles: number;
  articleProducts: number;
  deals: Array<{ asin: string; level: string; discount: number; score: number }>;
}

export async function seedFromMockProvider(
  client: TypedSupabaseClient = createSupabaseServiceClient(),
): Promise<SeedResult> {
  const catalog = DEFAULT_MOCK_CATALOG;
  const provider = new MockPriceProvider({ catalog, mode: "stable" });
  const quotes = await provider.getProducts(catalog.map((item) => item.asin));
  const categoriesToSeed = categoriesForCatalog(catalog);

  const { error: categoryError } = await client.from("categories").upsert(
    categoriesToSeed.map((category) => ({
      name: category.name,
      slug: category.slug,
      description: category.description,
      image_url: category.image_url,
      is_active: true,
    })),
    { onConflict: "slug" },
  );

  if (categoryError) {
    throw new Error(`Error al sembrar categorías: ${categoryError.message}`);
  }

  const { data: categories, error: categoriesReadError } = await client
    .from("categories")
    .select("id, slug")
    .in(
      "slug",
      categoriesToSeed.map((category) => category.slug),
    );

  if (categoriesReadError || !categories) {
    throw new Error(
      `No se pudieron leer categorías: ${categoriesReadError?.message ?? "sin datos"}`,
    );
  }

  const categoryIdBySlug = new Map(
    categories.map((category) => [category.slug, category.id]),
  );

  const dealSummaries: SeedResult["deals"] = [];

  const productPayload = catalog.map((item, index) => {
    const quote = quotes[index];
    const meta = metaForItem(item);
    const categorySlug = item.categorySlug ?? "tecnologia";
    const categoryId = categoryIdBySlug.get(categorySlug);

    if (!categoryId) {
      throw new Error(`Categoría no encontrada: ${categorySlug}`);
    }

    const currentPrice = quote.price ?? item.price;
    const previousPrice =
      quote.previousPrice ?? item.previousPrice ?? currentPrice;
    const lowestPrice = Math.min(
      currentPrice,
      previousPrice,
      item.price * 0.92,
    );
    const highestPrice = Math.max(currentPrice, previousPrice, item.price * 1.15);

    const scoring = dealScoringService.scoreProduct({
      currentPrice,
      previousPrice,
      lowestPrice,
      categorySlug,
    });

    dealSummaries.push({
      asin: item.asin,
      level: scoring.label,
      discount: scoring.discountPercentage,
      score: scoring.score,
    });

    const amazonUrl =
      item.amazonUrl?.trim() ||
      quote.amazonUrl?.trim() ||
      generateAmazonUrl(item.asin);

    return {
      asin: item.asin,
      title: quote.title ?? item.title ?? `Producto ${item.asin}`,
      slug: meta.slug,
      description: meta.description,
      image_url: quote.imageUrl ?? item.imageUrl ?? null,
      amazon_url: amazonUrl,
      affiliate_url: generateAffiliateUrl({
        amazon_url: amazonUrl,
        asin: item.asin,
      }),
      brand: quote.brand ?? item.brand ?? null,
      category_id: categoryId,
      current_price: currentPrice,
      previous_price: previousPrice,
      lowest_price: lowestPrice,
      highest_price: highestPrice,
      discount_percentage: scoring.discountPercentage,
      currency: quote.currency,
      availability: ProductAvailability.IN_STOCK,
      last_checked_at: new Date().toISOString(),
      is_active: true,
      is_featured: meta.is_featured ?? false,
    };
  });

  // Si un slug ya pertenece a otro ASIN, liberarlo para poder actualizar.
  for (const product of productPayload) {
    const { error: slugCleanupError } = await client
      .from("products")
      .delete()
      .eq("slug", product.slug)
      .neq("asin", product.asin);

    if (slugCleanupError) {
      throw new Error(
        `Error al limpiar slug duplicado (${product.slug}): ${slugCleanupError.message}`,
      );
    }
  }

  // Conflicto por ASIN (identidad Amazon). Upsert por slug falla si el ASIN
  // ya existe en otra fila con distinto slug → products_asin_key.
  const { error: productsError } = await client
    .from("products")
    .upsert(productPayload, { onConflict: "asin" });

  if (productsError) {
    throw new Error(`Error al sembrar productos: ${productsError.message}`);
  }

  const { data: storedProducts, error: storedProductsError } = await client
    .from("products")
    .select("id, asin")
    .in(
      "asin",
      catalog.map((item) => item.asin),
    );

  if (storedProductsError || !storedProducts) {
    throw new Error(
      `No se pudieron leer productos: ${storedProductsError?.message ?? "sin datos"}`,
    );
  }

  const productIdByAsin = new Map(
    storedProducts.map((product) => [product.asin, product.id]),
  );

  const historyRows = catalog.flatMap((item, index) => {
    const productId = productIdByAsin.get(item.asin);
    if (!productId) {
      throw new Error(`Producto no encontrado tras el upsert: ${item.asin}`);
    }

    const quote = quotes[index];
    const previousPrice =
      quote.previousPrice ?? item.previousPrice ?? quote.price ?? item.price;
    const highestPrice = Math.max(
      quote.price ?? item.price,
      previousPrice,
      item.price * 1.15,
    );
    const now = Date.now();

    return [
      {
        product_id: productId,
        price: highestPrice,
        timestamp: new Date(now - 21 * 24 * 60 * 60 * 1000).toISOString(),
        source: "seed" as const,
      },
      {
        product_id: productId,
        price: previousPrice,
        timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        source: "seed" as const,
      },
      {
        product_id: productId,
        price: quote.price ?? item.price,
        timestamp: new Date(now).toISOString(),
        source: "seed" as const,
      },
    ];
  });

  const { error: deleteHistoryError } = await client
    .from("price_history")
    .delete()
    .in(
      "product_id",
      storedProducts.map((product) => product.id),
    );

  if (deleteHistoryError) {
    throw new Error(
      `Error al limpiar histórico: ${deleteHistoryError.message}`,
    );
  }

  const { error: historyError } = await client
    .from("price_history")
    .insert(historyRows);

  if (historyError) {
    throw new Error(`Error al sembrar histórico: ${historyError.message}`);
  }

  const { articles, articleProducts } = await seedBlogArticles(client);

  return {
    categories: categoriesToSeed.length,
    products: productPayload.length,
    priceHistory: historyRows.length,
    articles,
    articleProducts,
    deals: dealSummaries,
  };
}

export interface SeedBlogResult {
  articles: number;
  articleProducts: number;
  missingProductSlugs: string[];
  articlesUpserted: string[];
}

/** Inserta/actualiza artículos editoriales y enlaza productos existentes. */
export async function seedBlogArticles(
  client: TypedSupabaseClient = createSupabaseServiceClient(),
): Promise<SeedBlogResult> {
  const articlePayload = BLOG_POSTS.map((post) => {
    const minutes = Number.parseInt(post.readingTime, 10);
    // Bloques → array JSON; HTML → objeto { format, html } (nunca stringificar el array).
    const content: Json = post.html
      ? ({ format: "html", html: post.html } as unknown as Json)
      : (post.body as unknown as Json);

    return {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content,
      featured_image: post.coverImage,
      author: "CazaOferta",
      category: post.category,
      status: "published",
      seo_title: post.title,
      seo_description: post.excerpt,
      reading_time: Number.isFinite(minutes) && minutes > 0 ? minutes : 5,
    };
  });

  const { error: articlesError } = await client
    .from("articles")
    .upsert(articlePayload, { onConflict: "slug" });

  if (articlesError) {
    throw new Error(
      `Error al sembrar artículos: ${articlesError.message}. ¿Aplicaste supabase/migrations/0003_articles.sql y 0004_align_articles_schema.sql?`,
    );
  }

  const { data: storedArticles, error: articlesReadError } = await client
    .from("articles")
    .select("id, slug")
    .in(
      "slug",
      BLOG_POSTS.map((post) => post.slug),
    );

  if (articlesReadError || !storedArticles) {
    throw new Error(
      `No se pudieron leer artículos: ${articlesReadError?.message ?? "sin datos"}`,
    );
  }

  const allSlugs = [
    ...new Set(BLOG_POSTS.flatMap((post) => collectProductSlugs(post))),
  ];

  const { data: linkedProducts, error: productsReadError } = await client
    .from("products")
    .select("id, slug")
    .in("slug", allSlugs)
    .eq("is_active", true);

  if (productsReadError) {
    throw new Error(
      `No se pudieron leer productos: ${productsReadError.message}`,
    );
  }

  const productIdBySlug = new Map(
    (linkedProducts ?? []).map((product) => [product.slug, product.id]),
  );
  const missingProductSlugs = allSlugs.filter(
    (slug) => !productIdBySlug.has(slug),
  );
  const articleIdBySlug = new Map(
    storedArticles.map((article) => [article.slug, article.id]),
  );

  const articleIds = storedArticles.map((article) => article.id);
  if (articleIds.length > 0) {
    const { error: deleteLinksError } = await client
      .from("article_products")
      .delete()
      .in("article_id", articleIds);

    if (deleteLinksError) {
      throw new Error(
        `Error al limpiar article_products: ${deleteLinksError.message}`,
      );
    }
  }

  const linkRows = BLOG_POSTS.flatMap((post) => {
    const articleId = articleIdBySlug.get(post.slug);
    if (!articleId) return [];

    return collectProductSlugs(post)
      .map((slug, index) => {
        const productId = productIdBySlug.get(slug);
        if (!productId) return null;
        return {
          article_id: articleId,
          product_id: productId,
          position: index,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  });

  if (linkRows.length > 0) {
    const { error: linksError } = await client
      .from("article_products")
      .insert(linkRows);

    if (linksError) {
      throw new Error(
        `Error al sembrar article_products: ${linksError.message}`,
      );
    }
  }

  return {
    articles: articlePayload.length,
    articleProducts: linkRows.length,
    missingProductSlugs,
    articlesUpserted: articlePayload.map((article) => article.slug),
  };
}

/** Alias compatible con rutas API existentes. */
export const seedDatabase = seedFromMockProvider;
