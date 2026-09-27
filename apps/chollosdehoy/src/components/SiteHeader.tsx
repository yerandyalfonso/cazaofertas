import Form from "next/form";
import Link from "next/link";
import { Search, Ticket } from "lucide-react";

/**
 * Barra fija de las páginas interiores (ficha, listados, cupones, 404): marca,
 * buscador que lleva a la portada con ?q= y acceso a cupones.
 */
export function SiteHeader() {
  return (
    <header className="hero-header sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:flex-nowrap">
        <Link
          href="/"
          className="flex min-h-11 items-center text-lg font-bold tracking-tight text-ink md:text-xl"
        >
          Chollos de Hoy
        </Link>

        <Form
          action="/"
          role="search"
          className="hero-toolbar-search order-last w-full rounded-control border border-line bg-surface md:order-none md:w-auto md:flex-1"
        >
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            name="q"
            autoComplete="off"
            enterKeyHint="search"
            spellCheck={false}
            placeholder="Buscar productos, marcas, categorías…"
            aria-label="Buscar ofertas"
          />
        </Form>

        <Link href="/cupones" className="btn btn-ghost ml-auto shrink-0 bg-surface text-sm shadow-card md:ml-0">
          <Ticket className="h-4 w-4 text-vivid" aria-hidden />
          Cupones
        </Link>
      </div>
    </header>
  );
}
