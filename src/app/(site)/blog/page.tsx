import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  getFeaturedArticles,
  getPublishedArticles,
} from "@/services/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guías, comparativas y métodos para cazar ofertas reales en Amazon España.",
};

export const revalidate = 300;

export default async function BlogPage() {
  const [posts, featured] = await Promise.all([
    getPublishedArticles(),
    getFeaturedArticles(),
  ]);

  const lead = featured[0] ?? posts[0] ?? null;
  const others = lead
    ? posts.filter((post) => post.slug !== lead.slug)
    : [];

  if (!lead) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <header className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
            Editorial
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
            Guías y comparativas
          </h1>
        </header>
        <div className="mt-12 border border-dashed border-stone-300 bg-white/70 px-6 py-12 text-sm text-stone-600">
          Todavía no hay artículos publicados. Ejecuta{" "}
          <code className="rounded bg-stone-200 px-1.5 py-0.5">
            npm run seed:blog
          </code>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
          Editorial
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
          Guías y comparativas
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          Lecturas con fichas de producto embebidas: compara, decide y compra
          sin salir del artículo.
        </p>
      </header>

      <Link
        href={`/blog/${lead.slug}`}
        className="group mt-12 block border-t border-stone-300 pt-8"
      >
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
            <Image
              src={lead.coverImage}
              alt={lead.coverAlt}
              fill
              priority
              className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
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

      <div className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
        {others.map((post) => (
          <article key={post.slug} className="flex flex-col">
            <Link
              href={`/blog/${post.slug}`}
              className="group flex flex-1 flex-col"
            >
              <div className="relative mb-5 aspect-[16/10] overflow-hidden bg-stone-200">
                <Image
                  src={post.coverImage}
                  alt={post.coverAlt}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                {post.category} · {post.readingTime}
              </p>
              <h2 className="mt-3 font-display text-2xl leading-snug tracking-tight text-ink transition group-hover:text-teal-900">
                {post.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">
                {post.excerpt}
              </p>
              <span className="mt-5 text-sm font-medium text-ink underline-offset-4 group-hover:underline">
                Leer artículo
              </span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
