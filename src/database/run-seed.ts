import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Carga .env.local antes de cualquier import que lea process.env
loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { seedFromMockProvider } = await import("@/database/seed");
  const result = await seedFromMockProvider();
  console.log("Seed completado:", JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Error en seed:", error);
  process.exit(1);
});
