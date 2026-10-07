// IndexNow comprueba que la clave que enviamos está publicada en nuestro dominio
// (la misma `INDEXNOW_KEY` que el blog; ver src/services/indexNow.ts).
export function GET() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(key, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
