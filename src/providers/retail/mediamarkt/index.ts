export {
  DEFAULT_MEDIAMARKT_FEED_URLS,
  discoverMediaMarktDeals,
  parseMediaMarktListingHtml,
} from "@/providers/retail/mediamarkt/mediamarktDiscovery";
export {
  fetchMediaMarktHtml,
  scrapeMediaMarktProductPage,
} from "@/providers/retail/mediamarkt/mediamarktProductPage";
export type {
  MediaMarktListingItem,
  MediaMarktProductQuote,
} from "@/providers/retail/mediamarkt/types";
