export interface MediaMarktProductQuote {
  externalId: string;
  productUrl: string;
  title: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  /** EAN del producto: sirve para cruzarlo con otras tiendas. */
  gtin?: string;
  price: number | null;
  listPrice: number | null;
  discountPercentage: number | null;
  availability: "IN_STOCK" | "OUT_OF_STOCK" | "UNKNOWN";
  /** Oferta de un vendedor externo (marketplace), no de MediaMarkt. */
  marketplaceSeller: string | null;
}

/** Producto leído de un listado de categoría (sin abrir la ficha). */
export interface MediaMarktListingItem {
  externalId: string;
  productUrl: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  gtin: string | null;
  price: number;
  listPrice: number | null;
  discountPercentage: number;
  /** Ruta de categorías de MediaMarkt (Informática › Portátiles…). */
  categoryNames: string[];
  /** Vendido por un tercero (marketplace), no por MediaMarkt. */
  marketplace: boolean;
  sourceUrl: string;
}
