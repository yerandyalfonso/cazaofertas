import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Carga .env.local antes de cualquier import que lea process.env
loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { seedBlogArticles } = await import("@/database/seed");
  const result = await seedBlogArticles();

  console.log("Seed de blog completado:");
  console.log(`  Artículos nuevos (borrador): ${result.articles}`);
  console.log(`  Enlaces article_products: ${result.articleProducts}`);
  console.log(`  Slugs: ${result.articlesUpserted.join(", ")}`);

  if (result.missingProductSlugs.length > 0) {
    console.warn(
      "\nProductos no encontrados (ejecuta `npm run seed` antes si hace falta):",
    );
    for (const slug of result.missingProductSlugs) {
      console.warn(`  - ${slug}`);
    }
  }
}

main().catch((error) => {
  console.error("Error en seed:blog:", error);
  process.exit(1);
});
