import { formatEnvError } from "@/lib/env";
import { getSiteUrl } from "@/lib/site";
import {
  isTelegramConfigured,
  sendTelegramMessage,
} from "@/services/telegram/bot";

function resolveAdminChatId(): string | number | null {
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!admin) return null;
  const asNumber = Number(admin);
  return Number.isFinite(asNumber) && admin === String(asNumber)
    ? asNumber
    : admin;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function sendAdminTelegram(text: string): Promise<void> {
  if (!isTelegramConfigured()) return;
  const chatId = resolveAdminChatId();
  if (!chatId) {
    console.warn(
      "[comments] Falta TELEGRAM_ADMIN_CHAT_ID; no se envió aviso de comentario.",
    );
    return;
  }
  try {
    await sendTelegramMessage({
      chatId,
      text,
      parseMode: "HTML",
      disableWebPagePreview: true,
    });
  } catch (error) {
    console.error("[comments] No se pudo avisar por Telegram:", error);
  }
}

/** Aviso inmediato al admin cuando llega un comentario nuevo. */
export async function notifyAdminNewComment(options: {
  authorName: string;
  articleTitle: string;
  articleSlug: string;
  excerpt: string;
  commentId: string;
}): Promise<void> {
  const base = getSiteUrl();
  const adminUrl = `${base}/admin/comments`;
  const articleUrl = `${base}/blog/${options.articleSlug}`;
  const excerpt = escapeHtml(options.excerpt.slice(0, 280));

  await sendAdminTelegram(
    [
      "💬 <b>Nuevo comentario</b>",
      "",
      `Artículo: <a href="${articleUrl}">${escapeHtml(options.articleTitle)}</a>`,
      `Autor: ${escapeHtml(options.authorName)}`,
      excerpt ? `«${excerpt}»` : "",
      "",
      `<a href="${adminUrl}">Moderar en admin</a>`,
      `<code>${options.commentId}</code>`,
      "",
      `<i>${new Date().toISOString()}</i>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

/** Placeholder para aviso por email al lector cuando el admin responde. */
export async function notifyReaderCommentReply(options: {
  email: string;
  authorName: string;
  articleTitle: string;
  articleSlug: string;
  reply: string;
}): Promise<void> {
  if (!options.email.trim()) return;
  console.info(
    "[comments] Respuesta lista para",
    options.email,
    "en",
    options.articleSlug,
    "—",
    options.reply.slice(0, 120),
  );
}

export function formatCommentError(error: unknown): string {
  return formatEnvError(error);
}
