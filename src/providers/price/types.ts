import { ProductAvailability } from "@/types";

export interface ProductPriceData {
  asin: string;
  /** Null cuando la ficha existe pero no hay precio (p. ej. agotado). */
  price: number | null;
  currency: string;
  availability: ProductAvailability;
  title?: string;
  brand?: string;
  imageUrl?: string;
  amazonUrl?: string;
  categorySlug?: string;
  previousPrice?: number;
  discountPercentage?: number;
  /** Caducidad de Lightning/flash si Amazon la publica. */
  dealExpiresAt?: string | null;
}

export interface PriceProvider {
  getProduct(asin: string): Promise<ProductPriceData>;
  getProducts(asins: string[]): Promise<ProductPriceData[]>;
}
