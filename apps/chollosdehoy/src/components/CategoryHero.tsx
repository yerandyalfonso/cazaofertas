"use client";

import Image from "next/image";
import Link from "next/link";
import { BLOG_CATEGORIES } from "@/lib/taxonomy";
import type { CategoryFilterNode } from "@/lib/types";
import { categoryHref } from "@/lib/links";

interface CategoryHeroProps {
  categories: CategoryFilterNode[];
}

export function CategoryHero({ categories }: CategoryHeroProps) {
  const parents = categories
    .filter((c) => !c.parentId && c.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 8);

  const metaBySlug = new Map(BLOG_CATEGORIES.map((c) => [c.slug, c]));

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary-soft)] to-[var(--surface)] px-5 py-5 md:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary)]">
          Explora por categoría
        </p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text)] md:text-2xl">
          ¿Qué estás buscando hoy?
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Elige una categoría para ver sus mejores ofertas.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {parents.map((cat) => {
          const meta = metaBySlug.get(cat.slug);

          return (
            <Link
              key={cat.id}
              href={categoryHref(cat.slug)}
              className="group relative overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] text-left transition hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-sm)]"
            >
              <div className="relative aspect-[16/10] bg-[var(--surface-muted)]">
                {meta?.image_url ? (
                  <Image
                    src={meta.image_url}
                    alt={cat.name}
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-sm font-semibold text-white">{cat.name}</p>
                  <p className="text-xs text-white/80">{cat.productCount} ofertas</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

    </section>
  );
}
