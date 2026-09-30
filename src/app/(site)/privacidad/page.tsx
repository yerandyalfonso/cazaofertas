import type { Metadata } from "next";
import { LegalPage, LegalSection, OwnerDetails } from "@/components/LegalPage";
import { LEGAL_OWNER } from "@/lib/legal";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Política de privacidad y cookies",
  description:
    "Qué datos trata Una mica de tot, para qué, cuánto tiempo y cómo ejercer tus derechos. Sin cookies de publicidad.",
  path: "/privacidad",
});

const PURPOSES = [
  {
    what: "Visitas al blog",
    data: "Página visitada, web de procedencia, navegador, sistema operativo, país aproximado y tamaño de pantalla. Sin cookies y sin guardar tu dirección IP.",
    why: "Saber qué artículos se leen para mejorar el blog.",
    basis: "Interés legítimo (art. 6.1.f RGPD).",
    keep: "Estadísticas agregadas; no permiten identificarte.",
  },
  {
    what: "Clics en enlaces a tiendas",
    data: "Producto y artículo desde el que haces clic, fecha y tipo de navegador (user-agent). Sin IP ni identificadores.",
    why: "Saber qué recomendaciones resultan útiles y cuadrar las comisiones.",
    basis: "Interés legítimo (art. 6.1.f RGPD).",
    keep: "Mientras sean útiles para las estadísticas del blog; no te identifican.",
  },
  {
    what: "Alertas de precio en Telegram",
    data: "Tu identificador de Telegram, nombre de usuario (si lo tienes) y los productos, precios o categorías que quieres vigilar.",
    why: "Enviarte los avisos que pides.",
    basis: "Ejecución del servicio que solicitas (art. 6.1.b RGPD).",
    keep: "Mientras tengas alertas activas. Si bloqueas el bot o las borras, dejamos de avisarte y eliminamos los datos en un plazo razonable.",
  },
  {
    what: "Si nos escribes",
    data: "Tu email o usuario y lo que nos cuentes.",
    why: "Responderte.",
    basis: "Tu consentimiento al escribirnos (art. 6.1.a RGPD).",
    keep: "El tiempo necesario para atender la consulta.",
  },
] as const;

export default function PrivacidadPage() {
  const hasOwner = Object.values(LEGAL_OWNER).some(Boolean);

  return (
    <LegalPage
      eyebrow="Legal"
      title="Política de privacidad y cookies"
      intro={
        <p>
          En resumen: puedes leer el blog sin darnos ningún dato personal. No
          usamos cookies de publicidad ni de seguimiento, y las estadísticas
          de visitas son anónimas. Solo guardamos datos tuyos si creas alertas
          en Telegram, y puedes borrarlos cuando quieras.
        </p>
      }
    >
      <LegalSection title="1. Responsable del tratamiento">
        <p>
          El responsable de los datos personales que se tratan en este sitio y
          en su bot de Telegram es el titular de Una mica de tot
          {hasOwner ? ":" : ", identificado en el aviso legal."}
        </p>
        <OwnerDetails owner={LEGAL_OWNER} />
      </LegalSection>

      <LegalSection title="2. Qué datos tratamos y para qué">
        <div className="space-y-4">
          {PURPOSES.map((item) => (
            <div key={item.what} className="border border-stone-300 p-4">
              <h3 className="font-display text-lg text-ink">{item.what}</h3>
              <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <dt className="font-semibold text-ink">Datos</dt>
                <dd>{item.data}</dd>
                <dt className="font-semibold text-ink">Para qué</dt>
                <dd>{item.why}</dd>
                <dt className="font-semibold text-ink">Base legal</dt>
                <dd>{item.basis}</dd>
                <dt className="font-semibold text-ink">Conservación</dt>
                <dd>{item.keep}</dd>
              </dl>
            </div>
          ))}
        </div>
        <p>
          No tomamos decisiones automatizadas que te afecten ni elaboramos
          perfiles, y no vendemos ni cedemos tus datos a nadie con fines
          comerciales.
        </p>
      </LegalSection>

      <LegalSection title="3. Quién más interviene">
        <p>
          Para que el Sitio funcione usamos proveedores que tratan datos por
          cuenta nuestra y con las garantías del RGPD:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Alojamiento, base de datos y estadísticas:</strong>{" "}
            servidor contratado a Contabo GmbH, situado en Francia (Unión
            Europea). Tus datos no salen del Espacio Económico Europeo.
          </li>
          <li>
            <strong>Telegram:</strong> si usas el bot, Telegram trata tus datos
            según su propia{" "}
            <a
              href="https://telegram.org/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline underline-offset-2"
            >
              política de privacidad
            </a>
            .
          </li>
        </ul>
        <p>
          Cuando sigues un enlace a una tienda (Amazon, AliExpress, etc.),
          sales de este sitio. Desde ese momento es la tienda quien trata tus
          datos y quien puede instalar sus propias cookies, incluida la que
          identifica que vienes de nuestro enlace de afiliado.
        </p>
      </LegalSection>

      <LegalSection title="4. Cookies y almacenamiento local">
        <p>
          Este sitio <strong>no instala cookies de publicidad, de analítica
          ni de redes sociales</strong>, por eso no te mostramos un banner de
          cookies. Solo usamos:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Almacenamiento local del navegador</strong>{" "}
            (<code>top-strip-dismissed</code>): recuerda que has cerrado el
            aviso de la parte superior para no volver a enseñártelo. Se queda
            en tu dispositivo y no se envía a ningún servidor.
          </li>
          <li>
            <strong>Cookie de sesión del panel de edición:</strong> solo para
            quien escribe el blog; los lectores nunca la reciben.
          </li>
        </ul>
        <p>
          Ambas son técnicas y necesarias, por lo que están exentas de
          consentimiento (art. 22.2 LSSI-CE). Puedes borrarlas cuando quieras
          desde los ajustes de tu navegador.
        </p>
      </LegalSection>

      <LegalSection title="5. Tus derechos">
        <p>
          Puedes pedirnos en cualquier momento acceder a tus datos,
          rectificarlos, suprimirlos, oponerte a su tratamiento, limitarlo o
          llevártelos a otro servicio (portabilidad). Para ello:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Desde el bot de Telegram puedes ver y borrar tus alertas
            directamente.
          </li>
          <li>
            Para cualquier otra petición, escríbenos
            {LEGAL_OWNER.email ? (
              <>
                {" "}a{" "}
                <a
                  href={`mailto:${LEGAL_OWNER.email}`}
                  className="text-ink underline underline-offset-2"
                >
                  {LEGAL_OWNER.email}
                </a>
              </>
            ) : null}{" "}
            indicando qué derecho quieres ejercer. Te responderemos en el plazo
            máximo de un mes.
          </li>
        </ul>
        <p>
          Si crees que no hemos atendido bien tu solicitud, puedes presentar
          una reclamación ante la{" "}
          <a
            href="https://www.aepd.es"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline underline-offset-2"
          >
            Agencia Española de Protección de Datos
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. Menores">
        <p>
          El servicio de alertas no está dirigido a menores de 14 años. Si
          eres menor de esa edad, no nos facilites datos personales sin el
          consentimiento de tus padres o tutores.
        </p>
      </LegalSection>

      <LegalSection title="7. Cambios en esta política">
        <p>
          Si cambiamos cómo tratamos los datos, actualizaremos esta página y la
          fecha de arriba. Si el cambio es importante y usas el bot, te
          avisaremos también por Telegram.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
