import Link from "next/link";
import { BlogLogo } from "@/components/blog/BlogLogo";
import { SiteSearch } from "@/components/SiteSearch";
import { getBlogTopics, getPublishedArticlesCached } from "@/services/blog";
import { telegramBotUrl } from "@/lib/telegram-links";

const NAV = [
  { href: "/blog", label: "Blog" },
  { href: "/ofertas", label: "Ofertas" },
] as const;

export async function Header() {
  const [topics, posts] = await Promise.all([
    getBlogTopics(),
    getPublishedArticlesCached().catch(() => []),
  ]);
  const suggestions = {
    topics: topics.map(({ name, slug }) => ({ name, slug })),
    latest: [...posts]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 3)
      .map(({ slug, title, category }) => ({ slug, title, category })),
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-300/70 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 md:h-20 md:px-8">
        <Link href="/" className="flex min-w-0 items-center">
          <BlogLogo size="nav" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-stone-600 transition hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 md:gap-2">
          <SiteSearch suggestions={suggestions} />
          <details className="relative md:hidden">
            <summary className="list-none cursor-pointer px-2 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-stone-600 [&::-webkit-details-marker]:hidden">
              Menú
            </summary>
            <div className="absolute right-0 mt-2 w-44 border border-stone-300 bg-paper p-2 shadow-lg">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
          <a
            href={telegramBotUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 bg-ink px-3 text-xs font-semibold uppercase tracking-[0.12em] text-paper transition hover:bg-teal-900 md:h-10 md:px-4 md:tracking-[0.14em]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
              className="h-3.5 w-3.5 max-sm:hidden"
            >
              <path d="M21.4 4.2 2.9 11.3c-1.3.5-1.3 1.2-.2 1.5l4.7 1.5 1.8 5.6c.2.6.1.9.8.9.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.7c.3-1.3-.5-1.9-1.5-1.4Z" />
            </svg>
            <span className="sm:hidden">Alertas</span>
            <span className="max-sm:hidden">Alertas de precio</span>
          </a>
        </div>
      </div>
    </header>
  );
}
