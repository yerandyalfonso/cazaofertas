import { buildTrackedAffiliateUrl } from "@/lib/affiliate-tracking";
import {
  getFacebookGraphApiVersion,
  getFacebookPageAccessToken,
  getFacebookPageId,
  isFacebookPageConfigured,
} from "@/lib/env";
import { formatEuro } from "@/lib/money";
import { renderSocialPulsePng } from "@/lib/render-social-pulse-card";
import { pulseThemeForCategory } from "@/lib/pulse-category-theme";
import { marketplaceAbsoluteUrl } from "@/lib/site";
import type { DealCandidate } from "@/services/alertMatching";
import { DealLevel } from "@/types";

const GRAPH_TIMEOUT_MS = 20_000;
const AUTH_ERROR_CODES = new Set([190, 102, 463, 467, 458]);

const CATEGORY_EMOJI: Record<string, string> = {
  bebe: "🍼",
  tecnologia: "📱",
  informatica: "💻",
  moda: "👗",
  belleza: "💄",
  automovil: "🚗",
  deportes: "🏃",
  hogar: "🏠",
  jardin: "🌿",
  juguetes: "🧸",
  mascotas: "🐾",
  videojuegos: "🎮",
  oficina: "📎",
  otros: "📦",
};

interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
}

interface GraphPostSuccess {
  id?: string;
  post_id?: string;
}

export interface FacebookPostResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  error?: string;
  tokenExpired?: boolean;
  postId?: string;
}

function categoryEmoji(slug: string | null | undefined): string {
  const key = slug?.trim().toLowerCase();
  if (key && CATEGORY_EMOJI[key]) return CATEGORY_EMOJI[key]!;
  return "🔥";
}

function dealHeadline(level: DealLevel, brand: string | null | undefined): string {
  const by = brand?.trim() || "Amazon";
  switch (level) {
    case DealLevel.HISTORICAL_LOW:
      return `Chollazo de ${by}`;
    case DealLevel.GREAT_DEAL:
      return `Gran oferta de ${by}`;
    case DealLevel.GOOD_DEAL:
      return `Buena oferta de ${by}`;
    default:
      return `Oferta de ${by}`;
  }
}

function truncatePlain(value: string, maxChars: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function formatDealStamp(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function graphUrl(path: string): string {
  const version = getFacebookGraphApiVersion();
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `https://graph.facebook.com/${version}${trimmed}`;
}

function formatGraphError(payload: GraphErrorBody, status: number): string {
  const err = payload.error;
  if (!err?.message) {
    return `Facebook Graph API HTTP ${status}`;
  }
  const code = err.code != null ? ` (${err.code})` : "";
  return `${err.message}${code}`;
}

function isAuthError(payload: GraphErrorBody): boolean {
  const code = payload.error?.code;
  const sub = payload.error?.error_subcode;
  if (code != null && AUTH_ERROR_CODES.has(code)) return true;
  if (sub != null && AUTH_ERROR_CODES.has(sub)) return true;
  const message = payload.error?.message?.toLowerCase() ?? "";
  return (
    message.includes("session has expired") ||
    message.includes("invalid oauth") ||
    (message.includes("access token") && message.includes("expired"))
  );
}

type GraphResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string; tokenExpired: boolean };

function parseGraphResponse(
  response: Response,
  payload: GraphErrorBody & GraphPostSuccess,
): GraphResult {
  if (!response.ok || payload.error) {
    const tokenExpired = isAuthError(payload);
    const error = tokenExpired
      ? `Token de Facebook caducado o inválido. Regenera FACEBOOK_PAGE_ACCESS_TOKEN. ${formatGraphError(payload, response.status)}`
      : formatGraphError(payload, response.status);
    return { ok: false, error, tokenExpired };
  }
  return { ok: true, id: payload.id ?? payload.post_id ?? null };
}

async function graphPost(
  path: string,
  body: Record<string, string | boolean | number>,
): Promise<GraphResult> {
  const token = getFacebookPageAccessToken();
  if (!token) {
    return { ok: false, error: "Falta FACEBOOK_PAGE_ACCESS_TOKEN.", tokenExpired: false };
  }

  // Graph API es más fiable con form-urlencoded que con JSON (caption/message a veces se ignora).
  const form = new URLSearchParams();
  form.set("access_token", token);
  for (const [key, value] of Object.entries(body)) {
    form.set(key, String(value));
  }

  const response = await fetch(graphUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => ({}))) as GraphErrorBody &
    GraphPostSuccess;
  return parseGraphResponse(response, payload);
}

async function graphPostMultipart(
  path: string,
  form: FormData,
): Promise<GraphResult> {
  const token = getFacebookPageAccessToken();
  if (!token) {
    return { ok: false, error: "Falta FACEBOOK_PAGE_ACCESS_TOKEN.", tokenExpired: false };
  }
  form.set("access_token", token);

  const response = await fetch(graphUrl(path), {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });

  const payload = (await response.json().catch(() => ({}))) as GraphErrorBody &
    GraphPostSuccess;
  return parseGraphResponse(response, payload);
}

/**
 * Publica una sola foto en el muro de la Página (un POST = un post).
 * Evita el flujo unpublished + /feed attached_media, que a menudo
 * genera dos entradas en el feed (foto publicada + post adjunto).
 */
async function postPagePhoto(options: {
  pageId: string;
  message: string;
  imageUrl?: string;
  png?: Buffer;
}): Promise<GraphResult> {
  if (options.png) {
    const form = new FormData();
    form.set(
      "source",
      new Blob([new Uint8Array(options.png)], { type: "image/png" }),
      "alerta-yir.png",
    );
    form.set("caption", options.message);
    form.set("published", "true");
    return graphPostMultipart(
      `/${encodeURIComponent(options.pageId)}/photos`,
      form,
    );
  }

  if (options.imageUrl) {
    return graphPost(`/${encodeURIComponent(options.pageId)}/photos`, {
      url: options.imageUrl,
      caption: options.message,
      published: true,
    });
  }

  return {
    ok: false,
    error: "Falta imagen para publicar en Facebook.",
    tokenExpired: false,
  };
}

/**
 * Texto del post en Facebook (caption + enlace afiliado trackeado).
 */
export function buildFacebookDealMessage(deal: DealCandidate): string {
  const emoji = categoryEmoji(deal.parentCategorySlug ?? deal.categorySlug);
  const offerUrl = buildTrackedAffiliateUrl({
    productId: deal.productId,
    source: "facebook",
  });

  const lines = [
    `${emoji} ${dealHeadline(deal.dealLevel, deal.brand)}`,
    "",
    truncatePlain(deal.title, 140),
  ];

  const category =
    deal.parentCategoryName &&
    deal.categoryName &&
    deal.parentCategoryName !== deal.categoryName
      ? `${deal.parentCategoryName} · ${deal.categoryName}`
      : deal.categoryName?.trim() || deal.parentCategoryName?.trim();
  if (category) {
    lines.push(category);
  }

  lines.push(
    "",
    `💰 Oferta: ${formatEuro(deal.currentPrice)}`,
    `🏷️ Antes: ${formatEuro(deal.previousPrice)}`,
    `📉 Descuento: −${Math.round(deal.discountPercentage)}%`,
  );

  if (deal.detectedAt) {
    lines.push(`📅 Publicada: ${formatDealStamp(deal.detectedAt)}`);
  }
  if (deal.expiresAt && new Date(deal.expiresAt).getTime() > Date.now()) {
    lines.push(`⏳ Vence: ${formatDealStamp(deal.expiresAt)}`);
  }

  lines.push("", "🛒 Ver oferta:", offerUrl);

  if (deal.productSlug?.trim()) {
    lines.push(
      "",
      "🌐 Ficha en CazaOferta:",
      marketplaceAbsoluteUrl(`/oferta/${deal.productSlug.trim()}`),
    );
  }

  return lines.join("\n");
}

/**
 * Caption Instagram: mismos datos que Facebook, sin URLs
 * (ni caption ni comentarios son clicables en IG).
 */
export function buildInstagramDealCaption(deal: DealCandidate): string {
  const full = buildFacebookDealMessage(deal);
  const withoutUrls = full
    .split("\n")
    .filter((line) => !/^https?:\/\//i.test(line.trim()))
    .join("\n")
    .replace(/\n🛒 Ver oferta:\s*\n+/g, "\n")
    .replace(/\n🌐 Ficha en CazaOferta:\s*\n+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `${withoutUrls}\n\n🔗 Enlace en la bio / Facebook`;
}

/**
 * Publica el chollo en la Página de Facebook.
 * Nunca lanza: un fallo de Meta no debe romper Telegram ni el guardado.
 */
export async function postDealToFacebookPage(
  deal: DealCandidate,
): Promise<FacebookPostResult> {
  try {
    if (!isFacebookPageConfigured()) {
      return {
        ok: false,
        skipped: true,
        reason: "Facebook no configurado (FACEBOOK_PAGE_ID / FACEBOOK_PAGE_ACCESS_TOKEN).",
      };
    }

    const pageId = getFacebookPageId();
    if (!pageId) {
      return {
        ok: false,
        skipped: true,
        reason: "Falta FACEBOOK_PAGE_ID.",
      };
    }

    const message = buildFacebookDealMessage(deal).trim();
    if (!message) {
      return {
        ok: false,
        skipped: false,
        error: "Mensaje de Facebook vacío; no se publica.",
      };
    }

    // 1) Plantilla Alerta YIR (PNG) — color por categoría padre.
    try {
      const themeId = pulseThemeForCategory(
        deal.parentCategorySlug,
        deal.categorySlug,
      );
      const png = await renderSocialPulsePng({
        title: deal.title,
        imageUrl: deal.imageUrl,
        currentPrice: deal.currentPrice,
        previousPrice: deal.previousPrice,
        discountPercentage: deal.discountPercentage,
        pulseThemeId: themeId,
      });
      const withTemplate = await postPagePhoto({
        pageId,
        message,
        png,
      });
      if (withTemplate.ok) {
        return {
          ok: true,
          skipped: false,
          postId: withTemplate.id ?? undefined,
        };
      }
      console.warn(
        "[facebook] Plantilla YIR falló; se intenta imagen de producto.",
        withTemplate.error,
      );
      if (withTemplate.tokenExpired) {
        console.error("[facebook]", withTemplate.error);
        return {
          ok: false,
          skipped: false,
          error: withTemplate.error,
          tokenExpired: true,
        };
      }
    } catch (renderError) {
      const detail =
        renderError instanceof Error
          ? renderError.message
          : "Error al renderizar plantilla YIR.";
      console.warn("[facebook] Render YIR falló; se intenta imagen de producto.", detail);
    }

    // 2) Fallback: foto del producto (URL pública).
    const imageUrl = deal.imageUrl?.trim();
    const canUsePhoto = Boolean(imageUrl && /^https?:\/\//i.test(imageUrl));

    if (canUsePhoto && imageUrl) {
      const withPhoto = await postPagePhoto({ pageId, message, imageUrl });
      if (withPhoto.ok) {
        return { ok: true, skipped: false, postId: withPhoto.id ?? undefined };
      }
      console.warn(
        "[facebook] Foto falló; se publica solo texto en /feed.",
        withPhoto.error,
      );
      if (withPhoto.tokenExpired) {
        console.error("[facebook]", withPhoto.error);
        return {
          ok: false,
          skipped: false,
          error: withPhoto.error,
          tokenExpired: true,
        };
      }
    }

    // 3) Solo texto.
    const feed = await graphPost(`/${encodeURIComponent(pageId)}/feed`, {
      message,
    });
    if (feed.ok) {
      return { ok: true, skipped: false, postId: feed.id ?? undefined };
    }

    if (feed.tokenExpired) {
      console.error("[facebook]", feed.error);
    } else {
      console.error("[facebook] Error al publicar:", feed.error);
    }
    return {
      ok: false,
      skipped: false,
      error: feed.error,
      tokenExpired: feed.tokenExpired,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al publicar en Facebook.";
    console.error(
      "[facebook] Error al publicar (no afecta a Telegram ni al chollo):",
      message,
    );
    return { ok: false, skipped: false, error: message };
  }
}

/** Comprueba token y página sin publicar. */
export async function verifyFacebookPageCredentials(): Promise<{
  ok: boolean;
  pageId?: string;
  pageName?: string;
  error?: string;
  tokenExpired?: boolean;
}> {
  try {
    const pageId = getFacebookPageId();
    const token = getFacebookPageAccessToken();
    if (!pageId || !token) {
      return {
        ok: false,
        error: "Faltan FACEBOOK_PAGE_ID o FACEBOOK_PAGE_ACCESS_TOKEN en .env.local.",
      };
    }

    const url = new URL(graphUrl(`/${encodeURIComponent(pageId)}`));
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("access_token", token);

    const response = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as GraphErrorBody & {
      id?: string;
      name?: string;
    };

    if (!response.ok || payload.error) {
      const tokenExpired = isAuthError(payload);
      return {
        ok: false,
        error: formatGraphError(payload, response.status),
        tokenExpired,
      };
    }

    return {
      ok: true,
      pageId: payload.id,
      pageName: payload.name,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al verificar Facebook.",
    };
  }
}
