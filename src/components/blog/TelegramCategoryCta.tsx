import { TELEGRAM_BOT_URL } from "@/lib/catalog";
import { telegramHintForCategory } from "@/lib/blog-templates";

interface TelegramCategoryCtaProps {
  category: string;
}

export function TelegramCategoryCta({ category }: TelegramCategoryCtaProps) {
  const hint = telegramHintForCategory(category);

  return (
    <section className="overflow-hidden border border-stone-300 bg-ink text-paper">
      <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_auto] md:items-end md:p-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
            Alertas · {category}
          </p>
          <h2 className="mt-3 font-display text-2xl leading-tight tracking-tight md:text-3xl">
            ¿Quieres avisos solo de {category.toLowerCase()}?
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-300">
            En el bot, crea una alerta con la keyword{" "}
            <span className="text-paper">“{hint}”</span> (o la marca que
            sigues). Te avisamos cuando el score de la oferta merezca la pena.
          </p>
        </div>
        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 shrink-0 items-center justify-center bg-paper px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-amber-200"
        >
          Abrir bot Telegram
        </a>
      </div>
    </section>
  );
}
