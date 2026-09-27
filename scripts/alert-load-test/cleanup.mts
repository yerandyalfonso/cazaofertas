/**
 * Borra los usuarios de prueba (`is_test`) y, en cascada, sus alertas y
 * notificaciones. Uso: npx tsx scripts/alert-load-test/cleanup.mts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
const { createSupabaseServiceClient } = await import("@/lib/supabase");
const sb = createSupabaseServiceClient();
const { data, error } = await sb.from("users").delete().eq("is_test", true).select("id");
if (error) throw error;
console.log(`Borrados ${data?.length ?? 0} usuarios de prueba (y sus alertas y notificaciones).`);
