/** Tiendas con job de ofertas configurable desde admin → Ajustes. */
export const RETAILER_DEAL_JOBS = ["carrefour", "mediamarkt", "pccomponentes"] as const;
export type RetailerDealJob = (typeof RETAILER_DEAL_JOBS)[number];
