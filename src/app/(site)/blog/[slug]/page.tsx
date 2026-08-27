import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticleView } from "@/components/blog/BlogArticleView";
import { JsonLd } from "@/components/JsonLd";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  buildPageMetadata,
} from "@/lib/seo";
import { getArticleBySlug } from "@/services/blog";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

/** CMS + Supabase: no prerender en build (evita timeouts de 60s en Vercel). */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);
  if (!result) {
    return {
      title: "Artículo no encontrado",
      robots: { index: false, follow: true },
    };
  }

  const { post } = result;
  const title = post.seoTitle?.trim() || post.title;
  const description = post.seoDescription?.trim() || post.excerpt;

  return buildPageMetadata({
    title,
    description,
    path: `/blog/${slug}`,
    image: post.coverImage,
    type: "article",
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const result = await getArticleBySlug(slug);
  if (!result) notFound();

  const { post, products } = result;

  return (
    <>
      <JsonLd
        data={[
          articleJsonLd(post),
          breadcrumbJsonLd([
            { name: "Inicio", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />
      <BlogArticleView post={post} products={products} />
    </>
  );
}
