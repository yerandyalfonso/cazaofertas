const EXPIRY_FORMAT = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  day: "numeric",
  month: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * «⚡ Oferta flash · vence el 27/9 a las 14:00» si la oferta tiene fecha de fin
 * (Amazon la publica en las ofertas flash) y aún no ha pasado; si no, null.
 */
export function flashDealLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  const parts = Object.fromEntries(
    EXPIRY_FORMAT.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `⚡ Oferta flash · vence el ${parts.day}/${parts.month} a las ${parts.hour}:${parts.minute}`;
}
