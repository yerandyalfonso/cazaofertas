/**
 * Estadísticas del test de carga de alertas (las mismas que llegan al chat
 * del admin cada 2 h). Uso: npx tsx scripts/alert-load-test/report.mts [--telegram]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { buildAlertLoadReport, formatAlertLoadReport, sendAlertLoadReport } = await import(
  "@/services/alertLoadTest"
);
if (process.argv.includes("--telegram")) {
  console.log((await sendAlertLoadReport(2)) ?? "No hay usuarios de prueba.");
} else {
  const report = await buildAlertLoadReport(2);
  console.log(report ? formatAlertLoadReport(report).replace(/<[^>]+>/g, "") : "No hay usuarios de prueba.");
}
