import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, OwnerDetails } from "@/components/LegalPage";
import { LEGAL_OWNER } from "@/lib/legal";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteUrl } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: "Aviso legal",
  description:
    "Titular, condiciones de uso y enlaces de afiliado de Una mica de tot.",
  path: "/aviso-legal",
});

export default function AvisoLegalPage() {
  const domain = getSiteUrl().replace(/^https?:\/\//, "");
  const hasOwner = Object.values(LEGAL_OWNER).some(Boolean);

  return (
    <LegalPage
      eyebrow="Legal"
      title="Aviso legal"
      intro={
        <p>
          En resumen: esto es un blog personal de recomendaciones. Algunos
          enlaces son de afiliado y nos pagan una pequeña comisión si compras,
          sin que a ti te cueste más. Los precios los pone cada tienda y pueden
          cambiar: compruébalos siempre antes de pagar.
        </p>
      }
    >
      <LegalSection title="1. Quién está detrás">
        <p>
          En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la
          Sociedad de la Información y de Comercio Electrónico (LSSI-CE),{" "}
          {hasOwner ? "son" : "se publicarán aquí"} los datos del titular del
          sitio web <strong>{domain}</strong> («Una mica de tot» o «el
          Sitio»){hasOwner ? ":" : "."}
        </p>
        <OwnerDetails owner={LEGAL_OWNER} />
      </LegalSection>

      <LegalSection title="2. Qué es este sitio">
        <p>
          Una mica de tot es un blog de experiencias, guías y comparativas
          sobre productos de uso diario. Además, vigila precios en tiendas
          online y avisa de bajadas a través de Telegram. No vendemos nada
          directamente: cuando decides comprar, lo haces en la tienda
          correspondiente y con sus condiciones.
        </p>
      </LegalSection>

      <LegalSection title="3. Condiciones de uso">
        <p>
          Al navegar por el Sitio aceptas usarlo de forma lícita y no dañar su
          funcionamiento: nada de extraer contenidos de forma masiva, intentar
          acceder a zonas restringidas o usarlo para fines que perjudiquen a
          terceros.
        </p>
      </LegalSection>

      <LegalSection title="4. Enlaces de afiliado">
        <p>
          Una mica de tot participa en el Programa de Afiliados de Amazon EU,
          un programa de publicidad para afiliados diseñado para ofrecer a
          sitios web un modo de obtener comisiones por publicidad,
          publicitando e incluyendo enlaces a Amazon.es.{" "}
          <strong>
            Como Afiliado de Amazon, obtenemos ingresos por las compras
            adscritas que cumplen los requisitos aplicables.
          </strong>
        </p>
        <p>
          También podemos enlazar a otras tiendas (como AliExpress, Miravia,
          PcComponentes, Carrefour o Kiabi) a través de sus propios programas
          de afiliación. En todos los casos:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Si compras desde uno de estos enlaces, la tienda nos puede pagar
            una comisión. <strong>El precio para ti es el mismo.</strong>
          </li>
          <li>
            Las comisiones no deciden lo que recomendamos: contamos también las
            pegas de cada producto y avisamos cuando una rebaja no lo es.
          </li>
          <li>
            Los artículos no son publicidad pagada por las marcas. Si alguna vez
            publicamos un contenido patrocinado, lo diremos claramente al
            principio.
          </li>
        </ul>
        <p>
          Amazon y el logotipo de Amazon son marcas registradas de Amazon.com,
          Inc. o de sus afiliadas.
        </p>
      </LegalSection>

      <LegalSection title="5. Precios y disponibilidad">
        <p>
          Los precios, descuentos, cupones y gastos de envío que mostramos son
          los que tenía la tienda en el momento de consultarlos, y pueden
          cambiar en cualquier momento sin que nos dé tiempo a actualizarlos.
          El precio válido es siempre el que aparece en la tienda al pagar. Los
          históricos de precio se basan en nuestras propias consultas y son
          orientativos.
        </p>
      </LegalSection>

      <LegalSection title="6. Responsabilidad">
        <p>
          Nuestras recomendaciones son opiniones basadas en información pública,
          en pruebas propias y en opiniones de otros compradores; no sustituyen
          el consejo de un profesional. La compra, el envío, la garantía y las
          devoluciones son responsabilidad de la tienda donde compres.
        </p>
        <p>
          Hacemos lo posible por que el contenido sea correcto y esté al día,
          pero no podemos garantizar que no contenga errores ni que el Sitio
          esté disponible sin interrupciones.
        </p>
      </LegalSection>

      <LegalSection title="7. Enlaces a otras webs">
        <p>
          El Sitio enlaza a tiendas y a otras páginas que no controlamos. No
          somos responsables de su contenido, de sus condiciones ni de cómo
          tratan tus datos: consulta sus propios avisos legales y políticas de
          privacidad.
        </p>
      </LegalSection>

      <LegalSection title="8. Propiedad intelectual">
        <p>
          Los textos, el diseño y las fotografías propias del Sitio pertenecen a
          su titular. Puedes citar fragmentos breves enlazando al artículo
          original; para cualquier otro uso, pide permiso antes. Los nombres,
          marcas, imágenes y descripciones de producto pertenecen a sus
          respectivos propietarios y se muestran solo para identificarlos.
        </p>
        <p>
          Si crees que algún contenido vulnera tus derechos, escríbenos y lo
          revisaremos lo antes posible.
        </p>
      </LegalSection>

      <LegalSection title="9. Datos personales y cookies">
        <p>
          Cómo tratamos tus datos, y por qué no usamos cookies de publicidad ni
          de seguimiento, está explicado en la{" "}
          <Link href="/privacidad" className="text-ink underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="10. Ley aplicable">
        <p>
          Este aviso legal se rige por la legislación española. Si eres
          consumidor, podrás acudir a los juzgados de tu domicilio.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
