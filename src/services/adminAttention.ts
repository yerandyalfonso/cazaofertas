import { createSupabaseServiceClient } from "@/lib/supabase";
import { getAppSettings } from "@/services/appSettings";
import { getCronControlState } from "@/services/cronControl";
import { countPendingChannelNotifications } from "@/services/telegramFlush";

export interface AttentionItem {
  id: string;
  tone: "warning" | "info";
  title: string;
  detail: string;
  href: string;
  cta: string;
}

/** Cola de Meta atascada a partir de aquí (lotes de ~10 que no salen). */
const META_STUCK_THRESHOLD = 20;

async function countRows(
  table: "articles" | "article_comments" | "meta_post_queue",
  column: string,
  value: string,
): Promise<number> {
  const client = createSupabaseServiceClient();
  const { count } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  return count ?? 0;
}

/** Tareas pendientes para el dashboard, de más a menos urgente. */
export async function getAdminAttentionItems(): Promise<AttentionItem[]> {
  const [cron, drafts, comments, metaPending, telegramPending, settings] = await Promise.all([
    getCronControlState().catch(() => null),
    countRows("articles", "status", "draft"),
    countRows("article_comments", "status", "pending"),
    countRows("meta_post_queue", "status", "pending"),
    countPendingChannelNotifications().catch(() => 0),
    getAppSettings().catch(() => null),
  ]);

  const items: AttentionItem[] = [];
  if (cron?.isPaused) {
    items.push({
      id: "cron-paused",
      tone: "warning",
      title: "Crons en pausa preventiva",
      detail: cron.pauseReason ?? "Amazon denegó varias peticiones seguidas.",
      href: "/admin/cron",
      cta: "Ver operaciones",
    });
  }
  if (metaPending >= META_STUCK_THRESHOLD) {
    items.push({
      id: "meta-stuck",
      tone: "warning",
      title: `${metaPending} publicaciones de Facebook/Instagram en cola`,
      detail: "La cola no avanza: puede que Meta esté limitando la página.",
      href: "/admin/social",
      cta: "Revisar redes",
    });
  }
  // La cola se acumula a propósito entre lotes; solo es un problema si hace
  // más del doble del intervalo que no sale ningún lote.
  const lastFlushMs = settings?.lastTelegramFlushAt
    ? new Date(settings.lastTelegramFlushAt).getTime()
    : null;
  const batchMs = (settings?.telegramBatchHours ?? 2) * 3_600_000;
  if (
    telegramPending > 0 &&
    (lastFlushMs === null || Date.now() - lastFlushMs > batchMs * 2)
  ) {
    items.push({
      id: "telegram-stalled",
      tone: "warning",
      title: `Telegram: ${telegramPending} chollos sin enviar`,
      detail: "No ha salido ningún lote en más del doble del intervalo configurado.",
      href: "/admin/cron",
      cta: "Ver cola",
    });
  }
  if (drafts > 0) {
    items.push({
      id: "drafts",
      tone: "info",
      title: `${drafts} ${drafts === 1 ? "artículo" : "artículos"} en borrador`,
      detail: "Pendientes de revisar y publicar.",
      href: "/admin/articles?status=draft",
      cta: "Revisar",
    });
  }
  if (comments > 0) {
    items.push({
      id: "comments",
      tone: "info",
      title: `${comments} ${comments === 1 ? "comentario" : "comentarios"} por moderar`,
      detail: "Los comentarios pendientes no se muestran en el blog.",
      href: "/admin/comments",
      cta: "Moderar",
    });
  }
  return items;
}
