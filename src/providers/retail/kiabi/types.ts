export interface KiabiDiscoveredItem {
  externalId: string;
  productUrl: string;
  titleHint?: string;
  priceHint?: number;
  listPriceHint?: number;
  imageUrlHint?: string;
  sourceUrl: string;
}

export interface KiabiProductQuote {
  externalId: string;
  productUrl: string;
  title: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
}
