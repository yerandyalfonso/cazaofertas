import { getIndexNowKey } from "@/services/indexNow";

// IndexNow comprueba que la clave que enviamos está publicada en nuestro dominio.
export function GET() {
  const key = getIndexNowKey();
  if (!key) return new Response("Not found", { status: 404 });
  return new Response(key, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
