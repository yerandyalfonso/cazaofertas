import { BellRing, Send } from "lucide-react";
import { TELEGRAM_GROUP_URL } from "@/lib/telegram";

interface TelegramCtaProps {
  /** Deep link al bot con la categoría ya elegida. */
  alertHref: string;
  /** Para qué es la alerta, p. ej. «los nuevos chollos de bebé». */
  topic: string;
}

/** Dos botones compactos: alerta en el bot y grupo público de Telegram. */
export function TelegramCta({ alertHref, topic }: TelegramCtaProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={alertHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost bg-surface text-sm"
        title={`Te avisamos en Telegram de ${topic}`}
      >
        <BellRing className="h-4 w-4 text-vivid" aria-hidden />
        Crear alerta
      </a>
      <a
        href={TELEGRAM_GROUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost bg-surface text-sm"
      >
        <Send className="h-4 w-4 text-vivid" aria-hidden />
        Grupo de Telegram
      </a>
    </div>
  );
}
