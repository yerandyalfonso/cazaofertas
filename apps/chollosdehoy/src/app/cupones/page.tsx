import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CouponsPageContent } from "@/components/CouponsPageContent";
import { getActiveCoupons } from "@/lib/coupons-db";

export const metadata = {
  title: "Cupones y códigos de descuento",
  description:
    "Cupones activos por tienda: Amazon, Kiabi, Miravia, Carrefour y más.",
};

export default async function CuponesPage() {
  const coupons = await getActiveCoupons();

  return (
    <div className="marketplace-shell min-h-screen">
      <header className="border-b border-[var(--border)] bg-gradient-to-br from-[var(--primary-soft)] to-[var(--surface)]">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Link href="/" className="btn btn-ghost mb-4 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Volver al marketplace
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text)] md:text-3xl">
            Cupones por tienda
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
            Códigos y promociones detectados automáticamente en las tiendas.
            Solo se listan los activos según su vigencia.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <CouponsPageContent coupons={coupons} />
      </main>
    </div>
  );
}
