/**
 * URLs de feeds por defecto (sin dependencias de Node/scraping).
 * Se muestran en el admin y se usan cuando BD/env no tienen lista propia.
 */

export function buildAmazonDealsDepartmentUrl(departmentId: string): string {
  const payload = {
    state: {
      refinementFilters: {
        departments: [String(departmentId)],
      },
    },
    version: 1,
  };
  const widget = encodeURIComponent(
    encodeURIComponent(JSON.stringify(JSON.stringify(payload))),
  );
  return `https://www.amazon.es/events/deals/?discounts-widget=${widget}`;
}

const AMAZON_DEPARTMENT_IDS = [
  "6198055031",
  "3677431031",
  "2846221031",
  "1571263031",
  "1703496031",
  "1951052031",
  "2665403031",
  "599392031",
  "667050031",
  "1571260031",
  "599386031",
  "599383031",
] as const;

const AMAZON_CATEGORY_SEARCH_FEEDS = [
  "https://www.amazon.es/s?i=pets&bbn=12472654031&rh=p_n_deal_type%3A23566065031",
  "https://www.amazon.es/s?k=pienso+perro&rh=p_n_deal_type%3A23566065031",
  "https://www.amazon.es/s?k=arena+gatos&rh=p_n_deal_type%3A23566065031",
  "https://www.amazon.es/s?k=collar+perro&rh=p_n_deal_type%3A23566065031",
] as const;

export const DEFAULT_AMAZON_FLASH_FEED_URLS: readonly string[] = [
  "https://www.amazon.es/gp/goldbox",
  "https://www.amazon.es/deals",
  ...AMAZON_DEPARTMENT_IDS.map((id) => buildAmazonDealsDepartmentUrl(id)),
  ...AMAZON_CATEGORY_SEARCH_FEEDS,
];

// La home carga los productos por JS (0 items en el HTML): solo flashsale.
export const DEFAULT_MIRAVIA_FEED_URLS: readonly string[] = [
  "https://www.miravia.es/flashsale/home",
];

export const DEFAULT_KIABI_FEED_URLS: readonly string[] = [
  "https://www.kiabi.es/promociones_464410",
];

export function effectiveFeedUrls(
  configured: string[],
  fallback: readonly string[],
): string[] {
  return configured.length > 0 ? configured : [...fallback];
}
