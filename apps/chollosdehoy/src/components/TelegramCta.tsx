import { BellRing, Send } from "lucide-react";
import { TELEGRAM_CHANNEL_URL } from "@/lib/telegram";

interface TelegramCtaProps {
  /** Deep link al bot con el producto o la categoría ya elegidos. */
  alertHref: string;
  title: string;
  text: string;
  className?: string;
}

/** «Avísame si baja» (bot) + «Únete al canal» (canal público de Telegram). */
export function TelegramCta({ alertHref, title, text, className = "" }: TelegramCtaProps) {
  return (
    <section
      className={`rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4 ${className}`}
    >
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={alertHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost border border-[var(--border)] text-sm"
        >
          <BellRing className="h-4 w-4" />
          Avísame si baja
        </a>
        <a
          href={TELEGRAM_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost border border-[var(--border)] text-sm"
        >
          <Send className="h-4 w-4" />
          Únete al canal
        </a>
      </div>
    </section>
  );
}
