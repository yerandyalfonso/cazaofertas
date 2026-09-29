import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getPublishedArticlesCached } from "@/services/blog";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  const latest = await getPublishedArticlesCached()
    .then((posts) =>
      [...posts]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 3),
    )
    .catch(() => []);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-5 py-16 md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
            404
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
            No encontramos esta página
          </h1>
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            Puede que el enlace haya caducado o que la oferta ya no esté
            publicada. Usa el buscador de arriba o empieza por lo último del
            blog.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex h-11 items-center bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper"
            >
              Inicio
            </Link>
            <Link
              href="/ofertas"
              className="inline-flex h-11 items-center border border-stone-300 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink"
            >
              Ver ofertas
            </Link>
            <Link
              href="/blog"
              className="inline-flex h-11 items-center border border-stone-300 px-5 text-xs font-semibold uppercase tracking-[0.14em] text-ink"
            >
              Blog
            </Link>
          </div>

          {latest.length > 0 ? (
            <section className="mt-14 border-t border-stone-300 pt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                Lo último del blog
              </h2>
              <ul className="mt-3 divide-y divide-stone-200">
                {latest.map((post) => (
                  <li key={post.slug}>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="block py-3 font-display text-lg leading-snug text-ink hover:text-teal-900"
                    >
                      {post.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
