/**
 * Proxy HTTP mínimo (solo CONNECT) en el Mac para que el VPS pueda salir a
 * Miravia por la IP residencial cuando WARP da captcha. Solo acepta hosts de
 * Miravia en el puerto 443: no es un proxy abierto.
 *
 * Escucha en 127.0.0.1:8902; el LaunchAgent com.cazaofertas.miravia-relay-tunnel
 * lo expone en el VPS como 127.0.0.1:8901 (ssh -R). En el VPS:
 *   MIRAVIA_EGRESS=http://127.0.0.1:40000,http://127.0.0.1:8901,direct
 */
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.MIRAVIA_RELAY_PORT ?? 8902);
const ALLOWED_HOST = /(^|\.)(miravia\.es|mrvcdn\.com)$/i;

const server = http.createServer((_req, res) => {
  res.writeHead(405).end("Solo CONNECT\n");
});

server.on("connect", (req, clientSocket, head) => {
  const [host, portRaw] = (req.url ?? "").split(":");
  const port = Number(portRaw);
  if (!host || port !== 443 || !ALLOWED_HOST.test(host)) {
    clientSocket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }

  const upstream = net.connect(port, host, () => {
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head.length > 0) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.setTimeout(30_000, () => upstream.destroy());
  upstream.on("error", () => clientSocket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"));
  clientSocket.on("error", () => upstream.destroy());
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[miravia-relay] escuchando en 127.0.0.1:${PORT}`);
});
