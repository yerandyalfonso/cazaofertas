import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

interface OfferPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Las fichas de oferta viven en /producto/[slug].
 * /ofertas/[slug] redirige de forma permanente para unificar URLs.
 */
export async function generateMetadata({
  params,
}: OfferPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    alternates: { canonical: `/producto/${slug}` },
  };
}

export default async function OfferDetailRedirectPage({
  params,
}: OfferPageProps) {
  const { slug } = await params;
  permanentRedirect(`/producto/${slug}`);
}
