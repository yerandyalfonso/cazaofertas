"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@/lib/blog-toc";

interface ArticleTocProps {
  entries: TocEntry[];
  /** sidebar = columna fija en desktop; inline = desplegable sobre el texto. */
  variant: "sidebar" | "inline";
}

function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const headings = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      () => {
        let current: string | null = null;
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top <= 140) current = heading.id;
        }
        setActive(current);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: [0, 1] },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [ids]);

  return active;
}

export function ArticleToc({ entries, variant }: ArticleTocProps) {
  const active = useActiveHeading(entries.map((entry) => entry.id));

  const links = (
    <ol className="space-y-2.5 text-sm leading-snug">
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            aria-current={active === entry.id ? "location" : undefined}
            className={`block transition-colors hover:text-ink ${
              active === entry.id ? "font-semibold text-ink" : "text-stone-500"
            }`}
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "sidebar") {
    return (
      <nav aria-label="En este artículo" className="sticky top-28">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
          En este artículo
        </p>
        {links}
      </nav>
    );
  }

  return (
    <details className="group border-y border-stone-300 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-stone-500 [&::-webkit-details-marker]:hidden">
        En este artículo
        <span aria-hidden className="text-base transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <nav aria-label="En este artículo" className="mt-4">
        {links}
      </nav>
    </details>
  );
}
