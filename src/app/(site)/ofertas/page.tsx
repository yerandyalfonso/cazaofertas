import type { Metadata } from "next";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { JsonLd } from "@/components/JsonLd";
import { OffersCatalog } from "@/components/OffersCatalog";
import {
  getActiveProducts,
  getCategories,
  getTopDealProducts,
  TELEGRAM_BOT_URL,
} from "@/lib/catalog";
import { buildPageMetadata, itemListJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPageMetadata({
    title: "Ofertas Amazon España",
    description:
      "Chollos de Amazon España ordenados por deal score, descuento y mínimo histórico.",
    path: "/ofertas",
  }),
};

export const revalidate = 300;

export default async function OffersPage() {
  const [topDeals, products, categories] = await Promise.all([
    getTopDealProducts(24),
    getActiveProducts(48),
    getCategories(),
  ]);

  const byId = new Map<string, (typeof products)[number]>();
  for (const product of [...topDeals, ...products]) {
    byId.set(product.id, product);
  }
  const list = [...byId.values()].sort((a, b) => b.dealScore - a.dealScore);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
      <JsonLd
        data={itemListJsonLd({
          name: "Ofertas Amazon España",
          path: "/ofertas",
          items: list.slice(0, 40).map((product) => ({
            name: product.title,
            path: `/producto/${product.slug}`,
          })),
        })}
      />
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800">
          Ofertas
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
          Chollos con mejor puntuación
        </h1>
        <p className="mt-4 text-base leading-relaxed text-stone-600">
          Ordenados por deal score: descuento, cercanía al mínimo histórico y
          estabilidad de precio.
        </p>
        <AffiliateDisclosure className="mt-4" />
      </header>

      {list.length > 0 ? (
        <OffersCatalog
          products={list}
          categories={categories.map((c) => ({
            slug: c.slug,
            name: c.name,
          }))}
        />
      ) : (
        <div className="mt-12 border border-dashed border-stone-300 bg-white/70 px-5 py-8">
          <p className="text-sm text-stone-600">
            Estamos cazando ofertas ahora mismo. Vuelve en un rato o activa
            alertas en Telegram para no perdértelas.
          </p>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-10 items-center bg-ink px-4 text-xs font-semibold uppercase tracking-[0.12em] text-paper"
          >
            Abrir Telegram
          </a>
        </div>
      )}
    </div>
  );
}
