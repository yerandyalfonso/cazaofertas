"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RemoteImage } from "@/components/RemoteImage";
import type { SearchResponse } from "@/app/api/search/route";
import { formatEuro } from "@/lib/money";

const EMPTY: SearchResponse = { articles: [], products: [] };

function SearchIcon({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return <Search aria-hidden strokeWidth={1.5} className={className} />;
}

export interface SearchSuggestions {
  topics: Array<{ name: string; slug: string }>;
  latest: Array<{ slug: string; title: string; category: string }>;
}

/** Resalta la primera coincidencia del texto buscado (sin tildes ni mayúsculas). */
function Highlight({ text, query }: { text: string; query: string }) {
  const fold = (value: string) =>
    value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const index = fold(text).indexOf(fold(query.trim()));
  if (!query.trim() || index < 0) return <>{text}</>;
  const end = index + query.trim().length;
  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-amber-100 text-inherit">{text.slice(index, end)}</mark>
      {text.slice(end)}
    </>
  );
}

const noop = () => () => {};

export function SiteSearch({ suggestions }: { suggestions: SearchSuggestions }) {
  // El panel se monta en <body>: la cabecera usa backdrop-blur, que convierte
  // sus hijos `fixed` en relativos a ella y dejaba los resultados ocultos.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Abrir con ⌘K / Ctrl+K y cerrar con Esc.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (response.ok) setResults((await response.json()) as SearchResponse);
      } catch {
        // Búsqueda cancelada o sin red: se mantienen los resultados anteriores.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const close = () => setOpen(false);
  const hasQuery = query.trim().length >= 2;
  const visible = hasQuery ? results : EMPTY;
  const nothing =
    hasQuery &&
    !loading &&
    visible.articles.length === 0 &&
    visible.products.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        title="Buscar (⌘K)"
        className="inline-flex h-10 w-10 items-center justify-center text-stone-600 transition hover:text-ink"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {open && mounted ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Buscar en la web"
          className="fixed inset-0 z-[60] flex flex-col"
        >
          <button
            type="button"
            aria-label="Cerrar buscador"
            onClick={close}
            className="absolute inset-0 cursor-default bg-ink/30 backdrop-blur-[2px]"
          />
          <div className="relative max-h-full overflow-y-auto border-b border-stone-300 bg-paper shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)] max-md:h-full">
            <div className="mx-auto max-w-6xl px-5 pb-8 pt-5 md:px-8 md:pt-8">
              <div className="flex items-center gap-3 border-b-2 border-ink pb-3">
                <SearchIcon className="h-6 w-6 shrink-0 text-stone-500" />
                <input
                  ref={inputRef}
                  id="site-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Busca artículos y ofertas…"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent font-display text-2xl text-ink outline-none placeholder:text-stone-400 md:text-3xl [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                />
                <button
                  type="button"
                  onClick={close}
                  className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 hover:text-ink"
                >
                  <span className="max-md:hidden">Esc · </span>Cerrar
                </button>
              </div>

              {!hasQuery ? (
                <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
                  {suggestions.topics.length > 0 ? (
                    <section>
                      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Explora por tema
                      </h2>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {suggestions.topics.map((topic) => (
                          <li key={topic.slug}>
                            <Link
                              href={`/blog?tema=${topic.slug}`}
                              onClick={close}
                              className="inline-flex h-9 items-center border border-stone-300 bg-white px-3 text-sm text-ink transition hover:border-ink"
                            >
                              {topic.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {suggestions.latest.length > 0 ? (
                    <section>
                      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                        Lo último del blog
                      </h2>
                      <ul className="mt-3 divide-y divide-stone-200">
                        {suggestions.latest.map((article) => (
                          <li key={article.slug}>
                            <Link
                              href={`/blog/${article.slug}`}
                              onClick={close}
                              className="block py-3 font-display text-lg leading-snug text-ink hover:text-teal-900"
                            >
                              {article.title}
                              <span className="mt-0.5 block font-sans text-xs text-stone-500">
                                {article.category}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
              ) : nothing ? (
                <p className="mt-6 text-sm text-stone-500">
                  No encontramos nada con «{query.trim()}». Prueba con otra
                  palabra.
                </p>
              ) : (
                <div
                  className={`mt-6 grid gap-8 md:grid-cols-2 md:gap-12 ${
                    loading ? "opacity-60" : ""
                  }`}
                  aria-live="polite"
                >
                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Artículos
                    </h2>
                    <ul className="mt-3 divide-y divide-stone-200">
                      {visible.articles.map((article) => (
                        <li key={article.slug}>
                          <Link
                            href={`/blog/${article.slug}`}
                            onClick={close}
                            className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 py-3"
                          >
                            <span className="relative aspect-[4/3] overflow-hidden bg-stone-200">
                              <RemoteImage
                                src={article.coverImage}
                                alt=""
                                fill
                                sizes="72px"
                                className="object-cover"
                              />
                            </span>
                            <span>
                              <span className="block font-display text-lg leading-snug text-ink group-hover:text-teal-900">
                                <Highlight text={article.title} query={query} />
                              </span>
                              <span className="text-xs text-stone-500">
                                {article.category} · {article.readingTime}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                      {visible.articles.length === 0 && !loading ? (
                        <li className="py-3 text-sm text-stone-500">
                          Sin artículos.
                        </li>
                      ) : null}
                    </ul>
                  </section>

                  <section>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Ofertas
                    </h2>
                    <ul className="mt-3 divide-y divide-stone-200">
                      {visible.products.map((product) => (
                        <li key={product.slug}>
                          <Link
                            href={`/producto/${product.slug}`}
                            onClick={close}
                            className="group grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 py-3"
                          >
                            <span className="relative aspect-square bg-white">
                              {product.imageUrl ? (
                                <RemoteImage
                                  src={product.imageUrl}
                                  alt=""
                                  fill
                                  sizes="72px"
                                  className="object-contain p-1.5"
                                />
                              ) : null}
                            </span>
                            <span className="min-w-0">
                              <span className="line-clamp-2 text-sm font-medium leading-snug text-ink group-hover:text-teal-900">
                                <Highlight text={product.title} query={query} />
                              </span>
                              <span className="mt-1 block text-sm tabular-nums">
                                <span className="font-semibold text-ink">
                                  {formatEuro(product.currentPrice)}
                                </span>
                                {product.discountPercentage > 0 ? (
                                  <span className="text-amber-800">
                                    {" "}
                                    · −{Math.round(product.discountPercentage)}%
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                      {visible.products.length === 0 && !loading ? (
                        <li className="py-3 text-sm text-stone-500">
                          Sin ofertas.
                        </li>
                      ) : null}
                    </ul>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
