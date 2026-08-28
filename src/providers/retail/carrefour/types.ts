export interface CarrefourDiscoveredItem {
  externalId: string;
  productUrl: string;
  titleHint?: string;
  priceHint?: number;
  listPriceHint?: number;
  imageUrlHint?: string;
  sourceUrl: string;
  breadcrumbs?: string[];
}

export interface CarrefourProductQuote {
  externalId: string;
  productUrl: string;
  title: string;
  brand?: string;
  description?: string;
  ean?: string;
  imageUrl?: string;
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  breadcrumbs?: string[];
}
