/**
 * Enlaces de afiliado de Awin para tiendas sin enlace propio (MediaMarkt,
 * PcComponentes…). Se activan solo con variables de entorno, sin tocar los
 * productos guardados:
 *   AWIN_PUBLISHER_ID=123456             id de afiliado (awinaffid)
 *   AWIN_MID_MEDIAMARKT=12345            id del anunciante (awinmid) por tienda
 *   AWIN_MID_PCCOMPONENTES=…
 * Sin ellas, la URL se devuelve tal cual. Copia de `src/lib/awin.ts` (el
 * marketplace no importa de la app principal): cambiar las dos a la vez.
 */
export function awinDeeplink(retailer: string | null | undefined, url: string): string {
  const publisherId = process.env.AWIN_PUBLISHER_ID?.trim();
  const merchantId = retailer
    ? process.env[`AWIN_MID_${retailer.toUpperCase()}`]?.trim()
    : undefined;
  if (!publisherId || !merchantId || !/^https?:\/\//i.test(url)) return url;
  if (/awin1\.com\//i.test(url)) return url;
  const params = new URLSearchParams({
    awinmid: merchantId,
    awinaffid: publisherId,
    ued: url,
  });
  return `https://www.awin1.com/cread.php?${params.toString()}`;
}
