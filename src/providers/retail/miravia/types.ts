export interface MiraviaDiscoveredItem {
  externalId: string;
  skuId?: string | null;
  productUrl: string;
  titleHint?: string;
  priceHint?: number;
  listPriceHint?: number;
  discountHint?: number | null;
  imageUrlHint?: string | null;
  sourceUrl: string;
}

export interface MiraviaProductQuote {
  externalId: string;
  productUrl: string;
  title: string;
  brand?: string;
  imageUrl?: string | null;
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
}
