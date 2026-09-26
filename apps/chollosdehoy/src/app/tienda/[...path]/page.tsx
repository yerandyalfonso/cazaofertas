import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { ListingPage, listingMetadata } from "@/components/ListingPage";
import { resolveRetailerListing } from "@/lib/listing";

// Sin searchParams (paginación en la ruta) para poder cachear la página.
export const revalidate = 300;

// Sin rutas en el build: cada una se genera en su primera visita y se cachea.
export function generateStaticParams() {
  return [];
}

const getListing = cache(resolveRetailerListing);

interface PageProps {
  params: Promise<{ path: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { path } = await params;
  const listing = await getListing(path);
  if (!listing) return { title: "Página no encontrada", robots: { index: false } };
  return listingMetadata(listing);
}

export default async function Page({ params }: PageProps) {
  const { path } = await params;
  const listing = await getListing(path);
  if (!listing) notFound();
  return <ListingPage listing={listing} />;
}
