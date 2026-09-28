interface ProsConsProps {
  pros: string[];
  cons: string[];
  title?: string;
  className?: string;
}

export function ProsCons({
  pros,
  cons,
  title = "Pros y contras",
  className = "",
}: ProsConsProps) {
  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <section aria-label={title} className={`border-y border-ink py-8 ${className}`}>
      <h2 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
        {title}
      </h2>
      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-0 md:divide-x md:divide-stone-300">
        <ProsConsColumn
          label="A favor"
          items={pros}
          sign="+"
          signClass="border-teal-800 text-teal-800"
          className="md:pr-8"
        />
        <ProsConsColumn
          label="En contra"
          items={cons}
          sign="−"
          signClass="border-stone-400 text-stone-500"
          className="md:pl-8"
        />
      </div>
    </section>
  );
}

function ProsConsColumn({
  label,
  items,
  sign,
  signClass,
  className,
}: {
  label: string;
  items: string[];
  sign: string;
  signClass: string;
  className: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={className}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </h3>
      <ul className="mt-4 divide-y divide-stone-200">
        {items.map((item) => (
          <li
            key={item}
            className="flex gap-3 py-3 text-base leading-relaxed text-stone-700 first:pt-0"
          >
            <span
              aria-hidden
              className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-sm leading-none ${signClass}`}
            >
              {sign}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
