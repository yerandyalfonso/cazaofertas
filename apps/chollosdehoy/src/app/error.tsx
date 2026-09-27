"use client"; // Los límites de error tienen que ser componentes de cliente.

import { SiteHeader } from "@/components/SiteHeader";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="marketplace-shell">
      <SiteHeader width="max-w-3xl" />
      <main id="contenido" className="mx-auto max-w-3xl px-4 py-16 md:py-24">
        <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          No hemos podido cargar esta página
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Suele ser algo momentáneo. Vuelve a intentarlo en unos segundos; si
          sigue fallando, prueba desde la portada.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className="btn btn-primary">
            Reintentar
          </button>
          <Link href="/" className="btn btn-ghost">
            Ir a la portada
          </Link>
        </div>
      </main>
    </div>
  );
}
