import { getMarketplaceBootstrap } from "@/lib/catalog";
import { MarketplaceApp } from "@/components/MarketplaceApp";

export const dynamic = "force-dynamic";
export const revalidate = 120;

export default async function HomePage() {
  const bootstrap = await getMarketplaceBootstrap();

  return <MarketplaceApp bootstrap={bootstrap} />;
}
