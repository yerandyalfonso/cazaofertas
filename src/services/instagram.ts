import { randomUUID } from "node:crypto";
import {
  getFacebookGraphApiVersion,
  getFacebookPageAccessToken,
  getInstagramBusinessAccountId,
  isInstagramPublishingConfigured,
} from "@/lib/env";
import { pulseThemeForCategory } from "@/lib/pulse-category-theme";
import {
  INSTAGRAM_PULSE_HEIGHT,
  INSTAGRAM_PULSE_WIDTH,
  renderSocialPulsePng,
} from "@/lib/render-social-pulse-card";
import { createSupabaseServiceClient, getPublicStorageUrl } from "@/lib/supabase";
import type { DealCandidate } from "@/services/alertMatching";
import { buildInstagramDealCaption } from "@/services/facebook";

const GRAPH_TIMEOUT_MS = 25_000;
const AUTH_ERROR_CODES = new Set([190, 102, 463, 467, 458]);
const STORAGE_BUCKET = "article-images";
/** Polling del contenedor IG antes de media_publish (error 9007 si aún no está listo). */
const CONTAINER_POLL_MS = 2_500;
const CONTAINER_POLL_MAX_MS = 90_000;

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
  return getPublicStorageUrl(STORAGE_BUCKET, path);
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

type ContainerStatusCode =
  | "EXPIRED"
  | "ERROR"
  | "FINISHED"
  | "IN_PROGRESS"
  | "PUBLISHED"
  | string;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getInstagramContainerStatus(
  creationId: string,
): Promise<
  | { ok: true; statusCode: ContainerStatusCode; status?: string }
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

  const url = new URL(graphUrl(`/${encodeURIComponent(creationId)}`));
  url.searchParams.set("fields", "status_code,status");
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString(), {
    method: "GET",
    signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
  });
  const payload = (await response.json().catch(() => ({}))) as GraphErrorBody & {
    status_code?: ContainerStatusCode;
    status?: string;
  };

  if (!response.ok || payload.error || !payload.status_code) {
    const tokenExpired = isAuthError(payload);
    return {
      ok: false,
      tokenExpired,
      error: tokenExpired
        ? `Token caducado o sin permiso Instagram. ${formatGraphError(payload, response.status)}`
        : formatGraphError(payload, response.status),
    };
  }

  return {
    ok: true,
    statusCode: payload.status_code,
    status: payload.status,
  };
}

/**
 * Espera FINISHED/PUBLISHED antes de media_publish.
 * Evita error 9007 "Media ID is not available".
 */
async function waitForInstagramContainerReady(
  creationId: string,
): Promise<
  | { ok: true; statusCode: ContainerStatusCode }
  | { ok: false; error: string; tokenExpired: boolean }
> {
  const started = Date.now();
  let lastStatus: ContainerStatusCode | undefined;

  while (Date.now() - started < CONTAINER_POLL_MAX_MS) {
    const status = await getInstagramContainerStatus(creationId);
    if (!status.ok) return status;

    lastStatus = status.statusCode;
    if (status.statusCode === "FINISHED" || status.statusCode === "PUBLISHED") {
      return { ok: true, statusCode: status.statusCode };
    }
    if (status.statusCode === "ERROR" || status.statusCode === "EXPIRED") {
      const detail = status.status ? ` — ${status.status}` : "";
      return {
        ok: false,
        tokenExpired: false,
        error: `Contenedor Instagram ${status.statusCode}${detail}`,
      };
    }

    await sleep(CONTAINER_POLL_MS);
  }

  return {
    ok: false,
    tokenExpired: false,
    error: `Timeout esperando contenedor Instagram (último estado: ${lastStatus ?? "desconocido"}).`,
  };
}

function isMediaNotReadyError(payload: GraphErrorBody): boolean {
  const code = payload.error?.code;
  const message = payload.error?.message?.toLowerCase() ?? "";
  return (
    code === 9007 ||
    message.includes("media id is not available") ||
    message.includes("not ready for publishing")
  );
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

  const tryPublish = async (): Promise<
    | { ok: true; id: string }
    | { ok: false; payload: GraphErrorBody; status: number }
  > => {
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
    if (response.ok && !payload.error && payload.id) {
      return { ok: true, id: payload.id };
    }
    return { ok: false, payload, status: response.status };
  };

  // Una sola publicación; si 9007, espera FINISHED/PUBLISHED y como máximo
  // un segundo intento (evita doble post si Meta ya publicó sin devolver id).
  const first = await tryPublish();
  if (first.ok) return first;

  if (!isMediaNotReadyError(first.payload)) {
    const tokenExpired = isAuthError(first.payload);
    return {
      ok: false,
      tokenExpired,
      error: tokenExpired
        ? `Token caducado o sin permiso Instagram. ${formatGraphError(first.payload, first.status)}`
        : formatGraphError(first.payload, first.status),
    };
  }

  console.warn("[instagram] Media aún no listo; esperando y reintentando una vez…");
  const ready = await waitForInstagramContainerReady(options.creationId);
  if (!ready.ok) return ready;
  if (ready.statusCode === "PUBLISHED") {
    return { ok: true, id: options.creationId };
  }

  const second = await tryPublish();
  if (second.ok) return second;

  // Tras el 2º intento: si ya quedó PUBLISHED, no es error (ni hay que republicar).
  const after = await getInstagramContainerStatus(options.creationId);
  if (after.ok && after.statusCode === "PUBLISHED") {
    return { ok: true, id: options.creationId };
  }

  const tokenExpired = isAuthError(second.payload);
  return {
    ok: false,
    tokenExpired,
    error: tokenExpired
      ? `Token caducado o sin permiso Instagram. ${formatGraphError(second.payload, second.status)}`
      : formatGraphError(second.payload, second.status),
  };
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

    const caption = buildInstagramDealCaption(deal).trim();
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
    // 1080×1350 (4:5): máximo en feed; cuadrícula ~3:4 recorta poco a los lados.
    const png = await renderSocialPulsePng({
      title: deal.title,
      imageUrl: deal.imageUrl,
      currentPrice: deal.currentPrice,
      previousPrice: deal.previousPrice,
      discountPercentage: deal.discountPercentage,
      pulseThemeId: themeId,
      width: INSTAGRAM_PULSE_WIDTH,
      height: INSTAGRAM_PULSE_HEIGHT,
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

    const ready = await waitForInstagramContainerReady(container.id);
    if (!ready.ok) {
      console.error("[instagram]", ready.error);
      return {
        ok: false,
        skipped: false,
        error: ready.error,
        tokenExpired: ready.tokenExpired,
      };
    }
    if (ready.statusCode === "PUBLISHED") {
      return { ok: true, skipped: false, mediaId: container.id };
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
