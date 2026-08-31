import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DealCard } from "@/components/DealCard";
import { ProductCard } from "@/components/ProductCard";
import { RemoteImage } from "@/components/RemoteImage";
import {
  getActiveProducts,
  getCategories,
  getTopDealProducts,
} from "@/lib/catalog";
import { BLOG_IMAGES } from "@/lib/blog-images";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, buildPageMetadata } from "@/lib/seo";
import { telegramBotUrl } from "@/lib/telegram-links";
import { getFeaturedArticles, getPublishedArticles } from "@/services/blog";

export const revalidate = 300;

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: "/",
  }),
  title: {
    absolute: DEFAULT_TITLE,
  },
};

export default async function HomePage() {
  const [topDeals, latest, categories, featuredPosts, allPosts] =
    await Promise.all([
      getTopDealProducts(4),
      getActiveProducts(8, { orderBy: "created" }),
      getCategories(),
      getFeaturedArticles(),
      getPublishedArticles(),
    ]);

  const lead = featuredPosts[0] ?? allPosts[0];
  const secondary = featuredPosts.slice(1);
  const restPosts = lead
    ? allPosts.filter((post) => post.slug !== lead.slug).slice(0, 4)
    : [];
  const dealRail = (topDeals.length > 0 ? topDeals : latest).slice(0, 4);
  const latestGrid = latest.slice(0, 4);

  return (
    <div className="pb-20">
      {/* Editorial first screen: blog lead + magazine grid + deals as side complement */}
      <section className="border-b border-stone-300">
        <div className="mx-auto max-w-6xl px-5 pt-10 md:px-8 md:pt-14">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-300 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-800">
                CazaOferta · Revista
              </p>
              <h1 className="mt-3 font-display text-4xl leading-[0.95] tracking-tight text-ink md:text-6xl">
                Guías que cazan chollos.
              </h1>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-stone-600 md:text-right">
              Comparativas y métodos primero. Las ofertas del día acompañan la
              lectura, no la sustituyen.
            </p>
          </div>

          <div className="grid gap-10 py-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)] lg:gap-12 lg:py-14">
            {/* Lead reportaje */}
            <div className="min-w-0">
              {lead ? (
                <>
                  <Link
                    href={`/blog/${lead.slug}`}
                    prefetch={false}
                    className="group block animate-fade"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-stone-200 md:aspect-[16/9]">
                      <RemoteImage
                        src={lead.coverImage}
                        fallbackSrc={BLOG_IMAGES.laptopDeals}
                        alt={lead.coverAlt}
                        fill
                        priority
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                        sizes="(max-width: 1024px) 100vw, 65vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 md:p-8">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                          {lead.category} · {lead.readingTime}
                        </p>
                        <h2 className="mt-3 max-w-2xl font-display text-3xl leading-tight tracking-tight text-paper md:text-5xl">
                          {lead.title}
                        </h2>
                        <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-200 md:text-base">
                          {lead.excerpt}
                        </p>
                      </div>
                    </div>
                  </Link>

                  <div className="mt-10 grid gap-8 sm:grid-cols-2">
                    {(secondary.length > 0
                      ? secondary
                      : restPosts.slice(0, 2)
                    ).map((post, index) => (
                      <Link
                        key={post.slug}
                        href={`/blog/${post.slug}`}
                        prefetch={false}
                        className={`group animate-rise border-t border-stone-300 pt-5 ${
                          index === 0
                            ? "animate-rise-delay-1"
                            : "animate-rise-delay-2"
                        }`}
                      >
                        <div className="relative mb-4 aspect-[3/2] overflow-hidden bg-stone-200">
                          <RemoteImage
                            src={post.coverImage}
                            fallbackSrc={BLOG_IMAGES.laptopDeals}
                            alt={post.coverAlt}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                            sizes="(max-width: 640px) 100vw, 30vw"
                          />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                          {post.category} · {post.readingTime}
                        </p>
                        <h3 className="mt-2 font-display text-2xl leading-snug tracking-tight text-ink transition group-hover:text-teal-900">
                          {post.title}
                        </h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone-600">
                          {post.excerpt}
                        </p>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-sm text-stone-600">
                  Pronto publicaremos guías y comparativas. Mientras tanto,
                  echa un vistazo a las ofertas o crea una alerta en Telegram.
                </div>
              )}
            </div>

            {/* Lateral: ofertas como complemento */}
            <aside className="flex flex-col border-t border-stone-300 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <div className="mb-6 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                    Complemento
                  </p>
                  <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
                    Ofertas del día
                  </h2>
                </div>
                <Link
                  href="/ofertas"
                  className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-stone-500 underline-offset-4 hover:text-ink hover:underline"
                >
                  Ver todas
                </Link>
              </div>

              {dealRail.length > 0 ? (
                <div className="flex flex-1 flex-col gap-6">
                  {dealRail.map((product) => (
                    <DealCard key={product.id} product={product} compact />
                  ))}
                </div>
              ) : (
                <EmptyCatalogHint />
              )}

              <a
                href={telegramBotUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex h-11 items-center justify-center border border-ink bg-ink px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
              >
                Alertas Telegram
              </a>
            </aside>
          </div>
        </div>
      </section>

      {/* Más piezas editoriales */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
              Índice
            </p>
            <h2 className="mt-2 font-display text-3xl tracking-tight text-ink md:text-4xl">
              Más guías y artículos
            </h2>
          </div>
          <Link
            href="/blog"
            className="text-sm font-medium text-stone-600 underline-offset-4 hover:text-ink hover:underline"
          >
            Ir al blog
          </Link>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {restPosts.slice(0, 3).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              prefetch={false}
              className="group border-t border-stone-300 pt-5 transition hover:border-ink"
            >
              <div className="relative mb-4 aspect-[16/10] overflow-hidden bg-stone-200">
                <RemoteImage
                  src={post.coverImage}
                  fallbackSrc={BLOG_IMAGES.laptopDeals}
                  alt={post.coverAlt}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
                {post.category} · {post.readingTime}
              </p>
              <h3 className="mt-3 font-display text-2xl leading-snug tracking-tight text-ink transition group-hover:text-teal-900">
                {post.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-stone-600">
                {post.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Ofertas secundarias */}
      <section className="border-y border-stone-300 bg-white/70">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                Catálogo
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-tight text-ink">
                Bajadas recientes
              </h2>
            </div>
            <Link
              href="/ofertas"
              className="text-sm font-medium text-stone-600 underline-offset-4 hover:text-ink hover:underline"
            >
              Ver ofertas
            </Link>
          </div>
          {latestGrid.length > 0 ? (
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {latestGrid.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyCatalogHint />
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Categorías
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight text-ink">
            Explora por sección
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {(categories.length > 0
            ? categories
            : [
                { id: "1", name: "Tecnología", slug: "tecnologia" },
                { id: "2", name: "Hogar", slug: "hogar" },
                { id: "3", name: "Informática", slug: "informatica" },
                { id: "4", name: "Moda", slug: "moda" },
              ]
          ).map((category) => (
            <Link
              key={category.id}
              href={`/categorias/${category.slug}`}
              className="border border-stone-300 bg-white/80 px-5 py-6 transition hover:border-ink hover:bg-white"
            >
              <p className="font-display text-xl tracking-tight text-ink">
                {category.name}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-stone-500">
                Ver categoría
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-8 md:px-8">
        <div className="grid overflow-hidden border border-stone-300 bg-ink text-paper md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5 p-8 md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              Telegram
            </p>
            <h2 className="font-display text-3xl leading-tight tracking-tight md:text-4xl">
              Recibe solo las ofertas que te interesan.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-stone-300">
              Crea alertas por palabra clave o pegando la URL de Amazon. Sin
              ruido: solo bajadas que pasan el filtro de score.
            </p>
            <a
              href={telegramBotUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center bg-paper px-6 text-xs font-semibold uppercase tracking-[0.16em] text-ink transition hover:bg-amber-200"
            >
              Abrir bot
            </a>
          </div>
          <div className="relative min-h-56 border-t border-white/10 md:border-l md:border-t-0">
            <Image
              src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1000&q=80"
              alt="Alertas en el móvil"
              fill
              className="object-cover opacity-80"
              sizes="(max-width: 768px) 100vw, 40vw"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function EmptyCatalogHint() {
  return (
    <div className="border border-dashed border-stone-300 bg-white/60 px-6 py-10">
      <p className="text-sm text-stone-600">
        Estamos cazando ofertas. Vuelve pronto o activa alertas en Telegram
        para enterarte al momento.
      </p>
      <a
        href={telegramBotUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex h-10 items-center bg-ink px-4 text-xs font-semibold uppercase tracking-[0.12em] text-paper"
      >
        Abrir Telegram
      </a>
    </div>
  );
}
