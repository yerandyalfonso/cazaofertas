export function EditorialDivider() {
  return (
    <div className="flex items-center gap-4 py-2" aria-hidden>
      <span className="h-px flex-1 bg-stone-300" />
      <span className="h-1.5 w-1.5 rotate-45 bg-teal-800" />
      <span className="h-px flex-1 bg-stone-300" />
    </div>
  );
}

interface BlogPullQuoteProps {
  text: string;
  cite?: string;
}

export function BlogPullQuote({ text, cite }: BlogPullQuoteProps) {
  return (
    <blockquote className="relative border-l-2 border-teal-800 py-1 pl-5 md:pl-6">
      <p className="font-display text-2xl leading-snug tracking-tight text-ink md:text-3xl">
        {text}
      </p>
      {cite ? (
        <cite className="mt-3 block text-sm not-italic text-stone-500">
          — {cite}
        </cite>
      ) : null}
    </blockquote>
  );
}
