import {
  extractAsin,
  generateAmazonUrl,
  looksLikeAmazonUrl,
} from "@/lib/affiliate";
import { buildTrackedAffiliateUrl } from "@/lib/affiliate-tracking";
import {
  getTelegramChannelId,
  getTelegramEnv,
  getTelegramPublicChannelId,
} from "@/lib/env";
import { postDealToFacebookPage } from "@/services/facebook";
import { formatEuro, requireNumber, toNumber } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";
import { WIZARD_CATEGORY_OPTIONS } from "@/lib/site-categories";
import { createSupabaseServiceClient } from "@/lib/supabase";
import { parseTelegramStartPayload } from "@/lib/telegram-links";
import { resolveTelegramTopicId } from "@/lib/telegram-topics";
import type { DealCandidate } from "@/services/alertMatching";
import { dealScoringService } from "@/services/deal-scoring";
import { ensureProductFromAmazonUrl } from "@/services/products";
import {
  buildWizardCancelOnlyMarkup,
  buildWizardCategoryMarkup,
  buildWizardConfirmMarkup,
  buildWizardDiscountMarkup,
  buildWizardMaxPriceMarkup,
  buildWizardModeMarkup,
  clearWizardDraft,
  formatWizardSummary,
  getWizardDraft,
  resolveCategoryId,
  saveWizardDraft,
  shortProductLabel,
  wizardStepLabel,
  WIZARD_CATEGORIES,
  type AlertWizardDraft,
} from "@/services/telegram/alertWizard";
import { DealLevel } from "@/types";

const TELEGRAM_API_BASE = "https://api.telegram.org";

export type InlineKeyboardButton =
  | { text: string; url: string }
  | { text: string; callback_data: string };

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChat;
  text?: string;
  from?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  description?: string;
  result?: T;
}

const EXAMPLE_CATEGORIES = WIZARD_CATEGORY_OPTIONS;

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export function isTelegramChannelConfigured(): boolean {
  return isTelegramConfigured() && Boolean(process.env.TELEGRAM_CHANNEL_ID?.trim());
}

async function callTelegramApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { TELEGRAM_BOT_TOKEN } = getTelegramEnv();
  const response = await fetch(
    `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const payload = (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || !payload.ok || payload.result === undefined) {
    throw new Error(
      payload.description ??
        `Telegram API error en ${method} (${response.status})`,
    );
  }

  return payload.result;
}

export async function sendTelegramMessage(options: {
  chatId: number | string;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  replyMarkup?: InlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
  messageThreadId?: number | null;
}): Promise<TelegramMessage> {
  return callTelegramApi<TelegramMessage>("sendMessage", {
    chat_id: options.chatId,
    text: options.text,
    parse_mode: options.parseMode ?? "HTML",
    reply_markup: options.replyMarkup,
    disable_web_page_preview: options.disableWebPagePreview ?? true,
    ...(options.messageThreadId != null
      ? { message_thread_id: options.messageThreadId }
      : {}),
  });
}

export async function sendTelegramPhoto(options: {
  chatId: number | string;
  photoUrl: string;
  caption: string;
  parseMode?: "HTML" | "MarkdownV2";
  replyMarkup?: InlineKeyboardMarkup;
  messageThreadId?: number | null;
}): Promise<TelegramMessage> {
  return callTelegramApi<TelegramMessage>("sendPhoto", {
    chat_id: options.chatId,
    photo: options.photoUrl,
    caption: options.caption,
    parse_mode: options.parseMode ?? "HTML",
    reply_markup: options.replyMarkup,
    ...(options.messageThreadId != null
      ? { message_thread_id: options.messageThreadId }
      : {}),
  });
}

export async function editTelegramMessage(options: {
  chatId: number;
  messageId: number;
  text: string;
  parseMode?: "HTML" | "MarkdownV2";
  replyMarkup?: InlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
}): Promise<TelegramMessage | boolean> {
  return callTelegramApi<TelegramMessage | boolean>("editMessageText", {
    chat_id: options.chatId,
    message_id: options.messageId,
    text: options.text,
    parse_mode: options.parseMode ?? "HTML",
    reply_markup: options.replyMarkup,
    disable_web_page_preview: options.disableWebPagePreview ?? true,
  });
}

export async function answerCallbackQuery(options: {
  callbackQueryId: string;
  text?: string;
  showAlert?: boolean;
}): Promise<boolean> {
  const result = await callTelegramApi<boolean | true>("answerCallbackQuery", {
    callback_query_id: options.callbackQueryId,
    text: options.text,
    show_alert: options.showAlert ?? false,
  });

  return Boolean(result);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function dealHeadline(
  level: DealLevel,
  options?: { brand?: string | null; store?: string },
): string {
  const store = options?.store?.trim() || "Amazon";
  const by = options?.brand?.trim() || store;
  switch (level) {
    case DealLevel.HISTORICAL_LOW:
      return `🔥 Chollazo de ${by}`;
    case DealLevel.GREAT_DEAL:
      return `🔥 Gran oferta de ${by}`;
    case DealLevel.GOOD_DEAL:
      return `🔥 Buena oferta de ${by}`;
    default:
      return `🔥 Oferta de ${by}`;
  }
}

function truncatePlain(value: string, maxChars: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function dealSummaryLine(deal: DealCandidate): string | null {
  if (deal.summary?.trim()) {
    return truncatePlain(deal.summary.trim(), 160);
  }
  const bits = [deal.brand?.trim(), deal.categoryName?.trim()].filter(Boolean);
  if (bits.length === 0) return null;
  return bits.join(" · ");
}

function formatDealStamp(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** Hashtag Telegram (#belleza) a partir del slug de categoría. */
export function formatCategoryHashtag(
  name?: string | null,
  slug?: string | null,
): string | null {
  const raw = slug?.trim() || name?.trim();
  if (!raw) return null;
  const tag = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return tag ? `#${tag}` : null;
}

export function buildDealAlertText(
  deal: DealCandidate,
  options?: { includeCopyLinks?: boolean },
): string {
  const score =
    deal.score != null && Number.isFinite(deal.score)
      ? Math.min(100, Math.round(deal.score))
      : null;

  const lines = [
    dealHeadline(deal.dealLevel, { brand: deal.brand }),
    "",
    `<b>${escapeHtml(truncatePlain(deal.title, 120))}</b>`,
  ];

  const summary = dealSummaryLine(deal);
  if (summary) {
    lines.push(escapeHtml(summary));
  }

  lines.push(
    "",
    `💰 Oferta: <b>${formatEuro(deal.currentPrice)}</b>`,
    `🏷️ Antes: <s>${formatEuro(deal.previousPrice)}</s>`,
    `📉 Descuento: <b>−${Math.round(deal.discountPercentage)}%</b>`,
  );

  if (score != null) {
    lines.push(`⭐ Puntuación <b>${score}/100</b>`);
  }

  if (deal.detectedAt) {
    lines.push(`📅 Publicada: ${formatDealStamp(deal.detectedAt)}`);
  }
  if (deal.expiresAt && new Date(deal.expiresAt).getTime() > Date.now()) {
    lines.push(`⏳ Vence: ${formatDealStamp(deal.expiresAt)}`);
  }

  if (options?.includeCopyLinks) {
    const offerUrl = buildTrackedAffiliateUrl({
      productId: deal.productId,
      source: "telegram",
    });
    lines.push("", "🔗 Enlaces:", `🛒 Ver oferta: ${offerUrl}`);
    if (deal.productSlug?.trim()) {
      lines.push(
        `🌐 Ver en la web: ${absoluteUrl(`/producto/${deal.productSlug.trim()}`)}`,
      );
    }
  }

  const categoryLabel = deal.categoryName?.trim();
  const categoryTag = formatCategoryHashtag(
    deal.categoryName,
    deal.categorySlug,
  );
  if (categoryLabel || categoryTag) {
    lines.push("");
    if (categoryLabel) {
      lines.push(`📂 ${escapeHtml(categoryLabel)}`);
    }
    if (categoryTag) {
      lines.push(categoryTag);
    }
  }

  // Dos saltos finales para separar el texto del teclado inline (si hay).
  lines.push("", "");

  return lines.join("\n");
}

/** Caption de foto: Telegram limita a 1024 caracteres. */
export function buildDealAlertCaption(
  deal: DealCandidate,
  options?: { includeCopyLinks?: boolean },
): string {
  const text = buildDealAlertText(deal, options);
  if (text.length <= 1024) return text;
  return `${text.slice(0, 1020).trimEnd()}…`;
}

/** Botones: oferta afiliada + ficha en CazaOferta (si hay slug). */
export function buildOfferActionMarkup(options: {
  affiliateUrl: string;
  productSlug?: string | null;
}): InlineKeyboardMarkup {
  const row: InlineKeyboardButton[] = [
    { text: "🛒 Ver oferta", url: options.affiliateUrl },
  ];
  if (options.productSlug?.trim()) {
    row.push({
      text: "🌐 Ver en la web",
      url: absoluteUrl(`/producto/${options.productSlug.trim()}`),
    });
  }
  return { inline_keyboard: [row] };
}

export function buildStartMenuMarkup(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🔔 Crear alerta", callback_data: "menu:create_alert" }],
      [{ text: "📂 Categorías", callback_data: "menu:categories" }],
      [{ text: "🔥 Mejores ofertas", callback_data: "menu:best_deals" }],
      [{ text: "⚙️ Mis alertas", callback_data: "menu:my_alerts" }],
    ],
  };
}

export function buildCategoriesMenuMarkup(): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = EXAMPLE_CATEGORIES.map((category) => [
    {
      text: category.label,
      callback_data: `category:${category.slug}`,
    },
  ]);

  rows.push([{ text: "⬅️ Volver al menú", callback_data: "menu:home" }]);

  return { inline_keyboard: rows };
}

export const START_WELCOME_TEXT = [
  "🎯 CazaOferta",
  "",
  "Chollos reales de Amazon España, con historial de precios y alertas a medida.",
  "",
  "Crea alertas y te avisamos solo cuando caiga lo que te interesa.",
].join("\n");

const CATEGORIES_MENU_TEXT = [
  "📂 Categorías",
  "",
  "Elige una categoría para crear una alerta filtrada:",
].join("\n");

const SETTINGS_TEXT = [
  "⚙️ <b>Ajustes</b>",
  "",
  "• Usa /alerts para ver y borrar alertas",
  "• Usa /addalert para el wizard de creación",
  "• Las notificaciones llegan por DM cuando hay chollos",
  "",
  "Más opciones de preferencias llegarán pronto.",
].join("\n");

export async function handleTelegramCommand(
  command: string,
  options: { chatId: number; telegramId: number; args?: string },
): Promise<boolean> {
  const { chatId, telegramId, args = "" } = options;

  switch (command) {
    case "start": {
      const payload = parseTelegramStartPayload(args);
      if (payload) {
        await startWizardFromDeepLink(chatId, telegramId, payload);
        return true;
      }
      await sendStartWelcome(chatId);
      return true;
    }
    case "help":
      await sendTelegramMessage({
        chatId,
        text: [
          "Comandos disponibles:",
          "/start — menú principal",
          "/help — esta ayuda",
          "/alerts — tus alertas",
          "/addalert — crear alerta (wizard)",
          "/removealert — eliminar alertas",
          "/products — mejores ofertas",
          "/categories — alertas por categoría",
          "/settings — ajustes",
        ].join("\n"),
      });
      return true;
    case "addalert":
      await startAlertWizard(chatId, telegramId);
      return true;
    case "alerts":
    case "removealert":
      await handleMyAlerts(telegramId, chatId);
      return true;
    case "products":
      await handleBestDeals(chatId);
      return true;
    case "categories":
      await sendTelegramMessage({
        chatId,
        text: CATEGORIES_MENU_TEXT,
        replyMarkup: buildCategoriesMenuMarkup(),
      });
      return true;
    case "settings":
      await sendTelegramMessage({ chatId, text: SETTINGS_TEXT });
      return true;
    default:
      return false;
  }
}

export async function sendStartWelcome(chatId: number): Promise<TelegramMessage> {
  return sendTelegramMessage({
    chatId,
    text: START_WELCOME_TEXT,
    replyMarkup: buildStartMenuMarkup(),
  });
}

export async function sendDealAlertMessage(options: {
  chatId: number | string;
  deal: DealCandidate;
  messageThreadId?: number | null;
  /** buttons = teclado inline (grupo/temas). links = URLs en el texto (canal público). */
  linkMode?: "buttons" | "links";
}): Promise<TelegramMessage> {
  const linkMode = options.linkMode ?? "buttons";
  const includeCopyLinks = linkMode === "links";
  const replyMarkup =
    linkMode === "buttons"
      ? buildOfferActionMarkup({
          affiliateUrl: buildTrackedAffiliateUrl({
            productId: options.deal.productId,
            source: "telegram",
          }),
          productSlug: options.deal.productSlug,
        })
      : undefined;
  const messageThreadId = options.messageThreadId;

  const photoUrl = options.deal.imageUrl?.trim();
  if (photoUrl && /^https?:\/\//i.test(photoUrl)) {
    try {
      return await sendTelegramPhoto({
        chatId: options.chatId,
        photoUrl,
        caption: buildDealAlertCaption(options.deal, { includeCopyLinks }),
        replyMarkup,
        messageThreadId,
      });
    } catch (error) {
      console.warn(
        "[telegram] sendPhoto falló; se envía solo texto.",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return sendTelegramMessage({
    chatId: options.chatId,
    text: buildDealAlertText(options.deal, { includeCopyLinks }),
    disableWebPagePreview: true,
    replyMarkup,
    messageThreadId,
  });
}

/**
 * Publica un chollo:
 * 1) Grupo/foro (TELEGRAM_CHANNEL_ID) con temas + botones
 * 2) Canal público (TELEGRAM_PUBLIC_CHANNEL_ID) con links en el texto
 * 3) Página de Facebook (si hay token; nunca interrumpe Telegram)
 */
export async function sendChannelDealAlert(
  deal: DealCandidate,
): Promise<TelegramMessage> {
  const channelId = getTelegramChannelId();
  if (!channelId) {
    throw new Error("Falta TELEGRAM_CHANNEL_ID en el entorno.");
  }
  const messageThreadId = resolveTelegramTopicId(deal.categorySlug);
  const groupMessage = await sendDealAlertMessage({
    chatId: channelId,
    deal,
    messageThreadId,
    linkMode: "buttons",
  });

  const publicChannelId = getTelegramPublicChannelId();
  if (publicChannelId && String(publicChannelId) !== String(channelId)) {
    try {
      await sendDealAlertMessage({
        chatId: publicChannelId,
        deal,
        linkMode: "links",
      });
    } catch (error) {
      console.warn(
        "[telegram] Falló envío al canal público; el grupo sí recibió la alerta.",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const facebook = await postDealToFacebookPage(deal);
  if (!facebook.ok && !facebook.skipped) {
    console.warn("[facebook]", facebook.error ?? "No se pudo publicar en Facebook.");
  }

  return groupMessage;
}

async function handleCreateAlert(chatId: number, telegramId?: number): Promise<void> {
  if (telegramId !== undefined) {
    await saveWizardDraft(telegramId, { step: "pick_mode" });
  }
  await sendTelegramMessage({
    chatId,
    text: [
      `🔔 <b>Nueva alerta — ${wizardStepLabel("pick_mode")}</b>`,
      "",
      "¿Qué quieres vigilar?",
      "Elige una opción con los botones:",
    ].join("\n"),
    replyMarkup: buildWizardModeMarkup(),
  });
}

/** Inicia el wizard (también desde /addalert). */
export async function startAlertWizard(
  chatId: number,
  telegramId: number,
): Promise<void> {
  await handleCreateAlert(chatId, telegramId);
}

async function startWizardFromDeepLink(
  chatId: number,
  telegramId: number,
  payload: { type: "asin" | "cat" | "kw"; value: string },
): Promise<void> {
  if (payload.type === "asin") {
    const asin = payload.value;
    const url = generateAmazonUrl(asin);
    let title: string | null = null;
    try {
      const client = createSupabaseServiceClient();
      const { data } = await client
        .from("products")
        .select("title")
        .eq("asin", asin)
        .maybeSingle();
      title = data?.title ?? null;
    } catch (error) {
      console.error("[telegram] deep-link product title", error);
    }
    const label = shortProductLabel(title, asin);
    await saveWizardDraft(telegramId, {
      step: "pick_discount",
      mode: "url",
      url,
      keyword: label,
      productTitle: label,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        `🎯 <b>Alerta · ${escapeHtml(label)}</b>`,
        "",
        `📉 <b>${wizardStepLabel("pick_discount")}</b>`,
        "",
        "¿A partir de qué descuento quieres que te avise?",
      ].join("\n"),
      replyMarkup: buildWizardDiscountMarkup(),
    });
    return;
  }

  if (payload.type === "cat") {
    const cat =
      WIZARD_CATEGORIES.find((c) => c.slug === payload.value) ??
      ({ label: payload.value, slug: payload.value } as const);
    const resolved = await resolveCategoryId(payload.value);
    await saveWizardDraft(telegramId, {
      step: "pick_discount",
      mode: "category",
      categorySlug: payload.value,
      categoryId: resolved?.id ?? null,
      categoryLabel: resolved?.name ?? cat.label,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        `📂 <b>Alerta · ${resolved?.name ?? cat.label}</b>`,
        "",
        `📉 <b>${wizardStepLabel("pick_discount")}</b>`,
        "",
        "¿A partir de qué descuento quieres que te avise?",
      ].join("\n"),
      replyMarkup: buildWizardDiscountMarkup(),
    });
    return;
  }

  await saveWizardDraft(telegramId, {
    step: "pick_discount",
    mode: "keyword",
    keyword: payload.value,
  });
  await sendTelegramMessage({
    chatId,
    text: [
      `🔤 <b>Alerta · «${payload.value}»</b>`,
      "",
      `📉 <b>${wizardStepLabel("pick_discount")}</b>`,
      "",
      "¿A partir de qué descuento quieres que te avise?",
    ].join("\n"),
    replyMarkup: buildWizardDiscountMarkup(),
  });
}

async function advanceWizardAfterTarget(
  chatId: number,
  telegramId: number,
  draft: AlertWizardDraft,
): Promise<void> {
  await saveWizardDraft(telegramId, { ...draft, step: "pick_discount" });

  const headerLines: string[] = [];
  if (draft.mode === "category") {
    headerLines.push(
      `📂 <b>Alerta · ${escapeHtml(draft.categoryLabel ?? "Cualquiera")}</b>`,
      "",
    );
  } else if (draft.mode === "keyword" && draft.keyword) {
    headerLines.push(
      `🔤 <b>Alerta · «${escapeHtml(draft.keyword)}»</b>`,
      "",
    );
  } else if (draft.mode === "brand" && draft.brand) {
    headerLines.push(
      `🏷️ <b>Alerta · ${escapeHtml(draft.brand)}</b>`,
      "",
    );
  } else if (draft.productTitle) {
    headerLines.push(
      `🎯 <b>Alerta · ${escapeHtml(draft.productTitle)}</b>`,
      "",
    );
  }

  await sendTelegramMessage({
    chatId,
    text: [
      ...headerLines,
      `📉 <b>${wizardStepLabel("pick_discount")} · descuento mínimo</b>`,
      "",
      "¿A partir de qué descuento quieres que te avise?",
    ].join("\n"),
    replyMarkup: buildWizardDiscountMarkup(),
  });
}

async function promptWizardMode(chatId: number, telegramId: number): Promise<void> {
  await saveWizardDraft(telegramId, { step: "pick_mode" });
  await sendTelegramMessage({
    chatId,
    text: [
      `🔔 <b>Nueva alerta — ${wizardStepLabel("pick_mode")}</b>`,
      "",
      "¿Qué quieres vigilar?",
    ].join("\n"),
    replyMarkup: buildWizardModeMarkup(),
  });
}

async function promptWizardTarget(
  chatId: number,
  telegramId: number,
  draft: AlertWizardDraft,
): Promise<void> {
  if (draft.mode === "category") {
    await saveWizardDraft(telegramId, {
      ...draft,
      step: "pick_category",
    });
    await sendTelegramMessage({
      chatId,
      text: [
        `📂 <b>${wizardStepLabel("pick_category")} · categoría</b>`,
        "",
        "Elige una categoría o «Cualquier categoría»:",
      ].join("\n"),
      replyMarkup: buildWizardCategoryMarkup(),
    });
    return;
  }

  const mode = draft.mode ?? "keyword";
  await saveWizardDraft(telegramId, {
    ...draft,
    step: "await_text",
    mode,
  });
  const prompt =
    mode === "keyword"
      ? "Escribe la <b>palabra clave</b> (ej: airpods, silla gaming):"
      : mode === "brand"
        ? "Escribe la <b>marca</b> exacta (ej: Sony, Samsung):"
        : "Pega la <b>URL de Amazon</b> del producto:";
  await sendTelegramMessage({
    chatId,
    text: [
      `✏️ <b>${wizardStepLabel("await_text")} · detalle</b>`,
      "",
      prompt,
    ].join("\n"),
    replyMarkup: buildWizardCancelOnlyMarkup(),
  });
}

async function handleWizardBack(
  chatId: number,
  telegramId: number,
): Promise<void> {
  const draft = await getWizardDraft(telegramId);
  if (!draft) {
    await promptWizardMode(chatId, telegramId);
    return;
  }

  switch (draft.step) {
    case "pick_mode":
      await clearWizardDraft(telegramId);
      await sendStartWelcome(chatId);
      return;
    case "pick_category":
    case "await_text":
      await promptWizardMode(chatId, telegramId);
      return;
    case "pick_discount":
      await promptWizardTarget(chatId, telegramId, draft);
      return;
    case "pick_max_price":
      await saveWizardDraft(telegramId, { ...draft, step: "pick_discount" });
      {
        const productLine = draft.productTitle
          ? [`🎯 <b>Alerta · ${escapeHtml(draft.productTitle)}</b>`, ""]
          : [];
        await sendTelegramMessage({
          chatId,
          text: [
            ...productLine,
            `📉 <b>${wizardStepLabel("pick_discount")} · descuento mínimo</b>`,
            "",
            "¿A partir de qué descuento quieres que te avise?",
          ].join("\n"),
          replyMarkup: buildWizardDiscountMarkup(),
        });
      }
      return;
    case "confirm":
      await saveWizardDraft(telegramId, { ...draft, step: "pick_max_price" });
      await sendTelegramMessage({
        chatId,
        text: [
          `💶 <b>${wizardStepLabel("pick_max_price")} · precio máximo</b>`,
          "",
          "¿Cuál es el precio máximo que te interesa?",
        ].join("\n"),
        replyMarkup: buildWizardMaxPriceMarkup(),
      });
      return;
    default:
      await promptWizardMode(chatId, telegramId);
  }
}

async function handleWizardCallback(options: {
  data: string;
  chatId: number;
  telegramId: number;
  messageId?: number;
}): Promise<boolean> {
  const { data, chatId, telegramId } = options;
  if (!data.startsWith("wiz:")) return false;

  if (data === "wiz:cancel") {
    await clearWizardDraft(telegramId);
    await sendTelegramMessage({
      chatId,
      text: "Alerta cancelada. Usa /start para volver al menú.",
      replyMarkup: buildStartMenuMarkup(),
    });
    return true;
  }

  if (data === "wiz:back") {
    await handleWizardBack(chatId, telegramId);
    return true;
  }

  if (data.startsWith("wiz:mode:")) {
    const mode = data.slice("wiz:mode:".length) as AlertWizardDraft["mode"];
    if (mode === "category") {
      await promptWizardTarget(chatId, telegramId, {
        step: "pick_category",
        mode: "category",
        updatedAt: new Date().toISOString(),
      });
      return true;
    }

    if (mode === "keyword" || mode === "brand" || mode === "url") {
      await promptWizardTarget(chatId, telegramId, {
        step: "await_text",
        mode,
        updatedAt: new Date().toISOString(),
      });
      return true;
    }
  }

  if (data.startsWith("wiz:cat:")) {
    const slug = data.slice("wiz:cat:".length);
    const draft = (await getWizardDraft(telegramId)) ?? {
      step: "pick_category" as const,
      mode: "category" as const,
      updatedAt: new Date().toISOString(),
    };
    if (slug === "any") {
      await advanceWizardAfterTarget(chatId, telegramId, {
        ...draft,
        mode: "category",
        categorySlug: null,
        categoryId: null,
        categoryLabel: "Cualquiera",
      });
      return true;
    }
    const cat =
      WIZARD_CATEGORIES.find((c) => c.slug === slug) ??
      ({ label: slug, slug } as const);
    const resolved = await resolveCategoryId(slug);
    await advanceWizardAfterTarget(chatId, telegramId, {
      ...draft,
      mode: "category",
      categorySlug: slug,
      categoryId: resolved?.id ?? null,
      categoryLabel: resolved?.name ?? cat.label,
    });
    return true;
  }

  if (data.startsWith("wiz:disc:")) {
    const raw = data.slice("wiz:disc:".length);
    const draft = await getWizardDraft(telegramId);
    if (!draft) {
      await sendTelegramMessage({
        chatId,
        text: "La sesión del wizard caducó. Pulsa «Crear alerta» de nuevo.",
      });
      return true;
    }
    const minDiscount = raw === "any" ? null : Number.parseInt(raw, 10);
    await saveWizardDraft(telegramId, {
      ...draft,
      step: "pick_max_price",
      minDiscount: Number.isFinite(minDiscount) ? minDiscount : null,
    });
    await sendTelegramMessage({
      chatId,
      text: [
        `💶 <b>${wizardStepLabel("pick_max_price")} · precio máximo</b>`,
        "",
        "¿Cuál es el precio máximo que te interesa?",
      ].join("\n"),
      replyMarkup: buildWizardMaxPriceMarkup(),
    });
    return true;
  }

  if (data.startsWith("wiz:price:")) {
    const raw = data.slice("wiz:price:".length);
    const draft = await getWizardDraft(telegramId);
    if (!draft) {
      await sendTelegramMessage({
        chatId,
        text: "La sesión del wizard caducó. Pulsa «Crear alerta» de nuevo.",
      });
      return true;
    }
    const maxPrice = raw === "any" ? null : Number.parseInt(raw, 10);
    const next = await saveWizardDraft(telegramId, {
      ...draft,
      step: "confirm",
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
    });
    await sendTelegramMessage({
      chatId,
      text: formatWizardSummary(next),
      replyMarkup: buildWizardConfirmMarkup(),
    });
    return true;
  }

  if (data === "wiz:confirm") {
    const draft = await getWizardDraft(telegramId);
    if (!draft) {
      await sendTelegramMessage({
        chatId,
        text: "La sesión del wizard caducó. Pulsa «Crear alerta» de nuevo.",
      });
      return true;
    }
    await commitWizardAlert({ telegramId, chatId, draft });
    return true;
  }

  return false;
}

async function commitWizardAlert(options: {
  telegramId: number;
  chatId: number;
  draft: AlertWizardDraft;
}): Promise<void> {
  const { telegramId, chatId, draft } = options;
  const client = createSupabaseServiceClient();

  const { data: user, error: userError } = await client
    .from("users")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (userError || !user?.id) {
    await sendTelegramMessage({
      chatId,
      text: "Primero usa /start para vincular tu cuenta.",
    });
    return;
  }

  let productId: string | null = null;
  let productTitle: string | null = null;
  let initialPrice: number | null = null;
  let url = draft.url ?? null;
  let keyword = draft.keyword ?? null;
  const brand = draft.brand ?? null;

  if (draft.mode === "url" && url) {
    try {
      const product = await ensureProductFromAmazonUrl(client, url);
      productId = product.id;
      productTitle = product.title;
      initialPrice = product.currentPrice;
      if (!keyword) keyword = product.title.slice(0, 120);
    } catch (error) {
      console.error("[telegram] wizard URL product", error);
      await sendTelegramMessage({
        chatId,
        text: "No pude leer ese producto de Amazon. Revisa la URL e inténtalo de nuevo.",
      });
      return;
    }
  }

  const { error: insertError } = await client.from("alerts").insert({
    user_id: user.id,
    category_id: draft.categoryId ?? null,
    keyword,
    brand,
    url,
    product_id: productId,
    last_known_price: initialPrice,
    last_checked_at: productId ? new Date().toISOString() : null,
    min_discount_percentage: draft.minDiscount ?? null,
    max_price: draft.maxPrice ?? null,
    is_active: true,
  });

  if (insertError) {
    console.error("[telegram] wizard insert", insertError);
    await sendTelegramMessage({
      chatId,
      text: "No pude guardar la alerta. Inténtalo de nuevo en unos segundos.",
    });
    return;
  }

  await clearWizardDraft(telegramId);

  const lines = [
    "✅ <b>Alerta creada</b>",
    draft.mode === "category"
      ? `📂 Categoría: <b>${escapeHtml(draft.categoryLabel ?? "Cualquiera")}</b>`
      : "",
    "",
    formatWizardSummary({ ...draft, step: "confirm" })
      .replace(/^📋 <b>Resumen — confirmación<\/b>\n\n/, "")
      .replace("📋 <b>Resumen de la alerta</b>\n\n", "")
      .replace("\n\n¿Confirmas?", ""),
  ];
  if (productTitle) {
    lines.push("", escapeHtml(productTitle));
  }
  if (initialPrice != null) {
    lines.push(`Precio actual: <b>${formatEuro(initialPrice)}</b>`);
  }

  await sendTelegramMessage({
    chatId,
    text: lines.join("\n"),
    replyMarkup: buildStartMenuMarkup(),
  });
}

async function handleWizardTextInput(
  message: TelegramMessage,
  draft: AlertWizardDraft,
): Promise<boolean> {
  if (draft.step !== "await_text") return false;

  const chatId = message.chat?.id;
  const telegramId = message.from?.id;
  const rawText = message.text?.trim() ?? "";
  if (chatId === undefined || telegramId === undefined || !rawText) {
    return true;
  }

  if (draft.mode === "url") {
    if (!looksLikeAmazonUrl(rawText) || !extractAsin(rawText)) {
      await sendTelegramMessage({
        chatId,
        text: "Esa no parece una URL de producto Amazon válida (debe incluir /dp/…). Pégala de nuevo o cancela con /start.",
      });
      return true;
    }
    const url = rawText.slice(0, 500);
    const asin = extractAsin(rawText);
    let title: string | null = null;
    try {
      const client = createSupabaseServiceClient();
      if (asin) {
        const { data } = await client
          .from("products")
          .select("title")
          .eq("asin", asin)
          .maybeSingle();
        title = data?.title ?? null;
      }
      if (!title) {
        const product = await ensureProductFromAmazonUrl(client, url);
        title = product.title;
      }
    } catch (error) {
      console.error("[telegram] wizard url title", error);
    }
    const label = shortProductLabel(title, asin);
    await advanceWizardAfterTarget(chatId, telegramId, {
      ...draft,
      url,
      keyword: label,
      productTitle: label,
    });
    return true;
  }

  if (draft.mode === "brand") {
    await advanceWizardAfterTarget(chatId, telegramId, {
      ...draft,
      brand: rawText.slice(0, 80),
    });
    return true;
  }

  // keyword
  await advanceWizardAfterTarget(chatId, telegramId, {
    ...draft,
    keyword: rawText.slice(0, 120),
  });
  return true;
}

async function handleCategoriesMenu(
  chatId: number,
  messageId: number,
): Promise<void> {
  await editTelegramMessage({
    chatId,
    messageId,
    text: CATEGORIES_MENU_TEXT,
    replyMarkup: buildCategoriesMenuMarkup(),
  });
}

async function handleHomeMenu(chatId: number, messageId: number): Promise<void> {
  await editTelegramMessage({
    chatId,
    messageId,
    text: START_WELCOME_TEXT,
    replyMarkup: buildStartMenuMarkup(),
  });
}

async function handleCategoryPick(
  chatId: number,
  telegramId: number,
  slug: string,
): Promise<void> {
  const category =
    EXAMPLE_CATEGORIES.find((item) => item.slug === slug) ??
    WIZARD_CATEGORIES.find((item) => item.slug === slug);
  const label = category?.label ?? slug;
  const resolved = await resolveCategoryId(slug);

  await advanceWizardAfterTarget(chatId, telegramId, {
    step: "pick_discount",
    mode: "category",
    categorySlug: slug,
    categoryId: resolved?.id ?? null,
    categoryLabel: resolved?.name ?? label,
    updatedAt: new Date().toISOString(),
  });
}

async function fetchTopDealsText(): Promise<string> {
  const client = createSupabaseServiceClient();
  const { data, error } = await client
    .from("products")
    .select(
      "id, title, brand, current_price, previous_price, lowest_price, discount_percentage, affiliate_url, asin, categories(slug, name)",
    )
    .eq("is_active", true)
    .not("previous_price", "is", null)
    .gt("discount_percentage", 0)
    .order("discount_percentage", { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(error.message);
  }

  const ranked = (data ?? [])
    .map((product) => {
      const currentPrice = requireNumber(product.current_price);
      const previousPrice = toNumber(product.previous_price);
      const lowestPrice = toNumber(product.lowest_price);
      const discountPercentage =
        toNumber(product.discount_percentage) ??
        (previousPrice === null
          ? 0
          : ((previousPrice - currentPrice) / previousPrice) * 100);

      const category = Array.isArray(product.categories)
        ? product.categories[0]
        : product.categories;

      const scoring = dealScoringService.score({
        currentPrice,
        previousPrice,
        lowestPrice,
        discountPercentage,
        categorySlug: category?.slug ?? "general",
        priceChangeCount30d: 1,
        previousPriceAgeHours: 72,
      });

      return {
        productId: product.id,
        title: product.title,
        brand: product.brand as string | null,
        currentPrice,
        previousPrice,
        discountPercentage,
        scoring,
        affiliateUrl: buildTrackedAffiliateUrl({
          productId: product.id,
          source: "telegram",
        }),
      };
    })
    .filter(
      (item) =>
        item.scoring.level === DealLevel.GOOD_DEAL ||
        item.scoring.level === DealLevel.GREAT_DEAL ||
        item.scoring.level === DealLevel.HISTORICAL_LOW,
    )
    .sort((a, b) => b.scoring.score - a.scoring.score)
    .slice(0, 3);

  if (ranked.length === 0) {
    return "Ahora mismo no hay ofertas GOOD_DEAL / GREAT_DEAL disponibles. Vuelve a intentarlo tras una detección de precios.";
  }

  const lines = ["🔥 Top 3 mejores ofertas", ""];

  ranked.forEach((deal, index) => {
    lines.push(
      `<b>${index + 1}. ${escapeHtml(deal.title)}</b>`,
      `${dealHeadline(deal.scoring.level, { brand: deal.brand ?? null })}`,
      `💰 ${formatEuro(deal.currentPrice)}${
        deal.previousPrice !== null
          ? `  <s>${formatEuro(deal.previousPrice)}</s>`
          : ""
      }`,
      `📉 -${Math.round(deal.discountPercentage)}%`,
      `<a href="${deal.affiliateUrl}">🛒 Ver en Amazon</a>`,
      "",
    );
  });

  return lines.join("\n").trimEnd();
}

async function handleBestDeals(chatId: number): Promise<void> {
  const text = await fetchTopDealsText();
  await sendTelegramMessage({ chatId, text });
}

function extractCallbackChatId(
  callbackQuery: TelegramCallbackQuery,
): number | null {
  const fromMessage = callbackQuery.message?.chat?.id;
  if (typeof fromMessage === "number") {
    return fromMessage;
  }

  // En chats privados el chat.id coincide con el user id.
  if (typeof callbackQuery.from?.id === "number") {
    return callbackQuery.from.id;
  }

  return null;
}

const EMPTY_ALERTS_MESSAGE =
  "📭 Aún no tienes ninguna alerta activa. Pulsa 'Crear alerta' para empezar.";

interface UserAlertRow {
  id: string;
  keyword: string | null;
  url: string | null;
  brand: string | null;
  min_discount_percentage: number | null;
  max_price: number | null;
  min_price: number | null;
  product_id: string | null;
  category_id: string | null;
  categories?: { id: string; name: string; slug: string } | null;
}

function resolveAlertCategory(
  categories: UserAlertRow["categories"] | UserAlertRow["categories"][] | undefined,
): UserAlertRow["categories"] {
  if (!categories) return null;
  if (Array.isArray(categories)) return categories[0] ?? null;
  return categories;
}

function formatAlertLine(index: number, alert: UserAlertRow): string {
  const parts: string[] = [];
  const category = resolveAlertCategory(alert.categories);

  if (alert.category_id) {
    const categoryName = category?.name?.trim() || "Categoría desconocida";
    parts.push(`📂 ${escapeHtml(categoryName)}`);
  }
  if (alert.url) {
    parts.push(`🔗 URL Amazon`);
  }
  if (alert.keyword) {
    parts.push(`🔑 ${escapeHtml(alert.keyword)}`);
  }
  if (alert.brand) {
    parts.push(`🏷️ ${escapeHtml(alert.brand)}`);
  }
  if (alert.product_id) {
    parts.push("Producto específico");
  }
  if (alert.min_discount_percentage !== null) {
    parts.push(`Dto. mín.: ${alert.min_discount_percentage}%`);
  }
  if (alert.max_price !== null) {
    const maxPrice = Number(alert.max_price);
    if (Number.isFinite(maxPrice)) {
      parts.push(`Precio máx.: ${formatEuro(maxPrice)}`);
    }
  }
  if (alert.min_price !== null) {
    const minPrice = Number(alert.min_price);
    if (Number.isFinite(minPrice)) {
      parts.push(`Precio mín.: ${formatEuro(minPrice)}`);
    }
  }

  return `<b>${index + 1}.</b> ${parts.length > 0 ? parts.join(" · ") : "Alerta general"}`;
}

function buildDeleteAlertsMarkup(alerts: UserAlertRow[]): InlineKeyboardMarkup {
  return {
    inline_keyboard: alerts.map((alert) => {
      const category = resolveAlertCategory(alert.categories);
      const label =
        category?.name?.trim() ||
        alert.keyword?.trim() ||
        (alert.url ? "URL Amazon" : alert.brand?.trim() || "Alerta");
      const truncated =
        label.length > 40 ? `${label.slice(0, 37)}…` : label;

      return [
        {
          text: `❌ ${truncated}`,
          callback_data: `delete_alert:${alert.id}`,
        },
      ];
    }),
  };
}

async function fetchUserAlerts(telegramId: number): Promise<{
  text: string;
  replyMarkup?: InlineKeyboardMarkup;
}> {
  try {
    const client = createSupabaseServiceClient();

    const { data: user, error: userError } = await client
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError) {
      console.error("[telegram] Mis alertas: error al buscar usuario", {
        telegramId,
        code: userError.code,
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
      });
      return {
        text: "No pude consultar tus alertas ahora mismo. Inténtalo de nuevo en unos segundos.",
      };
    }

    if (!user) {
      return {
        text: "Aún no tienes cuenta vinculada. Usa /start para empezar.",
      };
    }

    const { data: alerts, error: alertsError } = await client
      .from("alerts")
      .select(
        "id, keyword, url, brand, min_discount_percentage, max_price, min_price, is_active, product_id, category_id, categories(id, name, slug)",
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (alertsError) {
      console.error("[telegram] Mis alertas: error al leer tabla alerts", {
        userId: user.id,
        telegramId,
        code: alertsError.code,
        message: alertsError.message,
        details: alertsError.details,
        hint: alertsError.hint,
      });
      return {
        text: "No pude cargar tus alertas por un problema técnico. Inténtalo más tarde.",
      };
    }

    if (!alerts || alerts.length === 0) {
      return { text: EMPTY_ALERTS_MESSAGE };
    }

    const normalizedAlerts = (alerts ?? []).map((row) => ({
      ...(row as UserAlertRow),
      categories: resolveAlertCategory(
        (row as { categories?: UserAlertRow["categories"] | UserAlertRow["categories"][] })
          .categories,
      ),
    }));

    const lines = [
      "⚙️ <b>Tus alertas activas</b>",
      "",
      ...normalizedAlerts.map((alert, index) => formatAlertLine(index, alert)),
      "",
      "Pulsa un botón ❌ para eliminar una alerta:",
    ];

    return {
      text: lines.join("\n"),
      replyMarkup: buildDeleteAlertsMarkup(normalizedAlerts),
    };
  } catch (error) {
    console.error("[telegram] Mis alertas: excepción inesperada", error);
    return {
      text: "Hubo un problema técnico al consultar tus alertas. Usa /start e inténtalo de nuevo.",
    };
  }
}

/**
 * Guarda una alerta por palabra clave o URL de Amazon.
 * Usa el cliente service_role para saltar RLS.
 */
export async function handleNewAlert(message: TelegramMessage): Promise<void> {
  const chatId = message.chat?.id;
  const telegramId = message.from?.id;
  const rawText = message.text?.trim() ?? "";

  if (chatId === undefined || telegramId === undefined) {
    console.error("[telegram] handleNewAlert: mensaje sin chatId o telegramId", {
      message,
    });
    return;
  }

  const wizard = await getWizardDraft(telegramId);
  if (wizard?.step === "await_text") {
    await handleWizardTextInput(message, wizard);
    return;
  }

  if (!rawText) {
    await sendTelegramMessage({
      chatId,
      text: "Envía una palabra clave o pega una URL de Amazon, o usa «Crear alerta» en el menú.",
    });
    return;
  }

  const isUrlAlert = looksLikeAmazonUrl(rawText);
  const asin = isUrlAlert ? extractAsin(rawText) : null;

  if (isUrlAlert && !asin) {
    await sendTelegramMessage({
      chatId,
      text: "No pude extraer el ASIN de esa URL. Pega un enlace de producto de Amazon (con /dp/…).",
    });
    return;
  }

  const keyword = isUrlAlert ? null : rawText.slice(0, 120);
  const url = isUrlAlert ? rawText.slice(0, 500) : null;

  try {
    const client = createSupabaseServiceClient();

    const { data: user, error: userError } = await client
      .from("users")
      .select("id")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (userError) {
      console.error("[telegram] handleNewAlert: error exacto al buscar user_id", {
        telegramId,
        code: userError.code,
        message: userError.message,
        details: userError.details,
        hint: userError.hint,
      });
      await sendTelegramMessage({
        chatId,
        text: "Hubo un problema técnico al crear la alerta. Inténtalo de nuevo.",
      });
      return;
    }

    if (!user?.id) {
      await sendTelegramMessage({
        chatId,
        text: "Primero usa /start para vincular tu cuenta de Telegram.",
      });
      return;
    }

    let productId: string | null = null;
    let productTitle: string | null = null;
    let initialPrice: number | null = null;
    let catalogNote = "";

    if (isUrlAlert && asin && url) {
      try {
        const product = await ensureProductFromAmazonUrl(client, url);
        productId = product.id;
        productTitle = product.title;
        initialPrice = product.currentPrice;
        catalogNote = product.created
          ? "Producto añadido al catálogo."
          : "Producto ya estaba en el catálogo.";
      } catch (error) {
        console.error("[telegram] handleNewAlert: no se pudo crear producto", {
          asin,
          url,
          error: error instanceof Error ? error.message : error,
        });
        await sendTelegramMessage({
          chatId,
          text: "Pude leer la URL, pero no extraje el producto de Amazon (bloqueo o ficha rara). Inténtalo de nuevo en unos minutos.",
        });
        return;
      }
    }

    const { data: inserted, error: insertError } = await client
      .from("alerts")
      .insert({
        user_id: user.id,
        keyword: keyword ?? (productTitle ? productTitle.slice(0, 120) : null),
        url,
        product_id: productId,
        last_known_price: initialPrice,
        last_checked_at: productId ? new Date().toISOString() : null,
        is_active: true,
      })
      .select("id, keyword, url, product_id")
      .single();

    if (insertError) {
      console.error("[telegram] handleNewAlert: error exacto al insertar alerta", {
        telegramId,
        userId: user.id,
        keyword,
        url,
        productId,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });
      await sendTelegramMessage({
        chatId,
        text: "Hubo un problema técnico al crear la alerta. Inténtalo de nuevo.",
      });
      return;
    }

    const confirmation = inserted?.url
      ? [
          "✅ <b>Alerta de URL creada</b>",
          productTitle ? escapeHtml(productTitle) : "",
          catalogNote,
          initialPrice != null
            ? `Precio actual registrado: <b>${formatEuro(initialPrice)}</b>`
            : "",
          "Te avisaré cuando baje el precio.",
        ]
          .filter(Boolean)
          .join("\n")
      : `✅ Alerta creada para: ${escapeHtml(inserted?.keyword ?? keyword ?? "")}`;

    await sendTelegramMessage({
      chatId,
      text: confirmation,
    });
  } catch (error) {
    console.error("[telegram] handleNewAlert: excepción inesperada", {
      telegramId,
      keyword,
      url,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    await sendTelegramMessage({
      chatId,
      text: "Hubo un problema técnico al crear la alerta. Inténtalo de nuevo.",
    });
  }
}

export async function handleMyAlerts(
  telegramId: number,
  chatId: number,
): Promise<void> {
  const { text, replyMarkup } = await fetchUserAlerts(telegramId);
  await sendTelegramMessage({ chatId, text, replyMarkup });
}

async function handleDeleteAlert(options: {
  alertId: string;
  telegramId: number;
  chatId: number;
  messageId?: number;
}): Promise<void> {
  const client = createSupabaseServiceClient();

  const { data: user, error: userError } = await client
    .from("users")
    .select("id")
    .eq("telegram_id", options.telegramId)
    .maybeSingle();

  if (userError || !user) {
    console.error("[telegram] delete_alert: no se pudo resolver user_id", {
      telegramId: options.telegramId,
      error: userError,
    });
    await sendTelegramMessage({
      chatId: options.chatId,
      text: "No pude eliminar la alerta. Usa /start e inténtalo de nuevo.",
    });
    return;
  }

  const { data: deleted, error: deleteError } = await client
    .from("alerts")
    .delete()
    .eq("id", options.alertId)
    .eq("user_id", user.id)
    .select("id, keyword, url")
    .maybeSingle();

  if (deleteError) {
    console.error("[telegram] delete_alert: error exacto al borrar", {
      alertId: options.alertId,
      userId: user.id,
      code: deleteError.code,
      message: deleteError.message,
      details: deleteError.details,
      hint: deleteError.hint,
    });
    await sendTelegramMessage({
      chatId: options.chatId,
      text: "Hubo un problema técnico al eliminar la alerta.",
    });
    return;
  }

  if (!deleted) {
    await sendTelegramMessage({
      chatId: options.chatId,
      text: "No encontré esa alerta (puede que ya estuviera eliminada).",
    });
    return;
  }

  const confirmation = `🗑️ Alerta eliminada${
    deleted.keyword
      ? `: <b>${escapeHtml(deleted.keyword)}</b>`
      : deleted.url
        ? " de URL."
        : "."
  }`;

  if (options.messageId !== undefined) {
    try {
      await editTelegramMessage({
        chatId: options.chatId,
        messageId: options.messageId,
        text: confirmation,
        replyMarkup: { inline_keyboard: [] },
      });
      return;
    } catch (error) {
      console.error(
        "[telegram] delete_alert: no se pudo editar el mensaje, se envía uno nuevo",
        error,
      );
    }
  }

  await sendTelegramMessage({
    chatId: options.chatId,
    text: confirmation,
  });
}

async function safeAnswerCallbackQuery(callbackQueryId: string): Promise<void> {
  try {
    await answerCallbackQuery({ callbackQueryId });
  } catch (error) {
    console.error(
      "[telegram] Falló answerCallbackQuery (el botón puede seguir en 'cargando')",
      {
        callbackQueryId,
        error: error instanceof Error ? error.message : error,
      },
    );
  }
}

/**
 * Gestiona los clics del teclado inline del menú principal.
 * Siempre llama a answerCallbackQuery al final para quitar el estado de carga.
 */
export async function handleCallbackQuery(
  callbackQuery: TelegramCallbackQuery,
): Promise<void> {
  const chatId = extractCallbackChatId(callbackQuery);
  const messageId = callbackQuery.message?.message_id;
  const data = callbackQuery.data ?? "";

  console.info("[telegram] callback_query recibido", {
    id: callbackQuery.id,
    data,
    chatId,
    messageId,
    fromId: callbackQuery.from?.id,
    hasMessage: Boolean(callbackQuery.message),
  });

  try {
    if (chatId === null) {
      console.error(
        "[telegram] No se pudo extraer chatId de callbackQuery.message.chat.id ni de from.id",
        { callbackQuery },
      );
      return;
    }

    if (data === "menu:create_alert") {
      await handleCreateAlert(chatId, callbackQuery.from.id);
      return;
    }

    if (data.startsWith("wiz:")) {
      await handleWizardCallback({
        data,
        chatId,
        telegramId: callbackQuery.from.id,
        messageId,
      });
      return;
    }

    if (data === "menu:categories") {
      if (messageId === undefined) {
        await sendTelegramMessage({
          chatId,
          text: CATEGORIES_MENU_TEXT,
          replyMarkup: buildCategoriesMenuMarkup(),
        });
        return;
      }
      await handleCategoriesMenu(chatId, messageId);
      return;
    }

    if (data === "menu:home") {
      if (messageId === undefined) {
        await sendStartWelcome(chatId);
        return;
      }
      await handleHomeMenu(chatId, messageId);
      return;
    }

    if (data === "menu:best_deals") {
      await handleBestDeals(chatId);
      return;
    }

    if (data === "menu:my_alerts") {
      await handleMyAlerts(callbackQuery.from.id, chatId);
      return;
    }

    if (data.startsWith("delete_alert:")) {
      const alertId = data.slice("delete_alert:".length).trim();
      if (!alertId) {
        await sendTelegramMessage({
          chatId,
          text: "No pude identificar la alerta a eliminar.",
        });
        return;
      }

      await handleDeleteAlert({
        alertId,
        telegramId: callbackQuery.from.id,
        chatId,
        messageId,
      });
      return;
    }

    if (data.startsWith("category:")) {
      const slug = data.slice("category:".length);
      await handleCategoryPick(chatId, callbackQuery.from.id, slug);
      return;
    }

    await sendTelegramMessage({
      chatId,
      text: "Opción no reconocida. Usa /start para volver al menú.",
    });
  } catch (error) {
    console.error(
      "[telegram] Error manejando callback_query",
      {
        data,
        chatId,
        callbackQueryId: callbackQuery.id,
        message:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        cause:
          error instanceof Error && "cause" in error
            ? error.cause
            : undefined,
      },
    );

    if (chatId !== null) {
      try {
        await sendTelegramMessage({
          chatId,
          text: "Hubo un problema técnico al procesar el botón. Inténtalo de nuevo en unos segundos.",
        });
      } catch (notifyError) {
        console.error(
          "[telegram] Tampoco pude avisar al usuario del error técnico",
          notifyError,
        );
      }
    }
  } finally {
    await safeAnswerCallbackQuery(callbackQuery.id);
  }
}

/** @deprecated Usa handleCallbackQuery */
export const handleMenuCallback = handleCallbackQuery;
