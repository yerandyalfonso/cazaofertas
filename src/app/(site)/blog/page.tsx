import type { Metadata } from "next";
import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import { BlogIndexGrid } from "@/components/blog/BlogIndexGrid";
import { BLOG_IMAGES } from "@/lib/blog-images";
import { BLOG_NAME, buildPageMetadata } from "@/lib/seo";
import { topicSlug } from "@/lib/blog-topics";
import {
  getFeaturedArticles,
  getPublishedArticles,
} from "@/services/blog";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Blog",
    description:
      "Experiencias, recomendaciones y comparativas del día a día: un poco de todo.",
    path: "/blog",
    siteName: BLOG_NAME,
  }),
};

export const revalidate = 300;

/** Índice del blog también depende de Supabase; no bloquear el build. */
export const dynamic = "force-dynamic";

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const { tema } = await searchParams;
  const [allPosts, allFeatured] = await Promise.all([
    getPublishedArticles(),
    getFeaturedArticles(),
  ]);

  // Filtro por tema (/blog?tema=hogar) desde la fila de temas de la cabecera.
  const inTopic = (post: { category: string }) =>
    !tema || topicSlug(post.category) === tema;
  const posts = allPosts.filter(inTopic);
  const featured = allFeatured.filter(inTopic);
  const topicName = tema ? posts[0]?.category : undefined;

  const lead = featured[0] ?? posts[0] ?? null;
  const others = lead
    ? posts.filter((post) => post.slug !== lead.slug)
    : [];

  if (!lead) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <header className="max-w-2xl">
          <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
            Artículos
          </h1>
        </header>
        <div className="mt-12 border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-sm text-stone-600">
          {tema ? (
            <>
              Aún no hay artículos de este tema.{" "}
              <Link href="/blog" className="text-ink underline underline-offset-4">
                Ver todos los artículos
              </Link>
            </>
          ) : (
            "Pronto publicaremos nuevas guías y comparativas. Mientras tanto, revisa las ofertas o crea una alerta en Telegram."
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <header className="max-w-2xl">
        {topicName ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
            Tema
          </p>
        ) : null}
        <h1 className="mt-2 font-display text-4xl tracking-tight text-ink md:text-5xl">
          {topicName ?? "Artículos"}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          {topicName
            ? `${posts.length} ${posts.length === 1 ? "artículo" : "artículos"} sobre ${topicName.toLowerCase()}.`
            : "Experiencias, recomendaciones y comparativas del día a día. Un poco de todo."}
        </p>
      </header>

      <Link
        href={`/blog/${lead.slug}`}
        prefetch={false}
        className="group mt-12 block border-t border-stone-300 pt-8"
      >
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
            <RemoteImage
              src={lead.coverImage}
              fallbackSrc={BLOG_IMAGES.laptopDeals}
              alt={lead.coverAlt}
              fill
              priority
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">
              Destacado · {lead.category} · {lead.readingTime}
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight tracking-tight text-ink transition group-hover:text-teal-900 md:text-4xl">
              {lead.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-stone-600">
              {lead.excerpt}
            </p>
            <p className="mt-6 text-sm font-medium text-ink underline-offset-4 group-hover:underline">
              Leer reportaje
            </p>
          </div>
        </div>
      </Link>

      <BlogIndexGrid
        posts={others.map((post) => ({
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          category: post.category,
          readingTime: post.readingTime,
          coverImage: post.coverImage,
          coverAlt: post.coverAlt,
        }))}
      />
    </div>
  );
}
