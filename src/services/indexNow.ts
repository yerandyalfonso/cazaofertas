import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import {
  absoluteUrl,
  getMarketplaceSiteUrl,
  getSiteUrl,
  marketplaceAbsoluteUrl,
} from "@/lib/site";
import { createSupabaseServiceClient } from "@/lib/supabase";

/**
 * IndexNow: avisa a Bing (y a Yandex, Seznam… que comparten la API) de URLs
 * nuevas o cambiadas del blog. La clave va en `INDEXNOW_KEY` y se publica en
 * `/indexnow-key.txt` (ver `src/app/indexnow-key.txt/route.ts`).
 * Sin clave no hace nada; nunca lanza: un fallo de aviso no debe romper el guardado.
 */
export function getIndexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim();
  return key && /^[a-zA-Z0-9-]{8,128}$/.test(key) ? key : null;
}

export async function submitIndexNow(paths: string[]): Promise<void> {
  await submitIndexNowFor(getSiteUrl(), absoluteUrl, paths);
}

/** Envía rutas de un sitio (blog o marketplace); la clave debe estar en `<sitio>/indexnow-key.txt`. */
async function submitIndexNowFor(
  site: string,
  toUrl: (path: string) => string,
  paths: string[],
): Promise<number | null> {
  const key = getIndexNowKey();
  if (!key || paths.length === 0) return null;
  if (site.includes("localhost") || site.includes("127.0.0.1")) return null;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(site).host,
        key,
        keyLocation: toUrl("/indexnow-key.txt"),
        urlList: [...new Set(paths.map((path) => toUrl(path)))],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok && res.status !== 202) {
      console.warn(`[indexnow] ${res.status} ${await res.text().catch(() => "")}`);
    }
    return res.status;
  } catch (error) {
    console.warn("[indexnow] aviso fallido", error);
    return null;
  }
}

/**
 * Marketplace: fichas `/oferta/<slug>` creadas o con cambio de precio en las
 * últimas `sinceHours` horas (job diario `indexnow-marketplace` del VPS).
 */
export async function submitMarketplaceChanges(
  sinceHours = 25,
): Promise<{ urls: number; status: number | null }> {
  const since = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  // La vista `marketplace_products` no está en los tipos generados.
  const client = createSupabaseServiceClient() as unknown as SupabaseClient;
  const slugs = new Set<string>();
  for (const column of ["created_at", "previous_price_observed_at"] as const) {
    for (let from = 0; from < 10_000; from += 1000) {
      const { data, error } = await client
        .from("marketplace_products")
        .select("slug")
        .eq("is_active", true)
        .gte(column, since)
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(`IndexNow marketplace: ${error.message}`);
      for (const row of data ?? []) if (row.slug) slugs.add(row.slug as string);
      if (!data || data.length < 1000) break;
    }
  }
  const paths = [...slugs].slice(0, 9_999).map((slug) => `/oferta/${slug}`);
  if (paths.length === 0) return { urls: 0, status: null };
  const status = await submitIndexNowFor(
    getMarketplaceSiteUrl(),
    marketplaceAbsoluteUrl,
    ["/", ...paths],
  );
  return { urls: paths.length, status };
}

/**
 * Artículo publicado, cambiado o archivado: su URL y el listado del blog.
 * Se envía con `after()` para no retrasar la respuesta del admin.
 */
export function notifyArticleChanged(slug: string | null | undefined): void {
  if (!slug) return;
  after(() => submitIndexNow([`/blog/${slug}`, "/blog"]));
}
