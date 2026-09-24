const RTF = new Intl.RelativeTimeFormat("es", { numeric: "auto" });

/** «hace 5 min», «hace 3 h», «ayer», «hace 4 días»; fecha corta si es antiguo. */
export function formatRelativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const diffSec = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return "ahora";
  if (abs < 3600) return RTF.format(Math.round(diffSec / 60), "minute");
  if (abs < 86_400) return RTF.format(Math.round(diffSec / 3600), "hour");
  if (abs < 7 * 86_400) return RTF.format(Math.round(diffSec / 86_400), "day");
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/** Fecha y hora completas para el atributo title (tooltip). */
export function formatFullDateTime(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString("es-ES") : "";
}
