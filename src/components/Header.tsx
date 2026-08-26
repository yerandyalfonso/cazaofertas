import Link from "next/link";
import { TELEGRAM_BOT_URL } from "@/lib/catalog";

const NAV = [
  { href: "/ofertas", label: "Ofertas" },
  { href: "/categorias", label: "Categorías" },
  { href: "/blog", label: "Blog" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-300/70 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 md:h-20 md:px-8">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-2xl tracking-tight text-ink md:text-[1.75rem]">
            CazaOferta
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-stone-500 sm:inline">
            Revista de chollos
          </span>
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

        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center bg-ink px-4 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-teal-900"
        >
          Alertas
        </a>
      </div>

      <nav className="flex gap-5 overflow-x-auto border-t border-stone-200 px-5 py-3 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap text-sm font-medium text-stone-600"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
