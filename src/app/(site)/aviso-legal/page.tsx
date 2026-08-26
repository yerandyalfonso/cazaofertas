import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Aviso legal",
  description: "Aviso legal e información de afiliación de CazaOferta.",
  path: "/aviso-legal",
});

export default function AvisoLegalPage() {
  return (
    <LegalPage eyebrow="Legal" title="Aviso legal">
      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Titular del sitio
        </h2>
        <p>
          El sitio web <strong>CazaOferta</strong> (en adelante, «el Sitio»)
          publica información editorial sobre ofertas de Amazon España y
          herramientas de alerta de precios. Los datos de contacto y
          titularidad se actualizarán conforme a la operativa del proyecto.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Objeto
        </h2>
        <p>
          El Sitio tiene carácter informativo y de utilidad: muestra productos,
          precios orientativos y contenidos del blog. Los precios y la
          disponibilidad los fija el vendedor (habitualmente Amazon) y pueden
          cambiar en cualquier momento.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Programa de Afiliados de Amazon
        </h2>
        <p>
          CazaOferta participa en el Programa de Afiliados de Amazon EU. Como
          Afiliado de Amazon, obtenemos ingresos por las compras adscritas que
          cumplen los requisitos aplicables. Algunos enlaces de productos son
          enlaces de afiliado: si compras a través de ellos, podemos recibir
          una comisión <strong>sin coste adicional</strong> para ti.
        </p>
        <p>
          Amazon y el logotipo de Amazon son marcas comerciales de Amazon.com,
          Inc. o de sus afiliadas.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Responsabilidad
        </h2>
        <p>
          No garantizamos la exactitud permanente de precios, stock ni
          condiciones de envío. Antes de comprar, verifica siempre la ficha
          oficial en Amazon. El Sitio no es responsable de transacciones
          celebradas entre el usuario y terceros.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">
          Propiedad intelectual
        </h2>
        <p>
          Los textos editoriales propios del Sitio están propiedad de CazaOferta,
          salvo indicación contraria. Las marcas, imágenes y descripciones de
          producto pertenecen a sus respectivos titulares.
        </p>
      </section>
    </LegalPage>
  );
}
