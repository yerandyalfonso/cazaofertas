import { randomUUID } from "node:crypto";
import {
  getFacebookGraphApiVersion,
  getFacebookPageAccessToken,
  getInstagramBusinessAccountId,
  isInstagramPublishingConfigured,
} from "@/lib/env";
import { pulseThemeForCategory } from "@/lib/pulse-category-theme";
import { renderSocialPulsePng } from "@/lib/render-social-pulse-card";
import { createSupabaseServiceClient } from "@/lib/supabase";
import type { DealCandidate } from "@/services/alertMatching";
import { buildFacebookDealMessage } from "@/services/facebook";

const GRAPH_TIMEOUT_MS = 25_000;
const AUTH_ERROR_CODES = new Set([190, 102, 463, 467, 458]);
const STORAGE_BUCKET = "article-images";

export interface InstagramPostResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  error?: string;
  tokenExpired?: boolean;
  mediaId?: string;
}

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
}

function graphUrl(path: string): string {
  const version = getFacebookGraphApiVersion();
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return `https://graph.facebook.com/${version}${trimmed}`;
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

function formatGraphError(payload: GraphErrorBody, status: number): string {
  const err = payload.error;
  if (!err?.message) return `Instagram Graph API HTTP ${status}`;
  const code = err.code != null ? ` (${err.code})` : "";
  return `${err.message}${code}`;
}

async function uploadPulsePngPublic(png: Buffer): Promise<string> {
  const client = createSupabaseServiceClient();
  const path = `social-pulse/${randomUUID()}.png`;
  const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, png, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) {
    throw new Error(`No se pudo subir PNG para Instagram: ${error.message}`);
  }
  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Supabase no devolvió URL pública del PNG.");
  }
  return data.publicUrl;
}

async function createInstagramImageContainer(options: {
  igUserId: string;
  imageUrl: string;
  caption: string;
}): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; tokenExpired: boolean }
> {
  const token = getFacebookPageAccessToken();
  if (!token) {
    return {
      ok: false,
      error: "Falta FACEBOOK_PAGE_ACCESS_TOKEN.",
      tokenExpired: false,
    };
  }

  const form = new URLSearchParams();
  form.set("access_token", token);
  form.set("image_url", options.imageUrl);
  form.set("caption", options.caption);

  const response = await fetch(
    graphUrl(`/${encodeURIComponent(options.igUserId)}/media`),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as GraphErrorBody & {
    id?: string;
  };

  if (!response.ok || payload.error || !payload.id) {
    const tokenExpired = isAuthError(payload);
    return {
      ok: false,
      tokenExpired,
      error: tokenExpired
        ? `Token caducado o sin permiso Instagram. ${formatGraphError(payload, response.status)}`
        : formatGraphError(payload, response.status),
    };
  }

  return { ok: true, id: payload.id };
}

async function publishInstagramContainer(options: {
  igUserId: string;
  creationId: string;
}): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; tokenExpired: boolean }
> {
  const token = getFacebookPageAccessToken();
  if (!token) {
    return {
      ok: false,
      error: "Falta FACEBOOK_PAGE_ACCESS_TOKEN.",
      tokenExpired: false,
    };
  }

  const form = new URLSearchParams();
  form.set("access_token", token);
  form.set("creation_id", options.creationId);

  const response = await fetch(
    graphUrl(`/${encodeURIComponent(options.igUserId)}/media_publish`),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    },
  );
  const payload = (await response.json().catch(() => ({}))) as GraphErrorBody & {
    id?: string;
  };

  if (!response.ok || payload.error || !payload.id) {
    const tokenExpired = isAuthError(payload);
    return {
      ok: false,
      tokenExpired,
      error: tokenExpired
        ? `Token caducado o sin permiso Instagram. ${formatGraphError(payload, response.status)}`
        : formatGraphError(payload, response.status),
    };
  }

  return { ok: true, id: payload.id };
}

/**
 * Publica el chollo en Instagram (cuenta Business vinculada a la Página).
 * Requiere INSTAGRAM_BUSINESS_ACCOUNT_ID + Page token con
 * instagram_basic + instagram_content_publish.
 * Nunca lanza: un fallo de Meta no debe romper Telegram.
 */
export async function postDealToInstagram(
  deal: DealCandidate,
): Promise<InstagramPostResult> {
  try {
    if (!isInstagramPublishingConfigured()) {
      return {
        ok: false,
        skipped: true,
        reason:
          "Instagram no configurado (INSTAGRAM_BUSINESS_ACCOUNT_ID + FACEBOOK_PAGE_ACCESS_TOKEN).",
      };
    }

    const igUserId = getInstagramBusinessAccountId();
    if (!igUserId) {
      return {
        ok: false,
        skipped: true,
        reason: "Falta INSTAGRAM_BUSINESS_ACCOUNT_ID.",
      };
    }

    const caption = buildFacebookDealMessage(deal).trim();
    if (!caption) {
      return {
        ok: false,
        skipped: false,
        error: "Caption de Instagram vacío; no se publica.",
      };
    }

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

    const imageUrl = await uploadPulsePngPublic(png);
    const container = await createInstagramImageContainer({
      igUserId,
      imageUrl,
      caption: caption.slice(0, 2200),
    });
    if (!container.ok) {
      console.error("[instagram]", container.error);
      return {
        ok: false,
        skipped: false,
        error: container.error,
        tokenExpired: container.tokenExpired,
      };
    }

    const published = await publishInstagramContainer({
      igUserId,
      creationId: container.id,
    });
    if (!published.ok) {
      console.error("[instagram]", published.error);
      return {
        ok: false,
        skipped: false,
        error: published.error,
        tokenExpired: published.tokenExpired,
      };
    }

    return { ok: true, skipped: false, mediaId: published.id };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Error desconocido al publicar en Instagram.";
    console.error(
      "[instagram] Error al publicar (no afecta a Telegram ni al chollo):",
      message,
    );
    return { ok: false, skipped: false, error: message };
  }
}

/** Resuelve el IG User ID vinculado a la Página (para rellenar .env). */
export async function resolveInstagramBusinessAccountId(): Promise<{
  ok: boolean;
  igUserId?: string;
  username?: string;
  error?: string;
}> {
  const token = getFacebookPageAccessToken();
  const pageId = process.env.FACEBOOK_PAGE_ID?.trim();
  if (!token || !pageId) {
    return {
      ok: false,
      error: "Faltan FACEBOOK_PAGE_ID o FACEBOOK_PAGE_ACCESS_TOKEN.",
    };
  }

  const url = new URL(graphUrl(`/${encodeURIComponent(pageId)}`));
  url.searchParams.set(
    "fields",
    "instagram_business_account{id,username}",
  );
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  const payload = (await response.json().catch(() => ({}))) as GraphErrorBody & {
    instagram_business_account?: { id?: string; username?: string };
  };

  if (!response.ok || payload.error) {
    return { ok: false, error: formatGraphError(payload, response.status) };
  }

  const ig = payload.instagram_business_account;
  if (!ig?.id) {
    return {
      ok: false,
      error:
        "La Página no tiene Instagram Business vinculado, o el token no incluye instagram_basic.",
    };
  }

  return { ok: true, igUserId: ig.id, username: ig.username };
}
