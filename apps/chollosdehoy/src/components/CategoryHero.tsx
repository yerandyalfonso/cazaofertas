"use client";

import Image from "next/image";
import Link from "next/link";
import { BLOG_CATEGORIES } from "@/lib/taxonomy";
import type { CategoryFilterNode } from "@/lib/types";
import { categoryHref } from "@/lib/links";

interface CategoryHeroProps {
  categories: CategoryFilterNode[];
  totalProducts: number;
}

export function CategoryHero({ categories, totalProducts }: CategoryHeroProps) {
  const parents = categories
    .filter((c) => !c.parentId && c.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 8);

  const metaBySlug = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)] md:text-[1.75rem]">
        Chollos de hoy
      </h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {new Intl.NumberFormat("es-ES").format(totalProducts)} ofertas de Amazon,
        Miravia y otras tiendas, con el precio comprobado.
      </p>

      <ul className="mt-5 grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-8">
        {parents.map((cat) => {
          const meta = metaBySlug.get(cat.slug);
          return (
            <li key={cat.id}>
              <Link href={categoryHref(cat.slug)} className="group block text-center">
                <span className="relative block aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-[var(--surface-muted)]">
                  {meta?.image_url ? (
                    <Image
                      src={meta.image_url}
                      alt=""
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 25vw, 12vw"
                    />
                  ) : null}
                </span>
                <span className="mt-1.5 block text-xs font-medium leading-tight text-[var(--text)] group-hover:underline">
                  {cat.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
