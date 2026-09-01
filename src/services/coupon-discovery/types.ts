export interface DiscoveredCoupon {
  retailer: string;
  title: string;
  code: string;
  description: string;
  url: string;
  expiresAt?: string;
  startsAt?: string;
  source: "scrape" | "affiliate";
  externalId?: string;
  highlight?: boolean;
  terms?: string;
}

export interface CouponDiscoveryResult {
  found: number;
  examplesDeleted: number;
  expiredDeactivated: number;
  staleDeactivated: number;
  inserted: number;
  updated: number;
  byRetailer: Record<string, number>;
}
