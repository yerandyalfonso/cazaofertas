interface ProsConsProps {
  pros: string[];
  cons: string[];
  title?: string;
}

export function ProsCons({
  pros,
  cons,
  title = "Pros y contras",
}: ProsConsProps) {
  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <section className="border border-stone-300 bg-white">
      <div className="border-b border-stone-200 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-800">
          {title}
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-stone-200 px-5 py-5 md:border-b-0 md:border-r">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-teal-900">
            A favor
          </p>
          <ul className="space-y-2.5">
            {pros.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-sm leading-relaxed text-stone-700"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-700"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            En contra
          </p>
          <ul className="space-y-2.5">
            {cons.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 text-sm leading-relaxed text-stone-700"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-stone-400"
                  aria-hidden
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
