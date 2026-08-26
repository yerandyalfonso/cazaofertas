import Image from "next/image";
import Link from "next/link";
import { BlogContent } from "@/components/BlogContent";
import { ArticleContextNote } from "@/components/blog/ArticleContextNote";
import {
  BlogPullQuote,
  EditorialDivider,
} from "@/components/blog/EditorialChrome";
import { ProsCons } from "@/components/blog/ProsCons";
import { TelegramCategoryCta } from "@/components/blog/TelegramCategoryCta";
import type { BlogPost } from "@/lib/blog";
import type { CatalogProduct } from "@/lib/catalog";
import {
  resolveBlogPresentation,
  type BlogPresentation,
} from "@/lib/blog-templates";

interface BlogArticleViewProps {
  post: BlogPost;
  products: CatalogProduct[];
}

export function BlogArticleView({ post, products }: BlogArticleViewProps) {
  const presentation = resolveBlogPresentation(post);
  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );

  return (
    <article className="pb-20">
      <ArticleHeader post={post} presentation={presentation} />

      <div
        className={
          presentation.layout === "asymmetric"
            ? "mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16"
            : "mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16"
        }
      >
        <div className="mb-8 space-y-8">
          <ArticleContextNote
            reviewedAt={presentation.reviewedAt}
            publishedAt={post.publishedAt}
          />

          {presentation.pullQuote ? (
            <>
              <BlogPullQuote text={presentation.pullQuote} />
              <EditorialDivider />
            </>
          ) : null}
        </div>

        <BlogContent
          blocks={post.body}
          html={post.html}
          relatedProductSlugs={
            post.relatedProductSlugs ??
            products.map((product) => product.slug)
          }
          productsBySlug={productsBySlug}
          density={
            presentation.layout === "asymmetric" ? "asymmetric" : "classic"
          }
        />

        {(presentation.pros.length > 0 || presentation.cons.length > 0) &&
        !post.body.some((block) => block.type === "prosCons") ? (
          <div className="mt-12 space-y-8">
            <EditorialDivider />
            <ProsCons pros={presentation.pros} cons={presentation.cons} />
          </div>
        ) : null}

        <div className="mt-14 space-y-8">
          <EditorialDivider />
          <TelegramCategoryCta category={post.category} />
          <ArticleContextNote
            reviewedAt={presentation.reviewedAt}
            publishedAt={post.publishedAt}
          />
        </div>
      </div>
    </article>
  );
}

function ArticleHeader({
  post,
  presentation,
}: {
  post: BlogPost;
  presentation: BlogPresentation;
}) {
  const meta = (
    <>
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/blog" className="hover:text-ink">
          Blog
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{post.category}</span>
      </nav>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
        {presentation.templateLabel} · {post.category} · {post.readingTime}
      </p>
    </>
  );

  if (presentation.layout === "split-hero") {
    return (
      <header className="border-b border-stone-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:grid-cols-2 md:items-end md:gap-12 md:px-8 md:py-14">
          <div className="relative aspect-[4/5] overflow-hidden bg-stone-200 md:aspect-[5/6]">
            <Image
              src={post.coverImage}
              alt={post.coverAlt}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div className="pb-2">
            {meta}
            <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight text-ink md:text-5xl lg:text-6xl">
              {post.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-stone-600">
              {post.excerpt}
            </p>
            <p className="mt-6 text-sm text-stone-500">
              Publicado {post.publishedAt}
              {presentation.reviewedAt !== post.publishedAt
                ? ` · Revisado ${presentation.reviewedAt}`
                : null}
            </p>
          </div>
        </div>
      </header>
    );
  }

  if (presentation.layout === "asymmetric") {
    return (
      <header className="border-b border-stone-300">
        <div className="mx-auto max-w-6xl px-5 pt-10 md:px-8 md:pt-14">
          {meta}
          <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-ink md:text-5xl lg:text-6xl">
                {post.title}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-stone-600">
                {post.excerpt}
              </p>
            </div>
            <div className="relative aspect-[16/11] overflow-hidden bg-stone-200 lg:aspect-[5/4]">
              <Image
                src={post.coverImage}
                alt={post.coverAlt}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          </div>
          <div className="mt-8 flex items-center gap-3 border-t border-stone-300 py-4 text-sm text-stone-500">
            <span>{post.publishedAt}</span>
            <span aria-hidden>·</span>
            <span>Revisión {presentation.reviewedAt}</span>
          </div>
        </div>
      </header>
    );
  }

  // classic
  return (
    <header className="border-b border-stone-300">
      <div className="mx-auto max-w-6xl px-5 pt-10 md:px-8 md:pt-14">
        {meta}
        <h1 className="mt-4 max-w-4xl font-display text-4xl leading-[1.05] tracking-tight text-ink md:text-6xl">
          {post.title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-stone-600">
          {post.excerpt}
        </p>
        <p className="mt-4 text-sm text-stone-500">
          Publicado {post.publishedAt}
          {presentation.reviewedAt !== post.publishedAt
            ? ` · Revisado ${presentation.reviewedAt}`
            : null}
        </p>
      </div>

      <div className="relative mx-auto mt-10 aspect-[21/9] max-w-6xl overflow-hidden bg-stone-200 md:mt-14">
        <Image
          src={post.coverImage}
          alt={post.coverAlt}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </div>
    </header>
  );
}
