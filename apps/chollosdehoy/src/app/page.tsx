import { getMarketplaceBootstrap } from "@/lib/catalog";
import { MarketplaceApp } from "@/components/MarketplaceApp";
import { SiteFooter } from "@/components/SiteFooter";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const revalidate = 120;

export const metadata = {
  alternates: { canonical: "/" },
};

const homeJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
  },
];

export default async function HomePage() {
  const bootstrap = await getMarketplaceBootstrap();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <MarketplaceApp bootstrap={bootstrap} footer={<SiteFooter />} />
    </>
  );
}
