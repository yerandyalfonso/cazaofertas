export {
  DEFAULT_CARREFOUR_DEAL_FEED_URLS,
  discoverCarrefourDeals,
  parseCarrefourListingHtml,
} from "@/providers/retail/carrefour/carrefourDiscovery";
export {
  buildCarrefourFallbackQuote,
  hasRealCarrefourDiscount,
  scrapeCarrefourProductPage,
} from "@/providers/retail/carrefour/carrefourProductPage";
export {
  extractCarrefourSku,
  fetchCarrefourHtml,
  isCarrefourProductUrl,
  normalizeCarrefourProductUrl,
} from "@/providers/retail/carrefour/carrefourHttp";
export type {
  CarrefourDiscoveredItem,
  CarrefourProductQuote,
} from "@/providers/retail/carrefour/types";
