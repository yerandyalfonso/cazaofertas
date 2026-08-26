interface ArticleContextNoteProps {
  reviewedAt: string;
  publishedAt: string;
}

export function ArticleContextNote({
  reviewedAt,
  publishedAt,
}: ArticleContextNoteProps) {
  return (
    <aside className="border border-stone-300 bg-stone-50/90 px-5 py-4 text-sm leading-relaxed text-stone-600">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
        Nota de contexto
      </p>
      <p className="mt-2">
        Revisado el <time dateTime={reviewedAt}>{reviewedAt}</time>
        {reviewedAt !== publishedAt ? (
          <>
            {" "}
            · publicado el <time dateTime={publishedAt}>{publishedAt}</time>
          </>
        ) : null}
        . Algunos enlaces son de afiliados: si compras a través de ellos,
        podemos recibir una comisión sin coste extra para ti.
      </p>
      <p className="mt-2">
        Los precios cambian: verifica siempre el importe final en Amazon antes
        de confirmar.
      </p>
    </aside>
  );
}
