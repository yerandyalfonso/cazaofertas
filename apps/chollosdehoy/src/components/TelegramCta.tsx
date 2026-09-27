import { BellRing, Send } from "lucide-react";
import { TELEGRAM_GROUP_URL } from "@/lib/telegram";

interface TelegramCtaProps {
  /** Deep link al bot con la categoría ya elegida. */
  alertHref: string;
  text: string;
}

/** Línea discreta: alerta en el bot + grupo público de Telegram. */
export function TelegramCta({ alertHref, text }: TelegramCtaProps) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
      <span>{text}</span>
      <a
        href={alertHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-medium text-ink hover:underline"
      >
        <BellRing className="h-4 w-4" />
        Crear alerta
      </a>
      <a
        href={TELEGRAM_GROUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 hover:text-ink hover:underline"
      >
        <Send className="h-4 w-4" />
        Grupo de Telegram
      </a>
    </p>
  );
}
