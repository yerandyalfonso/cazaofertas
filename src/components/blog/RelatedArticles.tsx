import Link from "next/link";
import { RemoteImage } from "@/components/RemoteImage";
import type { BlogPost } from "@/lib/blog";
import { BLOG_IMAGES } from "@/lib/blog-images";

export function RelatedArticles({
  posts,
  title = "Sigue leyendo",
}: {
  posts: BlogPost[];
  title?: string;
}) {
  if (posts.length === 0) return null;

  return (
    <section aria-labelledby="sigue-leyendo">
      <p
        id="sigue-leyendo"
        className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800"
      >
        {title}
      </p>
      <div className="mt-6 grid gap-8 sm:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            prefetch={false}
            className="group flex flex-col"
          >
            <div className="relative mb-4 aspect-[16/10] overflow-hidden bg-stone-200">
              <RemoteImage
                src={post.coverImage}
                fallbackSrc={BLOG_IMAGES.laptopDeals}
                alt={post.coverAlt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                sizes="(max-width: 640px) 100vw, 260px"
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
              {post.category} · {post.readingTime}
            </p>
            <h3 className="mt-2 font-display text-lg leading-snug tracking-tight text-ink transition group-hover:text-teal-900">
              {post.title}
            </h3>
          </Link>
        ))}
      </div>
    </section>
  );
}
