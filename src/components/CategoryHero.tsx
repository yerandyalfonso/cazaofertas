import Link from "next/link";
import { Package } from "lucide-react";
import { CATEGORY_ICONS } from "@/components/CategoryShowcaseGrid";
import { telegramAlertForCategorySlug } from "@/lib/telegram-links";

interface CategoryHeroProps {
  /** Categoría raíz (para el icono y la alerta). */
  rootSlug: string;
  rootName: string;
  title: string;
  intro: string;
  count: number;
  /** Subcategorías de la raíz; `activeSub` null = «Todo». */
  subcategories: Array<{ name: string; href: string; slug: string }>;
  activeSub: string | null;
  /** Migas: la última es la página actual. */
  crumbs: Array<{ name: string; href?: string }>;
}

/** Cabecera común de las páginas de categoría y subcategoría. */
export function CategoryHero({
  rootSlug,
  rootName,
  title,
  intro,
  count,
  subcategories,
  activeSub,
  crumbs,
}: CategoryHeroProps) {
  const Icon = CATEGORY_ICONS[rootSlug] ?? Package;
  const tabClass = (on: boolean) =>
    `shrink-0 border-b-2 py-3 text-sm transition-colors ${
      on
        ? "border-ink font-semibold text-ink"
        : "border-transparent text-stone-600 hover:text-ink"
    }`;

  return (
    <>
      <nav className="mb-8 text-sm text-stone-500" aria-label="Migas de pan">
        {crumbs.map((crumb, index) => (
          <span key={crumb.name}>
            {index > 0 ? <span className="mx-2">/</span> : null}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-ink">
                {crumb.name}
              </Link>
            ) : (
              <span className="text-ink">{crumb.name}</span>
            )}
          </span>
        ))}
      </nav>

      <header className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-8">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-stone-200/70 text-stone-600 md:h-20 md:w-20">
          <Icon aria-hidden strokeWidth={1.3} className="h-7 w-7 md:h-9 md:w-9" />
        </span>
        <div className="max-w-3xl">
          <h1 className="text-balance font-display text-4xl tracking-tight text-ink md:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-stone-600">
            {intro}
          </p>
          <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="text-stone-500">
              <span className="font-medium tabular-nums text-ink">{count}</span>{" "}
              {count === 1 ? "oferta activa" : "ofertas activas"}
            </span>
            <a
              href={telegramAlertForCategorySlug(rootSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline underline-offset-4 hover:text-teal-900"
            >
              Avísame de nuevas ofertas de {rootName.toLowerCase()} →
            </a>
          </p>
        </div>
      </header>

      {subcategories.length > 0 ? (
        <nav
          aria-label="Subcategorías"
          className="mt-10 flex gap-6 overflow-x-auto border-b border-stone-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link href={`/categorias/${rootSlug}`} className={tabClass(activeSub === null)}>
            Todo
          </Link>
          {subcategories.map((sub) => (
            <Link
              key={sub.slug}
              href={sub.href}
              className={tabClass(activeSub === sub.slug)}
            >
              {sub.name}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
