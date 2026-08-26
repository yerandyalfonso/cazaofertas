import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col justify-center px-5 py-16 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
        404
      </p>
      <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
        No encontramos esta página
      </h1>
      <p className="mt-4 text-base leading-relaxed text-stone-600">
        Puede que el enlace haya caducado o que la oferta ya no esté publicada.
        Vuelve al inicio o explora el catálogo.
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
    </div>
  );
}
