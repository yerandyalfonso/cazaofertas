import Link from "next/link";
import { TELEGRAM_BOT_URL } from "@/lib/catalog";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-stone-300 bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
        <div className="space-y-4">
          <p className="font-display text-3xl tracking-tight">CazaOferta</p>
          <p className="max-w-sm text-sm leading-relaxed text-stone-300">
            Revista digital de ofertas de Amazon España. Detectamos bajadas
            reales y te avisamos por Telegram.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
            Explorar
          </p>
          <ul className="space-y-2 text-sm text-stone-200">
            <li>
              <Link href="/ofertas" className="hover:text-white">
                Ofertas
              </Link>
            </li>
            <li>
              <Link href="/categorias" className="hover:text-white">
                Categorías
              </Link>
            </li>
            <li>
              <Link href="/blog" className="hover:text-white">
                Blog
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
            Alertas
          </p>
          <p className="text-sm leading-relaxed text-stone-300">
            Recibe solo los chollos que te interesan.
          </p>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center bg-paper px-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-amber-200"
          >
            Abrir Telegram
          </a>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-5 text-xs text-stone-400 md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} CazaOferta. Como afiliados de Amazon
            ganamos comisión por compras cualificadas.
          </p>
          <p>Precios sujetos a cambio en Amazon.</p>
        </div>
      </div>
    </footer>
  );
}
