import { RemoteImage } from "@/components/RemoteImage";
import Link from "next/link";
import { BlogContent } from "@/components/BlogContent";
import {
  BlogPullQuote,
  EditorialDivider,
} from "@/components/blog/EditorialChrome";
import { ProsCons } from "@/components/blog/ProsCons";
import { TelegramCategoryCta } from "@/components/blog/TelegramCategoryCta";
import { ArticleComments } from "@/components/blog/ArticleComments";
import { ArticleToc } from "@/components/blog/ArticleToc";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import { RelatedArticles } from "@/components/blog/RelatedArticles";
import { buildToc } from "@/lib/blog-toc";
import { BLOG_NAME } from "@/lib/seo";
import type { BlogPost } from "@/lib/blog";
import { resolveArticleMarketplaceCategory } from "@/lib/blog-marketplace";
import { BLOG_IMAGES } from "@/lib/blog-images";
import type { CatalogProduct } from "@/lib/catalog";
import {
  resolveBlogPresentation,
  type BlogPresentation,
} from "@/lib/blog-templates";

interface BlogArticleViewProps {
  post: BlogPost;
  products: CatalogProduct[];
  /** «Sigue leyendo» (vacío en la vista previa del admin). */
  related?: BlogPost[];
}

export function BlogArticleView({
  post,
  products,
  related = [],
}: BlogArticleViewProps) {
  const presentation = resolveBlogPresentation(post);
  const productsBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );
  const marketplaceCategory = resolveArticleMarketplaceCategory(products);
  const toc = buildToc(post.body, post.html);
  const hasToc = toc.length >= 3;
  const isAsymmetric = presentation.layout === "asymmetric";
  // El layout asimétrico ya usa la columna derecha para productos: índice plegable.
  const sidebarToc = hasToc && !isAsymmetric;

  const mainColumn = (
    <div className="min-w-0">
      <div className="mb-10 space-y-8 empty:hidden">
        {presentation.pullQuote ? (
          <>
            <BlogPullQuote text={presentation.pullQuote} />
            <EditorialDivider />
          </>
        ) : null}

        {hasToc ? (
          <div className={sidebarToc ? "lg:hidden" : undefined}>
            <ArticleToc entries={toc} variant="inline" />
          </div>
        ) : null}
      </div>

      <BlogContent
        blocks={post.body}
        html={post.html}
        relatedProductSlugs={
          post.relatedProductSlugs ?? products.map((product) => product.slug)
        }
        productsBySlug={productsBySlug}
        density={isAsymmetric ? "asymmetric" : "classic"}
        articleId={post.id}
      />

      {(presentation.pros.length > 0 || presentation.cons.length > 0) &&
      !post.body.some((block) => block.type === "prosCons") ? (
        <div className="mt-16 md:mt-20">
          <ProsCons pros={presentation.pros} cons={presentation.cons} />
        </div>
      ) : null}

      <div className="mt-20 space-y-6 md:mt-24">
        {marketplaceCategory ? (
          <a
            href={marketplaceCategory.href}
            className="flex items-center justify-between gap-4 border border-stone-300 bg-paper px-6 py-5 transition hover:border-ink"
          >
            <span>
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">
                Ofertas de hoy
              </span>
              <span className="mt-1 block font-display text-2xl text-ink">
                Ver ofertas de {marketplaceCategory.name.toLowerCase()}
              </span>
            </span>
            <span aria-hidden className="text-2xl text-ink">
              →
            </span>
          </a>
        ) : null}
        <TelegramCategoryCta
          category={marketplaceCategory?.name ?? post.category}
          categorySlug={marketplaceCategory?.slug}
        />
      </div>

      {related.length > 0 ? (
        <div className="mt-20 border-t border-stone-300 pt-12 md:mt-24">
          <RelatedArticles posts={related} />
        </div>
      ) : null}

      {post.id ? (
        <div className="mt-20 md:mt-24">
          <ArticleComments articleId={post.id} articleSlug={post.slug} />
        </div>
      ) : null}
    </div>
  );

  return (
    <article className="pb-20">
      <ReadingProgress />
      <ArticleHeader post={post} presentation={presentation} />

      <div
        className={
          isAsymmetric || sidebarToc
            ? "mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16"
            : "mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16"
        }
      >
        {sidebarToc ? (
          <div className="lg:grid lg:grid-cols-[200px_minmax(0,48rem)] lg:justify-center lg:gap-14">
            <aside className="hidden lg:block">
              <ArticleToc entries={toc} variant="sidebar" />
            </aside>
            {mainColumn}
          </div>
        ) : (
          mainColumn
        )}
      </div>
    </article>
  );
}

function formatPublishedDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function Byline({ post, className }: { post: BlogPost; className: string }) {
  return (
    <p className={className}>
      Por <span className="text-ink">{post.author ?? BLOG_NAME}</span>
      <span aria-hidden className="mx-2">
        ·
      </span>
      <time dateTime={post.publishedAt}>
        {formatPublishedDate(post.publishedAt)}
      </time>
    </p>
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
            <RemoteImage
              src={post.coverImage}
              fallbackSrc={BLOG_IMAGES.laptopDeals}
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
            <Byline post={post} className="mt-6 text-sm text-stone-500" />
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
              <RemoteImage
                src={post.coverImage}
                fallbackSrc={BLOG_IMAGES.laptopDeals}
                alt={post.coverAlt}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
            </div>
          </div>
          <Byline
            post={post}
            className="mt-8 border-t border-stone-300 py-4 text-sm text-stone-500"
          />
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
        <Byline post={post} className="mt-4 text-sm text-stone-500" />
      </div>

      <div className="relative mx-auto mt-10 aspect-[21/9] max-w-6xl overflow-hidden bg-stone-200 md:mt-14">
        <RemoteImage
          src={post.coverImage}
          fallbackSrc={BLOG_IMAGES.laptopDeals}
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
