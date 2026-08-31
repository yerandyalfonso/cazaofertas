import { telegramAlertForCategorySlug, telegramAlertForKeyword } from "@/lib/telegram-links";
import { telegramHintForCategory } from "@/lib/blog-templates";

interface TelegramCategoryCtaProps {
  category: string;
  categorySlug?: string | null;
}

const CATEGORY_SLUG_HINTS: Record<string, string> = {
  tecnología: "tecnologia",
  tecnologia: "tecnologia",
  hogar: "hogar",
  moda: "moda",
  belleza: "belleza",
  deportes: "deportes",
  juguetes: "juguetes",
  informática: "informatica",
  informatica: "informatica",
  ofertas: "tecnologia",
  guías: "tecnologia",
  guias: "tecnologia",
  análisis: "tecnologia",
  analisis: "tecnologia",
  oficina: "oficina",
  otros: "otros",
  "material escolar": "oficina",
  papelería: "oficina",
  papeleria: "oficina",
};

export function TelegramCategoryCta({
  category,
  categorySlug,
}: TelegramCategoryCtaProps) {
  const hint = telegramHintForCategory(category);
  const slug =
    categorySlug ??
    CATEGORY_SLUG_HINTS[category.trim().toLowerCase()] ??
    null;
  const href = slug
    ? telegramAlertForCategorySlug(slug)
    : telegramAlertForKeyword(hint);

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
            Abre el bot y continúa el wizard con esta categoría (o la keyword{" "}
            <span className="text-paper">“{hint}”</span>). Te avisamos cuando el
            score merezca la pena.
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 shrink-0 items-center justify-center bg-paper px-6 text-xs font-semibold uppercase tracking-[0.14em] text-ink transition hover:bg-amber-200"
        >
          Crear alerta Telegram
        </a>
      </div>
    </section>
  );
}
