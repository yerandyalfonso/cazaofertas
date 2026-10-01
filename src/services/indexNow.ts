import { after } from "next/server";
import { absoluteUrl, getSiteUrl } from "@/lib/site";

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
  const key = getIndexNowKey();
  if (!key || paths.length === 0) return;
  const site = getSiteUrl();
  if (site.includes("localhost") || site.includes("127.0.0.1")) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(site).host,
        key,
        keyLocation: absoluteUrl("/indexnow-key.txt"),
        urlList: [...new Set(paths.map((path) => absoluteUrl(path)))],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok && res.status !== 202) {
      console.warn(`[indexnow] ${res.status} ${await res.text().catch(() => "")}`);
    }
  } catch (error) {
    console.warn("[indexnow] aviso fallido", error);
  }
}

/**
 * Artículo publicado, cambiado o archivado: su URL y el listado del blog.
 * Se envía con `after()` para no retrasar la respuesta del admin.
 */
export function notifyArticleChanged(slug: string | null | undefined): void {
  if (!slug) return;
  after(() => submitIndexNow([`/blog/${slug}`, "/blog"]));
}
