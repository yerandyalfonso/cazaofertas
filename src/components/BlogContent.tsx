import { RemoteImage } from "@/components/RemoteImage";
import { InlineDealCard } from "@/components/InlineDealCard";
import {
  BlogPullQuote,
  EditorialDivider,
} from "@/components/blog/EditorialChrome";
import { ProsCons } from "@/components/blog/ProsCons";
import type { BlogBlock } from "@/lib/blog";
import type { CatalogProduct } from "@/lib/catalog";

interface BlogContentProps {
  blocks: BlogBlock[];
  html?: string;
  relatedProductSlugs?: string[];
  productsBySlug: Map<string, CatalogProduct>;
  /** asymmetric = dos columnas en desktop para lectura + rail de productos */
  density?: "classic" | "asymmetric";
  articleId?: string | null;
}

export function BlogContent({
  blocks,
  html,
  relatedProductSlugs = [],
  productsBySlug,
  density = "classic",
  articleId,
}: BlogContentProps) {
  const relatedProducts = relatedProductSlugs
    .map((slug) => productsBySlug.get(slug))
    .filter((product): product is CatalogProduct => Boolean(product));

  const rawHtml = html?.trim() ?? "";
  const showRelatedAfterHtml =
    Boolean(rawHtml) &&
    relatedProducts.length > 0 &&
    blocks.length === 0 &&
    !rawHtml.startsWith("[") &&
    !rawHtml.startsWith("{");

  const safeHtml =
    rawHtml &&
    !rawHtml.startsWith("[") &&
    !rawHtml.startsWith("{") &&
    (rawHtml.includes("<") || rawHtml.includes("&lt;"))
      ? rawHtml
      : undefined;

  const articleColumn = (
    <div className="min-w-0 space-y-8">
      {safeHtml ? (
        <div
          className="blog-html space-y-6 text-base leading-relaxed text-stone-700 md:text-lg md:leading-8 [&_blockquote]:border-l-2 [&_blockquote]:border-teal-800 [&_blockquote]:pl-5 [&_blockquote]:font-display [&_blockquote]:text-2xl [&_blockquote]:text-ink [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:tracking-tight [&_h2]:text-ink md:[&_h2]:mt-16 md:[&_h2]:text-4xl [&_h3]:mt-10 [&_h3]:font-display [&_h3]:text-2xl [&_h3]:text-ink [&_h4]:mt-8 [&_h4]:font-display [&_h4]:text-xl [&_h4]:text-ink [&_hr]:my-10 [&_hr]:border-stone-300 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:text-stone-700 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      ) : null}

      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "paragraph") {
          return (
            <p
              key={key}
              className="text-base leading-relaxed text-stone-700 md:text-lg md:leading-8"
            >
              {block.text}
            </p>
          );
        }

        if (block.type === "heading") {
          if (block.level === 2) {
            return (
              <h2
                key={key}
                className={`font-display text-3xl tracking-tight text-ink md:text-4xl ${
                  index === 0 ? "" : "!mt-12 md:!mt-16"
                }`}
              >
                {block.text}
              </h2>
            );
          }

          if (block.level === 4) {
            return (
              <h4
                key={key}
                className={`font-display text-xl tracking-tight text-ink ${
                  index === 0 ? "" : "!mt-8"
                }`}
              >
                {block.text}
              </h4>
            );
          }

          return (
            <h3
              key={key}
              className={`font-display text-2xl tracking-tight text-ink ${
                index === 0 ? "" : "!mt-10"
              }`}
            >
              {block.text}
            </h3>
          );
        }

        if (block.type === "list") {
          const ListTag = block.style === "number" ? "ol" : "ul";
          return (
            <ListTag
              key={key}
              className={`space-y-2 pl-5 text-base leading-relaxed text-stone-700 md:text-lg md:leading-8 ${
                block.style === "number" ? "list-decimal" : "list-disc"
              }`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>{item}</li>
              ))}
            </ListTag>
          );
        }

        if (block.type === "image") {
          return (
            <figure key={key} className="space-y-3">
              <div className="relative aspect-[16/10] overflow-hidden bg-stone-200">
                <RemoteImage
                  src={block.src}
                  alt={block.alt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 720px"
                />
              </div>
              {block.caption ? (
                <figcaption className="text-sm text-stone-500">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          );
        }

        if (block.type === "blockquote") {
          return (
            <BlogPullQuote key={key} text={block.text} cite={block.cite} />
          );
        }

        if (block.type === "divider") {
          return <EditorialDivider key={key} />;
        }

        if (block.type === "prosCons") {
          return (
            <ProsCons
              key={key}
              pros={block.pros}
              cons={block.cons}
              title={block.title}
            />
          );
        }

        if (block.type === "product") {
          const product = productsBySlug.get(block.slug);
          if (!product) {
            return (
              <p
                key={key}
                className="border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500"
              >
                Producto no disponible en el catálogo por ahora.
              </p>
            );
          }

          return (
            <aside key={key} className="my-2">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                Oferta recomendada
              </p>
              <InlineDealCard
                product={product}
                articleId={articleId}
                clickSource="blog"
              />
            </aside>
          );
        }

        if (block.type === "productGrid") {
          const products = block.slugs
            .map((slug) => productsBySlug.get(slug))
            .filter((product): product is CatalogProduct => Boolean(product));

          if (products.length === 0) {
            return (
              <p
                key={key}
                className="border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm text-stone-500"
              >
                Las fichas de producto aún no están en el catálogo.
              </p>
            );
          }

          return (
            <aside key={key} className="my-2 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                Productos citados
              </p>
              <div className="flex flex-col gap-3">
                {products.map((product) => (
                  <InlineDealCard
                    key={product.id}
                    product={product}
                    articleId={articleId}
                    clickSource="blog"
                  />
                ))}
              </div>
            </aside>
          );
        }

        return null;
      })}

      {showRelatedAfterHtml && density !== "asymmetric" ? (
        <aside className="my-2 space-y-3">
          <EditorialDivider />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            Productos citados
          </p>
          <div className="flex flex-col gap-3">
            {relatedProducts.map((product) => (
              <InlineDealCard
                key={product.id}
                product={product}
                articleId={articleId}
                clickSource="blog"
              />
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );

  if (density === "asymmetric" && relatedProducts.length > 0) {
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start">
        {articleColumn}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
            En este análisis
          </p>
          <div className="flex flex-col gap-4">
            {relatedProducts.map((product) => (
              <InlineDealCard
                key={product.id}
                product={product}
                variant="sidebar"
                articleId={articleId}
                clickSource="blog"
              />
            ))}
          </div>
        </aside>
      </div>
    );
  }

  return articleColumn;
}
