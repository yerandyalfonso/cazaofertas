import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticleView } from "@/components/blog/BlogArticleView";
import {
  getArticleBySlug,
  getArticleSlugs,
} from "@/services/blog";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);
  if (!result) return { title: "Artículo no encontrado" };

  const { post } = result;
  const title = post.title;
  const description = post.excerpt;
  const image = post.coverImage;

  return {
    title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/blog/${slug}`,
      siteName: "CazaOferta",
      locale: "es_ES",
      images: image
        ? [{ url: image, alt: post.coverAlt || title }]
        : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);
  if (!result) notFound();

  return (
    <BlogArticleView post={result.post} products={result.products} />
  );
}
