import { generateAmazonUrl } from "@/lib/affiliate";
import { signPaApiRequest } from "@/providers/price/aws-sigv4";
import type { PriceProvider, ProductPriceData } from "@/providers/price/types";
import { ProductAvailability } from "@/types";

/**
 * Amazon Product Advertising API / Creators API (PA-API 5) con firma SigV4.
 * Requiere AMAZON_API_ACCESS_KEY, AMAZON_API_SECRET y partner tag.
 * Opcionalmente usa fallback HTML si la API falla y strict=false.
 */

export interface AmazonCreatorsApiProviderOptions {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  host?: string;
  region?: string;
  marketplace?: string;
  fetchImpl?: typeof fetch;
  fallback?: PriceProvider;
  strict?: boolean;
}

const HOST_BY_MARKETPLACE: Record<string, { host: string; region: string }> = {
  ES: { host: "webservices.amazon.es", region: "eu-west-1" },
  DE: { host: "webservices.amazon.de", region: "eu-west-1" },
  FR: { host: "webservices.amazon.fr", region: "eu-west-1" },
  IT: { host: "webservices.amazon.it", region: "eu-west-1" },
  UK: { host: "webservices.amazon.co.uk", region: "eu-west-1" },
  US: { host: "webservices.amazon.com", region: "us-east-1" },
};

const MARKETPLACE_HOST: Record<string, string> = {
  ES: "www.amazon.es",
  DE: "www.amazon.de",
  FR: "www.amazon.fr",
  IT: "www.amazon.it",
  UK: "www.amazon.co.uk",
  US: "www.amazon.com",
};

export class AmazonCreatorsApiProvider implements PriceProvider {
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly partnerTag: string;
  private readonly host: string;
  private readonly region: string;
  private readonly marketplace: string;
  private readonly fetchImpl: typeof fetch;
  private readonly fallback?: PriceProvider;
  private readonly strict: boolean;

  constructor(options: AmazonCreatorsApiProviderOptions) {
    if (!options.accessKey.trim() || !options.secretKey.trim()) {
      throw new Error(
        "AmazonCreatorsApiProvider requiere AMAZON_API_ACCESS_KEY y AMAZON_API_SECRET.",
      );
    }
    if (!options.partnerTag.trim()) {
      throw new Error(
        "AmazonCreatorsApiProvider requiere partner tag (AMAZON_ASSOCIATE_TAG).",
      );
    }

    this.accessKey = options.accessKey.trim();
    this.secretKey = options.secretKey.trim();
    this.partnerTag = options.partnerTag.trim();
    this.marketplace = (options.marketplace ?? "ES").toUpperCase();
    const defaults =
      HOST_BY_MARKETPLACE[this.marketplace] ?? HOST_BY_MARKETPLACE.ES!;
    this.host = options.host ?? defaults.host;
    this.region = options.region ?? defaults.region;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.fallback = options.fallback;
    this.strict = options.strict ?? false;
  }

  static isFullyImplemented(): boolean {
    return true;
  }

  async getProduct(asin: string): Promise<ProductPriceData> {
    const [product] = await this.getProducts([asin]);
    if (!product) {
      throw new Error(`Creators API no devolvió datos para ${asin}.`);
    }
    return product;
  }

  async getProducts(asins: string[]): Promise<ProductPriceData[]> {
    try {
      return await this.fetchViaPaApi(asins);
    } catch (error) {
      if (this.fallback && !this.strict) {
        console.warn(
          "[AmazonCreatorsApiProvider] PA-API falló; usando fallback.",
          error instanceof Error ? error.message : error,
        );
        return this.fallback.getProducts(asins);
      }
      throw error;
    }
  }

  private async fetchViaPaApi(asins: string[]): Promise<ProductPriceData[]> {
    const unique = [
      ...new Set(asins.map((a) => a.trim().toUpperCase()).filter(Boolean)),
    ];
    const results: ProductPriceData[] = [];
    const marketplaceHost =
      MARKETPLACE_HOST[this.marketplace] ?? "www.amazon.es";

    for (let i = 0; i < unique.length; i += 10) {
      const batch = unique.slice(i, i + 10);
      const path = "/paapi5/getitems";
      const body = JSON.stringify({
        ItemIds: batch,
        PartnerTag: this.partnerTag,
        PartnerType: "Associates",
        Marketplace: marketplaceHost,
        Resources: [
          "ItemInfo.Title",
          "ItemInfo.ByLineInfo",
          "Offers.Listings.Price",
          "Offers.Listings.Availability.Message",
          "Images.Primary.Large",
        ],
      });

      const headers = await signPaApiRequest({
        method: "POST",
        host: this.host,
        path,
        region: this.region,
        service: "ProductAdvertisingAPI",
        accessKey: this.accessKey,
        secretKey: this.secretKey,
        body,
        amzTarget:
          "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems",
      });

      const response = await this.fetchImpl(`https://${this.host}${path}`, {
        method: "POST",
        headers,
        body,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          `PA-API HTTP ${response.status}: ${text.slice(0, 240)}`,
        );
      }

      const payload = (await response.json()) as {
        ItemsResult?: {
          Items?: Array<{
            ASIN?: string;
            DetailPageURL?: string;
            ItemInfo?: {
              Title?: { DisplayValue?: string };
              ByLineInfo?: { Brand?: { DisplayValue?: string } };
            };
            Offers?: {
              Listings?: Array<{
                Price?: { Amount?: number; Currency?: string };
                Availability?: { Message?: string };
              }>;
            };
            Images?: { Primary?: { Large?: { URL?: string } } };
          }>;
        };
        Errors?: Array<{ Code?: string; Message?: string }>;
      };

      if (payload.Errors?.length && !payload.ItemsResult?.Items?.length) {
        throw new Error(
          payload.Errors.map((e) => e.Message ?? e.Code).join("; "),
        );
      }

      for (const item of payload.ItemsResult?.Items ?? []) {
        const asin = item.ASIN?.toUpperCase();
        const amount = item.Offers?.Listings?.[0]?.Price?.Amount;
        if (!asin || amount === undefined || !Number.isFinite(amount)) continue;

        const availabilityMsg =
          item.Offers?.Listings?.[0]?.Availability?.Message?.toLowerCase() ??
          "";
        let availability = ProductAvailability.IN_STOCK;
        if (
          availabilityMsg.includes("unavailable") ||
          availabilityMsg.includes("out of stock") ||
          availabilityMsg.includes("agotado")
        ) {
          availability = ProductAvailability.OUT_OF_STOCK;
        } else if (availabilityMsg.includes("pre-order") || availabilityMsg.includes("preventa")) {
          availability = ProductAvailability.PREORDER;
        }

        results.push({
          asin,
          price: Math.round(amount * 100) / 100,
          currency: item.Offers?.Listings?.[0]?.Price?.Currency ?? "EUR",
          availability,
          title: item.ItemInfo?.Title?.DisplayValue,
          brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
          imageUrl: item.Images?.Primary?.Large?.URL,
          amazonUrl: item.DetailPageURL ?? generateAmazonUrl(asin),
        });
      }
    }

    return results;
  }
}
