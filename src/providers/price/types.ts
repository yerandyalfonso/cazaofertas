import { ProductAvailability } from "@/types";

export interface ProductPriceData {
  asin: string;
  price: number;
  currency: string;
  availability: ProductAvailability;
  title?: string;
  brand?: string;
  imageUrl?: string;
  amazonUrl?: string;
  categorySlug?: string;
  previousPrice?: number;
  discountPercentage?: number;
}

export interface PriceProvider {
  getProduct(asin: string): Promise<ProductPriceData>;
  getProducts(asins: string[]): Promise<ProductPriceData[]>;
}
