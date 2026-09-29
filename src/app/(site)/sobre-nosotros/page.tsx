import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/seo";
import { telegramBotUrl } from "@/lib/telegram-links";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Sobre el blog",
    description:
      "Qué es Una mica de tot, cómo elegimos lo que recomendamos y cómo se financia el blog.",
    path: "/sobre-nosotros",
  }),
};

const PRINCIPLES = [
  {
    title: "Contamos lo bueno y lo malo",
    text: "Cada recomendación lleva sus pegas. Si algo no nos convence, lo decimos aunque esté rebajado.",
  },
  {
    title: "Solo bajadas reales",
    text: "Vigilamos los precios varias veces al día y comparamos con lo que costaban antes. Un cartel de −50 % no basta.",
  },
  {
    title: "Transparencia con los enlaces",
    text: "Algunos enlaces son de afiliado: si compras a través de ellos, podemos recibir una pequeña comisión sin coste extra para ti. No cambia lo que recomendamos.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
        Sobre el blog
      </p>
      <h1 className="mt-3 text-balance font-display text-4xl leading-[1.05] tracking-tight text-ink md:text-6xl">
        Un poco de todo, contado desde el <em className="italic">día a día</em>.
      </h1>

      <div className="mt-10 space-y-6 text-lg leading-relaxed text-stone-700">
        <p className="drop-cap">
          Una mica de tot —«un poco de todo», en catalán— es un blog de
          experiencias, recomendaciones y comparativas sobre las cosas que
          usamos cada día: la casa, la cocina, los niños, la tecnología o el
          cuidado personal.
        </p>
        <p>
          Escribimos sobre lo que probamos, lo que nos recomiendan y lo que
          comparamos antes de comprar. Y como a nadie le gusta pagar de más,
          cuando algo merece la pena buscamos dónde está más barato y lo
          vigilamos por ti.
        </p>
      </div>

      <section className="mt-16 border-t border-ink pt-10">
        <h2 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
          Cómo trabajamos
        </h2>
        <dl className="mt-8 divide-y divide-stone-300">
          {PRINCIPLES.map((item) => (
            <div
              key={item.title}
              className="grid gap-2 py-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-8"
            >
              <dt className="font-display text-xl text-ink">{item.title}</dt>
              <dd className="text-base leading-relaxed text-stone-600">
                {item.text}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16 flex flex-col gap-4 bg-ink p-8 text-paper md:flex-row md:items-end md:justify-between md:p-10">
        <div>
          <h2 className="font-display text-2xl tracking-tight md:text-3xl">
            ¿Te escribimos cuando baje algo?
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-stone-300">
            Dinos qué buscas en Telegram y te avisamos cuando su precio baje de
            verdad.
          </p>
        </div>
        <a
          href={telegramBotUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 shrink-0 items-center justify-center bg-paper px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-amber-200"
        >
          Crear alerta de precio
        </a>
      </section>

      <p className="mt-10 text-sm text-stone-500">
        ¿Quieres leer algo? Empieza por{" "}
        <Link href="/blog" className="text-ink underline underline-offset-4">
          los últimos artículos
        </Link>{" "}
        o mira las{" "}
        <Link href="/ofertas" className="text-ink underline underline-offset-4">
          ofertas del momento
        </Link>
        .
      </p>
    </div>
  );
}
