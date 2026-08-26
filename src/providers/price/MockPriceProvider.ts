import { generateAmazonUrl } from "@/lib/affiliate";
import { calculateDiscountPercentage, roundMoney } from "@/lib/money";
import { ProductAvailability } from "@/types";
import type { PriceProvider, ProductPriceData } from "@/providers/price/types";

export type { PriceProvider, ProductPriceData } from "@/providers/price/types";

export type MockPriceMode = "random" | "drop" | "stable";

export interface MockCatalogItem {
  asin: string;
  price: number;
  previousPrice?: number;
  title?: string;
  brand?: string;
  imageUrl?: string;
  categorySlug?: string;
  /** URL completa de Amazon (si existe, el seed la guarda tal cual). */
  amazonUrl?: string;
}

export interface MockPriceProviderOptions {
  catalog?: Iterable<MockCatalogItem>;
  mode?: MockPriceMode;
  now?: Date;
}

/** Catálogo por defecto estable para desarrollo sin APIs externas. */
export const DEFAULT_MOCK_CATALOG: MockCatalogItem[] = [
  {
    asin: "B0CAZA0006",
    title: "Auriculares inalámbricos con cancelación activa de ruido",
    brand: "SoundPeak",
    categorySlug: "tecnologia",
    price: 79.99,
    previousPrice: 129.99,
    imageUrl:
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0018",
    title: 'Monitor 27" QHD 165 Hz IPS',
    brand: "ViewPulse",
    categorySlug: "informatica",
    price: 219.0,
    previousPrice: 299.0,
    imageUrl:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0012",
    title: "Zapatillas running ligera para asfalto",
    brand: "Nike",
    categorySlug: "moda",
    price: 74.95,
    previousPrice: 109.95,
    imageUrl:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0002",
    title: "Freidora de aire 5,5 L con pantalla táctil",
    brand: "CocinaPlus",
    categorySlug: "hogar",
    price: 64.9,
    previousPrice: 89.9,
    imageUrl:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0016",
    title: "SSD NVMe 1 TB PCIe 4.0",
    brand: "VoltDrive",
    categorySlug: "informatica",
    price: 69.99,
    previousPrice: 99.99,
    imageUrl:
      "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0004",
    title: "Secador iónico profesional 2000 W",
    brand: "GlowLab",
    categorySlug: "belleza",
    price: 39.95,
    previousPrice: 54.95,
    imageUrl:
      "https://images.unsplash.com/photo-1522338140262-f46f5913618a?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0009",
    title: "Esterilla de yoga antideslizante 6 mm",
    brand: "MoveLab",
    categorySlug: "deportes",
    price: 18.9,
    previousPrice: 27.9,
    imageUrl:
      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0010",
    title: "Reloj deportivo GPS con pulsómetro óptico",
    brand: "PaceForge",
    categorySlug: "deportes",
    price: 89.0,
    previousPrice: 129.0,
    imageUrl:
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0007",
    title: "Altavoz inteligente compacto con asistente de voz",
    brand: "EchoLite",
    categorySlug: "tecnologia",
    price: 29.99,
    previousPrice: 44.99,
    imageUrl:
      "https://images.unsplash.com/photo-1543512214-318c7553f230?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0CAZA0014",
    title: "Set de construcción ciudad 1.200 piezas",
    brand: "BrickForge",
    categorySlug: "juguetes",
    price: 49.99,
    previousPrice: 69.99,
    imageUrl:
      "https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0HBXKQCX7",
    title:
      "Webcam 1080p con micrófono, cancelación de ruido, privacidad y corrección de luz",
    brand: "Shcngqio",
    categorySlug: "tecnologia",
    price: 29.99,
    previousPrice: 49.99,
    amazonUrl:
      "https://www.amazon.es/Shcngqio-Micr%C3%B3fono-Cancelaci%C3%B3n-Privacidad-Correcci%C3%B3n/dp/B0HBXKQCX7/",
    imageUrl:
      "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0GY8H7WHX",
    title:
      "Mochila urbana ultraligera impermeable para excursiones y senderismo",
    brand: "MLPKOI",
    categorySlug: "deportes",
    price: 24.99,
    previousPrice: 39.99,
    amazonUrl:
      "https://www.amazon.es/MLPKOI-Ultraligera-Impermeable-Excursiones-Senderismo/dp/B0GY8H7WHX/",
    imageUrl:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
  },
  {
    asin: "B0DCZF5X4P",
    title: "AOC Gaming Q27G4XF Monitor QHD ajustable con DisplayPort",
    brand: "AOC",
    categorySlug: "informatica",
    price: 189.0,
    previousPrice: 249.0,
    amazonUrl:
      "https://www.amazon.es/AOC-Gaming-Q27G4XF-Ajustable-DisplayPort/dp/B0DCZF5X4P/",
    imageUrl:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=80",
  },
];

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededUnit(seed: string): number {
  return hashString(seed) / 4294967295;
}

function fallbackCatalogItem(asin: string): MockCatalogItem {
  const base = roundMoney(19.99 + (hashString(asin) % 28000) / 100);
  const previousPrice = roundMoney(base * (1.15 + seededUnit(`${asin}:prev`) * 0.25));

  return {
    asin,
    price: base,
    previousPrice,
    title: `Producto demo ${asin.slice(-4)}`,
    brand: "DemoBrand",
    categorySlug: "tecnologia",
  };
}

export class MockPriceProvider implements PriceProvider {
  private readonly catalog: Map<string, MockCatalogItem>;
  private readonly mode: MockPriceMode;
  private readonly now: Date;

  constructor(options: MockPriceProviderOptions = {}) {
    const items = [...(options.catalog ?? DEFAULT_MOCK_CATALOG)];
    this.catalog = new Map(items.map((item) => [item.asin, item]));
    this.mode = options.mode ?? "stable";
    this.now = options.now ?? new Date();
  }

  async getProduct(asin: string): Promise<ProductPriceData> {
    const item = this.catalog.get(asin) ?? fallbackCatalogItem(asin);
    const previousPrice = item.previousPrice ?? roundMoney(item.price * 1.2);
    const price = this.varyPrice(asin, item.price);
    const discountPercentage =
      previousPrice > price
        ? calculateDiscountPercentage(previousPrice, price)
        : 0;

    return {
      asin,
      price,
      previousPrice,
      discountPercentage,
      currency: "EUR",
      availability: ProductAvailability.IN_STOCK,
      title: item.title,
      brand: item.brand,
      imageUrl: item.imageUrl,
      categorySlug: item.categorySlug,
      amazonUrl: item.amazonUrl ?? generateAmazonUrl(asin),
    };
  }

  async getProducts(asins: string[]): Promise<ProductPriceData[]> {
    return Promise.all(asins.map((asin) => this.getProduct(asin)));
  }

  private varyPrice(asin: string, currentPrice: number): number {
    if (this.mode === "stable") {
      return roundMoney(currentPrice);
    }

    if (this.mode === "drop") {
      const dropFactor = 0.68 + seededUnit(`${asin}:drop`) * 0.1;
      return roundMoney(Math.max(1, currentPrice * dropFactor));
    }

    const dayKey = this.now.toISOString().slice(0, 10);
    const roll = seededUnit(`${asin}:${dayKey}:roll`);

    if (roll < 0.3) {
      const drop = 0.62 + seededUnit(`${asin}:${dayKey}:drop`) * 0.18;
      return roundMoney(Math.max(1, currentPrice * drop));
    }

    if (roll < 0.45) {
      const rise = 1.03 + seededUnit(`${asin}:${dayKey}:rise`) * 0.08;
      return roundMoney(currentPrice * rise);
    }

    const jitter = 0.96 + seededUnit(`${asin}:${dayKey}:jitter`) * 0.08;
    return roundMoney(Math.max(1, currentPrice * jitter));
  }
}
