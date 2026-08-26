import {
  extractAsin,
  generateAffiliateUrl,
  looksLikeAmazonUrl,
} from "@/lib/affiliate";
import { getTelegramChannelId, getTelegramEnv } from "@/lib/env";
import { formatEuro, requireNumber, toNumber } from "@/lib/money";
import { absoluteUrl } from "@/lib/site";
import { createSupabaseServiceClient } from "@/lib/supabase";
import type { DealCandidate } from "@/services/alertMatching";
import { dealScoringService } from "@/services/deal-scoring";
import { ensureProductFromAmazonUrl } from "@/services/products";
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

const EXAMPLE_CATEGORIES = [
  { label: "Electrónica", slug: "tecnologia" },
  { label: "Hogar", slug: "hogar" },
  { label: "Moda", slug: "moda" },
  { label: "Belleza", slug: "belleza" },
  { label: "Deportes", slug: "deportes" },
  { label: "Juguetes", slug: "juguetes" },
  { label: "Informática", slug: "informatica" },
] as const;

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
}): Promise<TelegramMessage> {
  return callTelegramApi<TelegramMessage>("sendMessage", {
    chat_id: options.chatId,
    text: options.text,
    parse_mode: options.parseMode ?? "HTML",
    reply_markup: options.replyMarkup,
    disable_web_page_preview: options.disableWebPagePreview ?? true,
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

function dealHeadline(level: DealLevel): string {
  switch (level) {
    case DealLevel.HISTORICAL_LOW:
      return "🔥 MÍNIMO HISTÓRICO";
    case DealLevel.GREAT_DEAL:
      return "🔥 GRAN OFERTA";
    case DealLevel.GOOD_DEAL:
      return "🔥 BUENA OFERTA";
    default:
      return "🔥 OFERTA";
  }
}

export function buildDealAlertText(deal: DealCandidate): string {
  const label =
    deal.dealLabel ??
    dealScoringService.getLabel(deal.dealLevel);
  const scoreLine =
    deal.score != null
      ? `⭐ Score ${Math.round(deal.score)} · ${escapeHtml(label)}`
      : `⭐ ${escapeHtml(label)}`;

  const lines = [
    dealHeadline(deal.dealLevel),
    "",
    `<b>${escapeHtml(deal.title)}</b>`,
    "",
    `💰 Oferta: <b>${formatEuro(deal.currentPrice)}</b>`,
    `Antes: <s>${formatEuro(deal.previousPrice)}</s>`,
    `📉 Descuento: <b>−${Math.round(deal.discountPercentage)}%</b>`,
    scoreLine,
  ];

  if (deal.nearHistoricalLow) {
    lines.push("🏷 Cerca del mínimo histórico");
  }

  if (deal.categoryName) {
    lines.push(`📁 ${escapeHtml(deal.categoryName)}`);
  }

  return lines.join("\n");
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
  "🔥 Amazon Deals",
  "",
  "Encuentra las mejores ofertas de Amazon España.",
  "",
  "Puedes crear alertas personalizadas y recibir únicamente los productos que te interesan.",
].join("\n");

const CATEGORIES_MENU_TEXT = [
  "📂 Categorías",
  "",
  "Elige una categoría para explorar ofertas:",
].join("\n");

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
}): Promise<TelegramMessage> {
  return sendTelegramMessage({
    chatId: options.chatId,
    text: buildDealAlertText(options.deal),
    disableWebPagePreview: false,
    replyMarkup: buildOfferActionMarkup({
      affiliateUrl: options.deal.affiliateUrl,
      productSlug: options.deal.productSlug,
    }),
  });
}

/**
 * Publica un chollo en el canal configurado (TELEGRAM_CHANNEL_ID).
 */
export async function sendChannelDealAlert(
  deal: DealCandidate,
): Promise<TelegramMessage> {
  const channelId = getTelegramChannelId();
  if (!channelId) {
    throw new Error("Falta TELEGRAM_CHANNEL_ID en el entorno.");
  }
  return sendDealAlertMessage({ chatId: channelId, deal });
}

async function handleCreateAlert(chatId: number): Promise<void> {
  await sendTelegramMessage({
    chatId,
    text: [
      "🔔 <b>Nueva alerta</b>",
      "",
      "Envía:",
      "• Una <b>palabra clave</b> (ej: airpods, silla gaming)",
      "• O pega la <b>URL de Amazon</b> del producto que quieres vigilar",
    ].join("\n"),
  });
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
  slug: string,
): Promise<void> {
  const category =
    EXAMPLE_CATEGORIES.find((item) => item.slug === slug)?.label ?? slug;

  await sendTelegramMessage({
    chatId,
    text: `Has elegido <b>${escapeHtml(category)}</b>. Pronto verás ofertas filtradas por esta categoría.`,
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
        title: product.title,
        currentPrice,
        previousPrice,
        discountPercentage,
        scoring,
        affiliateUrl: generateAffiliateUrl({
          affiliate_url: product.affiliate_url ?? undefined,
          asin: product.asin,
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
      `${dealHeadline(deal.scoring.level)}`,
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
}

function formatAlertLine(index: number, alert: UserAlertRow): string {
  const parts: string[] = [];

  if (alert.url) {
    parts.push(`🔗 URL Amazon`);
  }
  if (alert.keyword) {
    parts.push(`🔑 ${escapeHtml(alert.keyword)}`);
  }
  if (alert.brand) {
    parts.push(`Marca: ${escapeHtml(alert.brand)}`);
  }
  if (alert.product_id) {
    parts.push("Producto específico");
  }
  if (alert.category_id) {
    parts.push("Por categoría");
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
      const label =
        alert.keyword?.trim() || (alert.url ? "URL Amazon" : "alerta");
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
        "id, keyword, url, brand, min_discount_percentage, max_price, min_price, is_active, product_id, category_id",
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

    const lines = [
      "⚙️ <b>Tus alertas activas</b>",
      "",
      ...alerts.map((alert, index) => formatAlertLine(index, alert)),
      "",
      "Pulsa un botón ❌ para eliminar una alerta:",
    ];

    return {
      text: lines.join("\n"),
      replyMarkup: buildDeleteAlertsMarkup(alerts),
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

  if (!rawText) {
    await sendTelegramMessage({
      chatId,
      text: "Envía una palabra clave o pega una URL de Amazon para crear la alerta.",
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

async function handleMyAlerts(telegramId: number, chatId: number): Promise<void> {
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
      await handleCreateAlert(chatId);
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
      await handleCategoryPick(chatId, slug);
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
