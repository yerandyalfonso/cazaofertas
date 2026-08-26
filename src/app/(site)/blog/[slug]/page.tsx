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
  return { title: result.post.title, description: result.post.excerpt };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);
  if (!result) notFound();

  return (
    <BlogArticleView post={result.post} products={result.products} />
  );
}
