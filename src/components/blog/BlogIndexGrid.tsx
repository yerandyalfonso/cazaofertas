"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RemoteImage } from "@/components/RemoteImage";
import { BLOG_IMAGES } from "@/lib/blog-images";

export interface BlogCardData {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readingTime: string;
  coverImage: string;
  coverAlt: string;
}

const PAGE_SIZE = 9;

/** Rejilla del índice con carga progresiva al hacer scroll (y botón de respaldo). */
export function BlogIndexGrid({ posts }: { posts: BlogCardData[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visible < posts.length;

  const loadMore = useCallback(() => {
    setVisible((count) => Math.min(count + PAGE_SIZE, posts.length));
  }, [posts.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore, visible]);

  if (posts.length === 0) return null;

  return (
    <>
      <div className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, visible).map((post) => (
          <article key={post.slug} className="flex flex-col">
            <Link
              href={`/blog/${post.slug}`}
              prefetch={false}
              className="group flex flex-1 flex-col"
            >
              <div className="relative mb-5 aspect-[16/10] overflow-hidden bg-stone-200">
                <RemoteImage
                  src={post.coverImage}
                  fallbackSrc={BLOG_IMAGES.laptopDeals}
                  alt={post.coverAlt}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
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

      {hasMore ? (
        <div
          ref={sentinelRef}
          className="mt-16 flex flex-col items-center gap-3 border-t border-stone-300 pt-8"
        >
          <button
            type="button"
            onClick={loadMore}
            className="h-12 border border-ink px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-ink hover:text-paper"
          >
            Cargar más artículos
          </button>
          <p className="text-sm text-stone-500" aria-live="polite">
            Mostrando {visible} de {posts.length}
          </p>
        </div>
      ) : null}
    </>
  );
}
