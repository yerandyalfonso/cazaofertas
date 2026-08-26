import type { Metadata } from "next";
import { absoluteUrl, getSiteUrl } from "@/lib/site";
import { formatEuro } from "@/lib/money";
import type { CatalogProduct } from "@/lib/catalog";
import type { BlogPost } from "@/lib/blog";
import { ProductAvailability } from "@/types";

export const SITE_NAME = "CazaOferta";
export const DEFAULT_TITLE = "CazaOferta — Revista de chollos Amazon";
export const DEFAULT_DESCRIPTION =
  "Ofertas reales de Amazon España, puntuadas por bajada y mínimo histórico. Alertas por Telegram.";

export function buildPageMetadata(options: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  noIndex?: boolean;
}): Metadata {
  const url = options.path.startsWith("http")
    ? options.path
    : absoluteUrl(options.path);
  const image = options.image
    ? options.image.startsWith("http")
      ? options.image
      : absoluteUrl(options.image)
    : absoluteUrl("/opengraph-image");

  return {
    title: options.title,
    description: options.description,
    alternates: { canonical: options.path },
    robots: options.noIndex
      ? { index: false, follow: false }
      : undefined,
    openGraph: {
      type: options.type ?? "website",
      title: options.title,
      description: options.description,
      url,
      siteName: SITE_NAME,
      locale: "es_ES",
      images: [{ url: image, alt: options.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: [image],
    },
  };
}

export function availabilitySchema(
  value: ProductAvailability,
): "https://schema.org/InStock" | "https://schema.org/OutOfStock" | "https://schema.org/PreOrder" | "https://schema.org/LimitedAvailability" {
  switch (value) {
    case ProductAvailability.IN_STOCK:
      return "https://schema.org/InStock";
    case ProductAvailability.OUT_OF_STOCK:
      return "https://schema.org/OutOfStock";
    case ProductAvailability.PREORDER:
      return "https://schema.org/PreOrder";
    default:
      return "https://schema.org/LimitedAvailability";
  }
}

export function organizationJsonLd() {
  const url = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url,
    logo: absoluteUrl("/icon"),
    description: DEFAULT_DESCRIPTION,
    sameAs: [] as string[],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: getSiteUrl(),
    inLanguage: "es-ES",
    description: DEFAULT_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: getSiteUrl(),
    },
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function productJsonLd(product: CatalogProduct) {
  const url = absoluteUrl(`/producto/${product.slug}`);
  const description =
    product.description ??
    `${product.title} en Amazon España. Precio actual ${formatEuro(product.currentPrice)}.`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description,
    sku: product.asin,
    mpn: product.asin,
    brand: product.brand
      ? { "@type": "Brand", name: product.brand }
      : undefined,
    image: product.imageUrl ? [product.imageUrl] : undefined,
    category: product.category?.name,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: product.currency || "EUR",
      price: product.currentPrice.toFixed(2),
      availability: availabilitySchema(product.availability),
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "Amazon",
      },
    },
  };
}

export function articleJsonLd(post: BlogPost) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: [post.coverImage],
    datePublished: post.publishedAt,
    dateModified: post.reviewedAt ?? post.publishedAt,
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/icon"),
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    articleSection: post.category,
    inLanguage: "es-ES",
    url,
  };
}

export function itemListJsonLd(options: {
  name: string;
  path: string;
  items: Array<{ name: string; path: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: options.name,
    url: absoluteUrl(options.path),
    numberOfItems: options.items.length,
    itemListElement: options.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(item.path),
      name: item.name,
    })),
  };
}

/** Textos editoriales SEO para páginas de categoría (evita thin content). */
export function categorySeoCopy(
  slug: string,
  name: string,
): {
  intro: string;
  howWePick: string;
} {
  const known: Record<string, { intro: string; howWePick: string }> = {
    tecnologia: {
      intro: `Ofertas de ${name} en Amazon España con historial de precios, deal score y proximidad al mínimo histórico. Filtramos bajadas reales, no carteles engañosos.`,
      howWePick:
        "Priorizamos descuento frente a precio reciente, cercanía al mínimo histórico y estabilidad del precio en los últimos 30–90 días.",
    },
    informatica: {
      intro: `Chollos de ${name}: portátiles, monitores, periféricos y componentes con bajada verificada en Amazon España.`,
      howWePick:
        "Comparamos el precio actual con el histórico y el promedio reciente para señalar cuándo conviene comprar.",
    },
    hogar: {
      intro: `Ofertas de ${name} con seguimiento de precio. Electrodomésticos y utensilios cuando la bajada es real.`,
      howWePick:
        "Miramos el descuento, el mínimo histórico y si el precio se mantiene estable tras la caída.",
    },
    belleza: {
      intro: `Chollos de ${name} en Amazon: cuidado personal y belleza con alerta cuando bajan de verdad.`,
      howWePick:
        "Evita ofertas eternas: cruzamos precio actual, referencia y tendencia de las últimas semanas.",
    },
    deportes: {
      intro: `Ofertas de ${name} puntuadas por deal score. Material deportivo con historial transparente.`,
      howWePick:
        "El score combina ahorro absoluto, % de descuento y proximidad al mínimo histórico.",
    },
    moda: {
      intro: `Rebajas de ${name} en Amazon España con contexto de precio, no solo el porcentaje del cartel.`,
      howWePick:
        "Preferimos artículos cerca de su mínimo reciente y con stock habitual de Amazon.",
    },
    juguetes: {
      intro: `Ofertas de ${name} con seguimiento continuo. Ideal para cazar mínimos antes de campañas.`,
      howWePick:
        "Vigilamos picos y caídas estacionales para avisar cuando el precio vuelve a ser interesante.",
    },
  };

  return (
    known[slug] ?? {
      intro: `Ofertas de ${name} en Amazon España, ordenadas por deal score e historial de precios de CazaOferta.`,
      howWePick:
        "Seleccionamos chollos por descuento real, cercanía al mínimo histórico y estabilidad del precio.",
    }
  );
}
