/**
 * Perfil del bot en Telegram: comandos del botón «Menú», descripción que se ve
 * antes de pulsar «Iniciar» y texto corto del perfil. Idempotente: relanzar si
 * cambian los comandos de `handleTelegramCommand`.
 *
 * Uso: npx tsx --env-file=.env.local scripts/telegram/setup-bot-profile.ts
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN.");

const COMMANDS = [
  { command: "start", description: "Menú principal" },
  { command: "addalert", description: "Crear una alerta de precio" },
  { command: "alerts", description: "Ver y borrar tus alertas" },
  { command: "products", description: "Mejores ofertas ahora" },
  { command: "categories", description: "Alertas por categoría" },
  { command: "settings", description: "Ajustes" },
  { command: "help", description: "Ayuda" },
];

const DESCRIPTION = [
  "🎯 Chollos reales con historial de precios.",
  "",
  "Pega el enlace de un producto (Amazon, Miravia, Kiabi, Carrefour, MediaMarkt, PcComponentes…) o elige una categoría y te avisamos solo cuando baje de verdad.",
  "",
  "Pulsa «Iniciar» para empezar.",
].join("\n");

const SHORT_DESCRIPTION = "Alertas de precio y chollos reales. Te avisamos cuando baja lo que te interesa.";

async function call(method: string, body: unknown): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  console.log(`✓ ${method}`);
}

(async () => {
  // Solo chats privados: el grupo y el canal no usan comandos.
  await call("setMyCommands", { commands: COMMANDS, scope: { type: "all_private_chats" } });
  await call("setChatMenuButton", { menu_button: { type: "commands" } });
  await call("setMyDescription", { description: DESCRIPTION });
  await call("setMyShortDescription", { short_description: SHORT_DESCRIPTION });
})();
