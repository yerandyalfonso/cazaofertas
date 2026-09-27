import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { CouponsPageContent } from "@/components/CouponsPageContent";
import { getActiveCoupons } from "@/lib/coupons-db";

export const metadata = {
  title: "Cupones y códigos de descuento",
  description:
    "Cupones activos por tienda: Amazon, Kiabi, Miravia, Carrefour y más.",
  alternates: { canonical: "/cupones" },
};

export default async function CuponesPage() {
  const coupons = await getActiveCoupons();

  return (
    <div className="marketplace-shell min-h-screen">
      <nav
        aria-label="Migas de pan"
        className="mx-auto flex max-w-4xl items-center gap-1.5 px-4 pt-5 text-xs text-muted"
      >
        <Link href="/" className="hover:text-ink">
          Inicio
        </Link>
        <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
        <span>Cupones</span>
      </nav>

      <main id="contenido" className="mx-auto max-w-4xl px-4 pb-10 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-[1.75rem]">
          Cupones y códigos de descuento
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {coupons.length > 0
            ? `${coupons.length} cupones activos. Revisa las condiciones de cada uno: algunos solo valen para ciertos productos o tienen fecha de fin.`
            : "Se revisan dos veces al día en las tiendas."}
        </p>
        <div className="mt-6">
          <CouponsPageContent coupons={coupons} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
