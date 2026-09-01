import { renderArticleInlineText } from "@/lib/article-inline-markdown";

export function FaqBlock({
  title = "Preguntas frecuentes",
  items,
}: {
  title?: string;
  items: Array<{ question: string; answer: string }>;
}) {
  const visible = items.filter(
    (item) => item.question.trim() && item.answer.trim(),
  );
  if (visible.length === 0) return null;

  return (
    <section className="my-2 space-y-4" aria-labelledby="article-faq-title">
      <h2
        id="article-faq-title"
        className="font-display text-2xl tracking-tight text-ink md:text-3xl"
      >
        {title}
      </h2>
      <div className="space-y-3">
        {visible.map((item, index) => (
          <details
            key={`${index}-${item.question.slice(0, 24)}`}
            className="group border border-stone-200 bg-white open:shadow-sm"
          >
            <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-4">
                <span className="font-medium text-ink">{item.question}</span>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0 text-teal-800 transition-transform duration-200 group-open:rotate-180"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </summary>
            <div className="border-t border-stone-200 px-4 py-3 text-base leading-relaxed text-stone-700">
              {renderArticleInlineText(item.answer)}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
