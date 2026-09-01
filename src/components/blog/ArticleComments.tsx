"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { renderArticleInlineText } from "@/lib/article-inline-markdown";

interface PublicComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  adminReply: string | null;
  adminRepliedAt: string | null;
}

interface ArticleCommentsProps {
  articleId: string;
  articleSlug: string;
}

export function ArticleComments({
  articleId,
  articleSlug,
}: ArticleCommentsProps) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [body, setBody] = useState("");
  const [notifyOnReply, setNotifyOnReply] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/blog/comments?articleId=${encodeURIComponent(articleId)}`,
      );
      const data = (await response.json()) as {
        ok?: boolean;
        comments?: PublicComment[];
      };
      if (response.ok && data.ok) {
        setComments(data.comments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          articleSlug,
          authorName: authorName.trim(),
          authorEmail: authorEmail.trim() || undefined,
          body: body.trim(),
          notifyOnReply: notifyOnReply && Boolean(authorEmail.trim()),
          website,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "No se pudo enviar el comentario.");
        return;
      }
      setMessage(
        data.message ??
          "Comentario enviado. Lo publicaremos tras revisarlo.",
      );
      setBody("");
      setWebsite("");
      await load();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="comentarios"
      className="scroll-mt-24 border-t border-stone-200 pt-12"
      aria-labelledby="comments-title"
    >
      <div className="mb-6 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-teal-800" aria-hidden />
        <h2
          id="comments-title"
          className="font-display text-2xl tracking-tight text-ink md:text-3xl"
        >
          Comentarios
        </h2>
        {!loading ? (
          <span className="text-sm text-stone-500">({comments.length})</span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Cargando comentarios…</p>
      ) : comments.length > 0 ? (
        <ul className="mb-10 space-y-5">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className="border border-stone-200 bg-white px-4 py-4 md:px-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ink">{comment.authorName}</p>
                <time
                  dateTime={comment.createdAt}
                  className="text-xs text-stone-500"
                >
                  {new Date(comment.createdAt).toLocaleString("es-ES")}
                </time>
              </div>
              <p className="mt-2 text-base leading-relaxed text-stone-700">
                {renderArticleInlineText(comment.body)}
              </p>
              {comment.adminReply ? (
                <div className="mt-4 border-l-4 border-teal-800 bg-teal-50/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-900">
                    Respuesta del equipo
                    {comment.adminRepliedAt ? (
                      <span className="ml-2 font-normal normal-case text-stone-500">
                        {new Date(comment.adminRepliedAt).toLocaleString("es-ES")}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">
                    {renderArticleInlineText(comment.adminReply)}
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-8 text-sm text-stone-500">
          Sé el primero en dejar tu opinión o pregunta sobre este artículo.
        </p>
      )}

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4 border border-stone-200 bg-stone-50/80 p-4 md:p-5"
      >
        <p className="text-sm font-medium text-ink">Deja tu comentario</p>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Nombre *
            <input
              required
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              maxLength={80}
              className="mt-2 h-11 w-full border border-stone-300 bg-white px-3 text-sm text-ink outline-none focus:border-ink"
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
            Email (opcional)
            <input
              type="email"
              value={authorEmail}
              onChange={(event) => setAuthorEmail(event.target.value)}
              maxLength={120}
              placeholder="Para avisarte si respondemos"
              className="mt-2 h-11 w-full border border-stone-300 bg-white px-3 text-sm text-ink outline-none focus:border-ink"
            />
          </label>
        </div>
        <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
          Comentario *
          <textarea
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            maxLength={2000}
            className="mt-2 w-full border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink"
            placeholder="Tu duda, experiencia o sugerencia…"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={notifyOnReply}
            disabled={!authorEmail.trim()}
            onChange={(event) => setNotifyOnReply(event.target.checked)}
            className="mt-1 h-4 w-4 accent-teal-800"
          />
          <span>
            Avísame por email si el equipo responde (necesitas dejar tu correo).
          </span>
        </label>
        <input
          type="text"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden
        />
        {message ? (
          <p className="rounded-sm border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 items-center gap-2 bg-ink px-5 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition hover:bg-stone-800 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          Enviar comentario
        </button>
        <p className="text-xs text-stone-500">
          Los comentarios se revisan antes de publicarse.
        </p>
      </form>
    </section>
  );
}
