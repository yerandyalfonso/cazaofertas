import Link from "next/link";
import { telegramBotUrl } from "@/lib/telegram-links";

const NAV = [
  { href: "/ofertas", label: "Ofertas" },
  { href: "/categorias", label: "Categorías" },
  { href: "/blog", label: "Blog" },
] as const;

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-300/70 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5 md:h-20 md:px-8">
        <Link href="/" className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-xl tracking-tight text-ink md:text-[1.75rem]">
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

        <div className="flex items-center gap-2">
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
            className="inline-flex h-9 items-center bg-ink px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper transition hover:bg-teal-900 md:h-10 md:px-4 md:text-xs md:tracking-[0.14em]"
          >
            Alertas
          </a>
        </div>
      </div>
    </header>
  );
}
