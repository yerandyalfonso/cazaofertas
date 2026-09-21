import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type TypedSupabaseClient = SupabaseClient<Database>;

/** Evita que el build de Vercel se quede colgado >60s en páginas estáticas. */
function fetchWithTimeout(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const parent = init?.signal;
    if (parent) {
      if (parent.aborted) controller.abort();
      else {
        parent.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createSupabaseBrowserClient(): TypedSupabaseClient {
  const env = getPublicEnv();

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createSupabaseServiceClient(): TypedSupabaseClient {
  const env = getServerEnv();

  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: fetchWithTimeout(18_000),
      },
    },
  );
}

/**
 * URL pública de un objeto de Storage, alcanzable desde fuera del servidor
 * (Meta/Instagram, navegadores, etc).
 *
 * `NEXT_PUBLIC_SUPABASE_URL` puede ser una URL interna (p. ej. `http://127.0.0.1:8000`
 * en el VPS, para que las llamadas server-to-server sean rápidas y no salgan a
 * internet). Esa URL interna NO sirve para generar links públicos: Instagram
 * necesita poder descargar la imagen desde fuera, así que usamos
 * `NEXT_PUBLIC_SITE_URL` (el dominio público real) como base cuando está definida.
 */
export function getPublicStorageUrl(bucket: string, path: string): string {
  const publicBase = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const base = publicBase || getPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
